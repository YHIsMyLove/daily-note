/**
 * 总结分析 API 路由
 *
 * 提供：
 * - POST /api/summaries - 创建分析任务
 * - GET /api/summaries - 获取分析任务列表
 * - GET /api/summaries/:id - 获取单个分析结果
 * - DELETE /api/summaries/:id - 取消/删除分析任务
 * - GET /api/summaries/history - 获取总结历史列表
 * - GET /api/summaries/:id/compare - 对比两个总结
 * - GET /api/summaries/unsummarized - 检测未总结的日期
 * - GET /api/summaries/timeline - 获取时间线视图数据
 */
import { FastifyInstance } from 'fastify'
import { prisma } from '../../database/prisma'
import { queueManager } from '../../queue/queue-manager'
import { summaryPersistenceService } from '../../services/summary-persistence.service'
import { autoSummaryService } from '../../services/auto-summary.service'
import { SummaryAnalyzerPayload, TimelineGroupBy, TimelineGroup, TimelineResponse, CategoryDistribution } from '@daily-note/shared'

/**
 * 清理分类分布数据
 * 数据库中可能存储了包含完整 Category 对象的数据（id, name, color, createdAt）
 * 需要转换为前端期望的 CategoryDistribution 格式（category, count, percentage）
 */
function cleanCategoryDistribution(distribution: any[]): CategoryDistribution[] {
  if (!Array.isArray(distribution)) return []

  return distribution.map((cat: any) => ({
    category: typeof cat?.category === 'string' ? cat.category : cat?.name || '未知',
    count: cat?.count ?? 0,
    percentage: cat?.percentage ?? 0,
  }))
}

/**
 * 清理总结分析结果
 * 确保数据格式符合前端期望
 */
function cleanSummaryResult(result: any): any {
  if (!result?.noteStatistics?.categoryDistribution) return result

  return {
    ...result,
    noteStatistics: {
      ...result.noteStatistics,
      categoryDistribution: cleanCategoryDistribution(result.noteStatistics.categoryDistribution),
    },
  }
}

