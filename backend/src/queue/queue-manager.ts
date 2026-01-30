/**
 * Claude 任务队列管理器（事件驱动模式）
 *
 * 功能：
 * - 任务入队/出队（FIFO + 优先级）
 * - 并发控制（信号量模式）
 * - 事件驱动：入队后立即执行，任务完成后检查剩余任务
 * - 服务重启时自动恢复 RUNNING 任务
 * - SSE 实时推送任务状态变化
 */
import { prisma } from '../database/prisma'
import { sseService } from '../services/sse.service'

/**
 * 任务执行器接口
 */
export interface TaskExecutor {
  type: string
  execute: (taskId: string, payload: any) => Promise<any>
}

/**
 * 队列管理器类
 */
export class QueueManager {
  private maxConcurrency: number
  private runningCount: number
  private executors: Map<string, TaskExecutor>
  private isProcessing: boolean = false

  constructor(maxConcurrency: number = 3) {
    this.maxConcurrency = maxConcurrency
    this.runningCount = 0
    this.executors = new Map()
  }

  /**
   * 注册任务执行器
   */
  registerExecutor(type: string, executor: TaskExecutor) {
    this.executors.set(type, executor)
  }

  /**
   * 启动队列处理
   */
  async start() {
    if (this.isProcessing) {
      console.log('[Queue] Queue is already processing')
      return
    }

    this.isProcessing = true
    console.log('[Queue] Starting queue manager...')

    // 恢复服务重启前正在运行的任务
    await this.recoverRunningTasks()

    // 立即处理一次队列
    await this.processQueue()

    console.log('[Queue] Queue manager started (event-driven mode)')
  }

  /**
   * 停止队列处理
   */
  async stop() {
    if (!this.isProcessing) {
      return
    }

    this.isProcessing = false
    console.log('[Queue] Queue manager stopped')
  }

  /**
   * 恢复正在运行的任务（服务重启时调用）
   */
  private async recoverRunningTasks() {
    try {
      const runningTasks = await prisma.claudeTask.findMany({
        where: { status: 'RUNNING' },
      })

      if (runningTasks.length > 0) {
        console.log(`[Queue] Recovering ${runningTasks.length} running tasks...`)

        for (const task of runningTasks) {
          await prisma.claudeTask.update({
            where: { id: task.id },
            data: {
              status: 'PENDING',
              error: 'Task recovered after server restart',
              startedAt: null,
            },
          })
        }

        console.log('[Queue] All running tasks have been reset to PENDING')
      }
    } catch (error) {
      console.error('[Queue] Error recovering running tasks:', error)
    }
  }

  /**
   * 添加任务到队列
   */
  async enqueue(
    type: string,
    payload: any,
    noteId?: string,
    priority: number = 0
  ) {
    const task = await prisma.claudeTask.create({
      data: {
        type,
        noteId,
        payload: JSON.stringify(payload),
        priority,
        status: 'PENDING',
      },
    })

    console.log(`[Queue] Task enqueued: ${task.id} (${type})`)

    // SSE 推送：任务创建
    await sseService.broadcast('task.created', {
      taskId: task.id,
      type: task.type,
      noteId: task.noteId,
      status: task.status,
      priority: task.priority,
    })

    // 事件驱动：入队后立即触发队列处理
    setImmediate(() => this.processQueue())

    return task
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string) {
    const task = await prisma.claudeTask.update({
      where: { id: taskId },
      data: { status: 'CANCELLED' },
    })

    console.log(`[Queue] Task cancelled: ${taskId}`)

    // SSE 推送：任务取消
    await sseService.broadcast('task.cancelled', {
      taskId: task.id,
      type: task.type,
      noteId: task.noteId,
      status: task.status,
    })

    return task
  }

  /**
   * 处理队列
   */
  private async processQueue() {
    if (!this.isProcessing) {
      return
    }

    // 检查并发限制
    if (this.runningCount >= this.maxConcurrency) {
      return
    }

    try {
      // 获取待执行任务（按优先级和创建时间排序）
      const tasks = await prisma.claudeTask.findMany({
        where: { status: 'PENDING' },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
        take: this.maxConcurrency - this.runningCount,
      })

      // 并发执行任务
      const promises = tasks.map((task) => this.executeTask(task))
      await Promise.allSettled(promises)
    } catch (error) {
      console.error('[Queue] Error processing queue:', error)
    }
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: any) {
    this.runningCount++

    try {
      console.log(`[Queue] Executing task: ${task.id} (${task.type})`)

      // 更新状态为运行中
      await prisma.claudeTask.update({
        where: { id: task.id },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
          error: null,
        },
      })

      // SSE 推送：任务开始执行
      await sseService.broadcast('task.started', {
        taskId: task.id,
        type: task.type,
        noteId: task.noteId,
        status: 'RUNNING',
      })

      // 获取执行器
      const executor = this.executors.get(task.type)
      if (!executor) {
        throw new Error(`No executor for task type: ${task.type}`)
      }

      // 执行任务
      const payload = JSON.parse(task.payload)
      const result = await executor.execute(task.id, payload)

      // 更新为完成状态
      await prisma.claudeTask.update({
        where: { id: task.id },
        data: {
          status: 'COMPLETED',
          result: JSON.stringify(result),
          completedAt: new Date(),
        },
      })

      console.log(`[Queue] Task completed: ${task.id}`)

      // SSE 推送：任务完成
      await sseService.broadcast('task.completed', {
        taskId: task.id,
        type: task.type,
        noteId: task.noteId,
        status: 'COMPLETED',
        result,
      })

      // SSE 推送：统计信息更新
      await this.broadcastStats()
    } catch (error) {
      // 更新为失败状态
      await prisma.claudeTask.update({
        where: { id: task.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      })

      console.error(`[Queue] Task failed: ${task.id}`, error)

      // SSE 推送：任务失败
      await sseService.broadcast('task.failed', {
        taskId: task.id,
        type: task.type,
        noteId: task.noteId,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
      })

      // SSE 推送：统计信息更新
      await this.broadcastStats()
    } finally {
      this.runningCount--

      // 事件驱动：任务完成后检查是否还有待处理任务
      setImmediate(() => this.processQueue())
    }
  }

  /**
   * 广播统计信息更新
   * 使用单个 GROUP BY 查询替代 4 次 COUNT，减少数据库压力
   */
  private async broadcastStats() {
    // 使用单个 GROUP BY 查询获取所有状态的计数
    const stats = await prisma.claudeTask.groupBy({
      by: ['status'],
      _count: true,
    })

    // 将结果转换为 Map 方便查找
    const statsMap = new Map(
      stats.map((s) => [s.status, s._count])
    )

    await sseService.broadcast('stats.updated', {
      pending: statsMap.get('PENDING') || 0,
      running: statsMap.get('RUNNING') || 0,
      completed: statsMap.get('COMPLETED') || 0,
      failed: statsMap.get('FAILED') || 0,
      maxConcurrency: this.maxConcurrency,
    })
  }
}

/**
 * 导出单例
 */
export const queueManager = new QueueManager(
  parseInt(process.env.MAX_CLAUDE_CONCURRENCY || '3')
)
