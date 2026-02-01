/**
 * Claude 任务队列管理器（事件驱动模式）
 *
 * 功能：
 * - 任务入队/出队（FIFO + 优先级）
 * - 并发控制（信号量模式）
 * - 事件驱动：入队后立即执行，任务完成后检查剩余任务
 * - 服务重启时将 RUNNING 任务标记为 FAILED（避免自动执行）
 * - SSE 实时推送任务状态变化
 * - 自动重试失败的队列任务（指数退避）
 */
import { prisma } from '../database/prisma'
import { sseService } from '../services/sse.service'
import { classifyError, isRetryable } from '../utils/errors'
import { calculateDelay } from '../utils/retry'

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
  private retryCheckInterval: NodeJS.Timeout | null = null

  // 重试配置
  private maxRetryAttempts: number
  private retryInitialDelay: number
  private retryMaxDelay: number
  private retryBackoffMultiplier: number

  constructor(maxConcurrency: number = 3) {
    this.maxConcurrency = maxConcurrency
    this.runningCount = 0
    this.executors = new Map()

    // 从环境变量读取重试配置
    this.maxRetryAttempts = parseInt(process.env.CLAUDE_MAX_RETRY_ATTEMPTS || '3')
    this.retryInitialDelay = parseInt(process.env.CLAUDE_RETRY_INITIAL_DELAY || '1000')
    this.retryMaxDelay = 10000 // 10秒
    this.retryBackoffMultiplier = 2
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

    // 启动重试检查定时器（每5秒检查一次是否有任务需要重试）
    this.retryCheckInterval = setInterval(() => {
      this.checkRetryTasks()
    }, 5000)

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

    // 清除重试检查定时器
    if (this.retryCheckInterval) {
      clearInterval(this.retryCheckInterval)
      this.retryCheckInterval = null
    }

    console.log('[Queue] Queue manager stopped')
  }

  /**
   * 恢复正在运行的任务（服务重启时调用）
   * 将 RUNNING 任务标记为 FAILED，避免重启后自动执行
   */
  private async recoverRunningTasks() {
    try {
      const runningTasks = await prisma.claudeTask.findMany({
        where: { status: 'RUNNING' },
      })

      if (runningTasks.length > 0) {
        console.log(`[Queue] Found ${runningTasks.length} interrupted tasks, marking as FAILED...`)

        await prisma.claudeTask.updateMany({
          where: { status: 'RUNNING' },
          data: {
            status: 'FAILED',
            error: '任务被中断：服务重启',
            completedAt: new Date(),
          },
        })

        console.log('[Queue] All running tasks have been marked as FAILED')
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
    // 检查是否已存在相同类型和 noteId 的待处理或运行中任务
    if (noteId) {
      const existingTask = await prisma.claudeTask.findFirst({
        where: {
          type,
          noteId,
          status: {
            in: ['PENDING', 'RUNNING'],
          },
        },
      })

      if (existingTask) {
        console.log(`[Queue] Task already exists, skipping: ${type} for note ${noteId}`)

        // SSE 推送：任务已存在
        await sseService.broadcast('task.duplicate', {
          taskId: existingTask.id,
          type,
          noteId,
          status: existingTask.status,
        })

        return existingTask
      }
    }

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
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Queue] Task failed: ${task.id}`, error)

      // 分类错误
      const classifiedError = classifyError(error)

      // 检查是否应该重试
      const shouldRetry = classifiedError.retryable && task.retryCount < this.maxRetryAttempts

      if (shouldRetry) {
        // 计算重试延迟（指数退避）
        const baseDelay = this.retryInitialDelay * Math.pow(this.retryBackoffMultiplier, task.retryCount)
        const delay = Math.min(calculateDelay(baseDelay, true), this.retryMaxDelay)
        const nextRetryAt = new Date(Date.now() + delay)

        // 更新任务为待重试状态
        await prisma.claudeTask.update({
          where: { id: task.id },
          data: {
            status: 'PENDING',
            error: errorMessage,
            retryCount: task.retryCount + 1,
            lastRetryAt: new Date(),
            nextRetryAt: nextRetryAt,
            startedAt: null,
          },
        })

        console.log(`[Queue] Task scheduled for retry: ${task.id} (attempt ${task.retryCount + 1}/${this.maxRetryAttempts}, delay ${Math.round(delay)}ms)`)

        // SSE 推送：任务重试
        await sseService.broadcast('task.retry', {
          taskId: task.id,
          type: task.type,
          noteId: task.noteId,
          status: 'PENDING',
          retryCount: task.retryCount + 1,
          nextRetryAt: nextRetryAt.toISOString(),
          error: errorMessage,
        })

        // SSE 推送：统计信息更新
        await this.broadcastStats()
      } else {
        // 不可重试或已达到最大重试次数，标记为失败
        await prisma.claudeTask.update({
          where: { id: task.id },
          data: {
            status: 'FAILED',
            error: errorMessage,
            completedAt: new Date(),
          },
        })

        console.error(`[Queue] Task permanently failed: ${task.id} (attempts: ${task.retryCount + 1}/${this.maxRetryAttempts}, retryable: ${classifiedError.retryable})`)

        // SSE 推送：任务失败
        await sseService.broadcast('task.failed', {
          taskId: task.id,
          type: task.type,
          noteId: task.noteId,
          status: 'FAILED',
          error: errorMessage,
          retryCount: task.retryCount,
        })

        // SSE 推送：统计信息更新
        await this.broadcastStats()
      }
    } finally {
      this.runningCount--

      // 事件驱动：任务完成后检查是否还有待处理任务
      setImmediate(() => this.processQueue())
    }
  }

  /**
   * 检查是否有任务需要重试
   * 定时检查 nextRetryAt <= now 的任务并重新处理
   */
  private async checkRetryTasks() {
    if (!this.isProcessing) {
      return
    }

    try {
      const now = new Date()

      // 查找需要重试的任务
      const tasksToRetry = await prisma.claudeTask.findMany({
        where: {
          status: 'PENDING',
          nextRetryAt: {
            lte: now,
          },
        },
      })

      if (tasksToRetry.length > 0) {
        console.log(`[Queue] Found ${tasksToRetry.length} tasks ready for retry`)

        // 清除 nextRetryAt 标记，让 processQueue 重新处理这些任务
        await prisma.claudeTask.updateMany({
          where: {
            id: {
              in: tasksToRetry.map((t) => t.id),
            },
          },
          data: {
            nextRetryAt: null,
          },
        })

        // 触发队列处理
        setImmediate(() => this.processQueue())
      }
    } catch (error) {
      console.error('[Queue] Error checking retry tasks:', error)
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