export default async function summariesRoutes(fastify: FastifyInstance) {
  /**
   * 创建分析任务
   * @body timeRange - 时间范围配置
   * @body filters - 筛选条件（分类、标签）
   */
  fastify.post('/', async (request, reply) => {
    const payload = request.body as SummaryAnalyzerPayload

    // 验证必需字段
    if (!payload.timeRange || !payload.timeRange.mode || !payload.timeRange.startDate || !payload.timeRange.endDate) {
      return reply.status(400).send({
        success: false,
        error: '缺少必需的时间范围参数',
      })
    }

    // 创建任务
    const task = await queueManager.enqueue(
      'summary_analyzer',
      payload,
      undefined, // 总结任务不关联特定笔记
      3     // 中等优先级
    )

    return reply.send({
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
      },
    })
  })

  /**
   * 获取分析任务列表
   * @query status - 可选，筛选任务状态
   * @query mode - 可选，筛选总结模式（day/week/month/year/custom）
   * @query limit - 可选，限制返回数量（默认 20）
   */
  fastify.get('/', async (request, reply) => {
    const { status, mode, limit = '20' } = request.query as {
      status?: string
      mode?: string
      limit?: string
    }

    const where: any = {
      type: 'summary_analyzer',
    }

    if (status) {
      where.status = status
    }

    if (mode) {
      // 通过 payload JSON 查询模式
      where.payload = {
        contains: `"mode":"${mode}"`,
      }
    }

    const tasks = await prisma.claudeTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    })

    return reply.send({
      success: true,
      data: tasks.map((t) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        payload: JSON.parse(t.payload),
        result: t.result ? cleanSummaryResult(JSON.parse(t.result)) : null,
        error: t.error,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
    })
  })

  /**
   * 检测未总结的日期
   * @query days - 可选，向前查找的天数（默认 7）
   */
  fastify.get('/unsummarized', async (request, reply) => {
    const { days = '7' } = request.query as {
      days?: string
    }

    try {
      const daysNum = parseInt(days, 10)
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
        return reply.status(400).send({
          success: false,
          error: 'days 参数必须是 1-365 之间的整数',
        })
      }

      const unsummarizedDates = await autoSummaryService.detectUnsummarizedDates(daysNum)

      return reply.send({
        success: true,
        data: {
          days: daysNum,
          dates: unsummarizedDates,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      })
    }
  })

  /**
   * 获取单个分析任务
   * @param id - 任务 ID
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const task = await prisma.claudeTask.findUnique({
      where: { id },
    })

    if (!task || task.type !== 'summary_analyzer') {
      return reply.status(404).send({
        success: false,
        error: 'Summary task not found',
      })
    }

    return reply.send({
      success: true,
      data: {
        id: task.id,
        type: task.type,
        status: task.status,
        payload: JSON.parse(task.payload),
        result: task.result ? cleanSummaryResult(JSON.parse(task.result)) : null,
        error: task.error,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
      },
    })
  })

  /**
   * 取消/删除分析任务
   * @param id - 任务 ID
   */
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const task = await prisma.claudeTask.findUnique({
      where: { id },
    })

    if (!task || task.type !== 'summary_analyzer') {
      return reply.status(404).send({
        success: false,
        error: 'Summary task not found',
      })
    }

    if (task.status === 'RUNNING') {
      return reply.status(400).send({
        success: false,
        error: '无法取消正在运行的任务',
      })
    }

    if (task.status === 'COMPLETED') {
      // 已完成的任务直接从数据库删除
      await prisma.claudeTask.delete({
        where: { id },
      })

      return reply.send({
        success: true,
        data: { message: '任务已删除' },
      })
    }

    // PENDING 或 FAILED 状态的任务取消并删除
    await queueManager.cancelTask(id)
    await prisma.claudeTask.delete({
      where: { id },
    })

    return reply.send({
      success: true,
      data: { message: '任务已取消并删除' },
    })
  })

  /**
   * 获取总结历史统计
   * 按模式分组统计已完成的总结数量
   */
  fastify.get('/stats', async (request, reply) => {
    const tasks = await prisma.claudeTask.findMany({
      where: {
        type: 'summary_analyzer',
        status: 'COMPLETED',
      },
      select: {
        payload: true,
        createdAt: true,
      },
    })

    // 按模式统计
    const modeStats = {
      day: 0,
      week: 0,
      month: 0,
      year: 0,
      custom: 0,
    }

    for (const task of tasks) {
      try {
        const payload = JSON.parse(task.payload)
        const mode = payload.timeRange?.mode
        if (mode && mode in modeStats) {
          modeStats[mode as keyof typeof modeStats]++
        }
      } catch {
        // 忽略解析错误
      }
    }

    return reply.send({
      success: true,
      data: {
        total: tasks.length,
        byMode: modeStats,
      },
    })
  })

  /**
   * 获取总结历史列表
   * @query mode - 可选，筛选总结模式（day/week/month/year/custom）
   * @query year - 可选，筛选年份
   * @query month - 可选，筛选月份（1-12）
   * @query limit - 可选，限制返回数量（默认 20）
   */
  fastify.get('/history', async (request, reply) => {
    const { mode, year, month, limit = '20' } = request.query as {
      mode?: string
      year?: string
      month?: string
      limit?: string
    }

    try {
      const filters: any = {
        limit: parseInt(limit),
      }

      if (mode) filters.mode = mode
      if (year) filters.year = parseInt(year)
      if (month) filters.month = parseInt(month)

      const summaries = await summaryPersistenceService.getHistory(filters)

      return reply.send({
        success: true,
        data: summaries,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      })
    }
  })

  /**
   * 获取单个总结详情（从 Summary 表）
   * @param id - 总结 ID
   */
  fastify.get('/record/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const summary = await summaryPersistenceService.getById(id)

      if (!summary) {
        return reply.status(404).send({
          success: false,
          error: 'Summary not found',
        })
      }

      return reply.send({
        success: true,
        data: summary,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      })
    }
  })

  /**
   * 对比两个总结
   * @param id - 第一个总结 ID
   * @query compareId - 第二个总结 ID
   */
  fastify.get('/:id/compare', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { compareId } = request.query as { compareId: string }

    if (!compareId) {
      return reply.status(400).send({
        success: false,
        error: 'Missing compareId parameter',
      })
    }

    try {
      const comparison = await summaryPersistenceService.compare(id, compareId)

      return reply.send({
        success: true,
        data: comparison,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      })
    }
  })

  /**
   * 删除总结记录
   * @param id - 总结 ID
   */
  fastify.delete('/record/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      await summaryPersistenceService.delete(id)

      return reply.send({
        success: true,
        data: { message: 'Summary deleted' },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      })
    }
  })

  /**
   * 获取时间线视图数据
   * @query mode - 可选，筛选总结模式（day/week/month/year/custom）
   * @query groupBy - 可选，分组方式（year/month），默认 month
   * @query limit - 可选，限制返回数量（默认 100）
   */
  fastify.get('/timeline', async (request, reply) => {
    const { mode, groupBy = 'month', limit = '100' } = request.query as {
      mode?: string
      groupBy?: TimelineGroupBy
      limit?: string
    }

    try {
      const where: any = {}
      if (mode) where.mode = mode

      const summaries = await prisma.summary.findMany({
        where,
        orderBy: { startDate: 'desc' },
        take: parseInt(limit),
      })

      // 按时间分组
      const grouped = groupSummariesByTime(summaries, groupBy)

      return reply.send({
        success: true,
        data: {
          groups: grouped,
          total: summaries.length,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      })
    }
  })
}

