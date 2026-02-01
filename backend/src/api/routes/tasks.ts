/**
 * 任务管理 API 路由
 *
 * 提供：
 * - GET /api/tasks - 获取任务列表
 * - GET /api/tasks/:id - 获取单个任务
 * - DELETE /api/tasks/:id - 取消任务
 * - GET /api/tasks/stats - 获取队列统计
 */
import { FastifyInstance } from 'fastify'
import { prisma } from '../../database/prisma'
import { queueManager } from '../../queue/queue-manager'

export async function tasksRoutes(fastify: FastifyInstance) {
  /**
   * 获取任务列表
   * @query status - 可选，筛选任务状态
   * @query noteId - 可选，筛选特定笔记的任务
   */
  fastify.get('/api/tasks', async (request, reply) => {
    const { status, noteId } = request.query as {
      status?: string
      noteId?: string
    }

    const where: any = {}
    if (status) where.status = status
    if (noteId) where.noteId = noteId

    const tasks = await prisma.claudeTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return reply.send({
      success: true,
      data: tasks.map((t) => ({
        ...t,
        payload: JSON.parse(t.payload),
        result: t.result ? JSON.parse(t.result) : null,
      })),
    })
  })

  /**
   * 获取单个任务
   * @param id - 任务 ID
   */
  fastify.get('/api/tasks/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const task = await prisma.claudeTask.findUnique({
      where: { id },
    })

    if (!task) {
      return reply.status(404).send({
        success: false,
        error: 'Task not found',
      })
    }

    return reply.send({
      success: true,
      data: {
        ...task,
        payload: JSON.parse(task.payload),
        result: task.result ? JSON.parse(task.result) : null,
      },
    })
  })

  /**
   * 取消任务
   * @param id - 任务 ID
   */
  fastify.delete('/api/tasks/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const task = await prisma.claudeTask.findUnique({
      where: { id },
    })

    if (!task) {
      return reply.status(404).send({
        success: false,
        error: 'Task not found',
      })
    }

    if (task.status === 'RUNNING') {
      return reply.status(400).send({
        success: false,
        error: 'Cannot cancel running task',
      })
    }

    if (task.status === 'COMPLETED' || task.status === 'FAILED') {
      return reply.status(400).send({
        success: false,
        error: 'Cannot cancel completed or failed task',
      })
    }

    await queueManager.cancelTask(id)

    return reply.send({ success: true })
  })

  /**
   * 获取队列统计
   * 使用单个 GROUP BY 查询替代 4 次 COUNT，减少数据库压力
   */
  fastify.get('/api/tasks/stats', async (request, reply) => {
    // 使用单个 GROUP BY 查询获取所有状态的计数
    const stats = await prisma.claudeTask.groupBy({
      by: ['status'],
      _count: true,
    })

    // 将结果转换为 Map 方便查找
    const statsMap = new Map(
      stats.map((s) => [s.status, s._count])
    )

    return reply.send({
      success: true,
      data: {
        pending: statsMap.get('PENDING') || 0,
        running: statsMap.get('RUNNING') || 0,
        completed: statsMap.get('COMPLETED') || 0,
        failed: statsMap.get('FAILED') || 0,
        maxConcurrency: parseInt(process.env.MAX_CLAUDE_CONCURRENCY || '3'),
      },
    })
  })
}