/**
 * 按时间分组总结
 * @param summaries - 总结列表
 * @param groupBy - 分组方式
 * @returns 分组后的数据
 */
function groupSummariesByTime(summaries: any[], groupBy: TimelineGroupBy): TimelineGroup[] {
  const groups = new Map<string, TimelineGroup>()

  for (const summary of summaries) {
    const startDate = new Date(summary.startDate)
    let key: string
    let label: string

    if (groupBy === 'year') {
      key = String(startDate.getFullYear())
      label = `${startDate.getFullYear()}年`
    } else {
      // groupBy === 'month'
      key = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`
      label = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月`
    }

    if (!groups.has(key)) {
      groups.set(key, { key, label, summaries: [] })
    }

    // 转换为前端 Summary 格式
    const mappedSummary = {
      id: summary.id,
      mode: summary.mode,
      startDate: summary.startDate,
      endDate: summary.endDate,
      overview: summary.overview,
      achievements: JSON.parse(summary.achievements),
      pendingTasks: JSON.parse(summary.pendingTasks),
      insights: JSON.parse(summary.insights),
      keyLearnings: summary.keyLearnings ? JSON.parse(summary.keyLearnings) : undefined,
      trends: summary.trends ? JSON.parse(summary.trends) : undefined,
      patterns: summary.patterns ? JSON.parse(summary.patterns) : undefined,
      recommendations: summary.recommendations ? JSON.parse(summary.recommendations) : undefined,
      noteCount: summary.noteCount,
      sentimentData: JSON.parse(summary.sentimentData),
      categoryStats: JSON.parse(summary.categoryStats),
      tagStats: JSON.parse(summary.tagStats),
      importanceStats: JSON.parse(summary.importanceStats),
      taskStats: JSON.parse(summary.taskStats),
      timeStats: JSON.parse(summary.timeStats),
      todoStats: JSON.parse(summary.todoStats || '{}'),
      generatedAt: summary.generatedAt,
      updatedAt: summary.updatedAt,
      taskId: summary.taskId,
      isAutoGenerated: summary.isAutoGenerated,
    }

    groups.get(key)!.summaries.push(mappedSummary)
  }

  // 转换为数组并按分组 key 倒序排列
  return Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key))
}
