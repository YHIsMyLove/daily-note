/**
 * 总结分析任务执行器
 *
 * 执行总结分析任务，支持日/周/月/年总结
 */
import { prisma } from '../../database/prisma'
import { summaryService } from '../../services/summary.service'
import { SummaryAnalyzerPayload } from '@daily-note/shared'

/**
 * 执行总结分析任务
 *
 * @param taskId - 任务 ID
 * @param payload - 任务载荷，包含时间范围和筛选条件
 * @returns 分析结果
 */
export async function executeSummaryAnalysis(
  taskId: string,
  payload: SummaryAnalyzerPayload
) {
  // 更新任务状态为 RUNNING
  await prisma.claudeTask.update({
    where: { id: taskId },
    data: {
      status: 'RUNNING',
      startedAt: new Date()
    },
  })

  try {
    // 调用服务层创建分析
    const result = await summaryService.createAnalysis(payload)

    // 持久化总结到 Summary 表
    const { summaryPersistenceService } = await import('../../services/summary-persistence.service')
    await summaryPersistenceService.saveSummary(
      result,
      taskId,
      payload.timeRange.mode,
      payload.timeRange
    )

    // 保存总结为笔记
    await summaryService.saveSummaryAsNote(
      result,
      taskId,
      payload.timeRange
    )

    // 更新任务状态为 COMPLETED
    await prisma.claudeTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: JSON.stringify(result),
      },
    })

    // SSE 推送
    const { sseService } = await import('../../services/sse.service')
    sseService.broadcast('task.completed', { taskId, result })

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // 更新任务状态为 FAILED
    await prisma.claudeTask.update({
      where: { id: taskId },
      data: {
        status: 'FAILED',
        error: errorMessage,
      },
    })

    // SSE 推送失败通知
    const { sseService } = await import('../../services/sse.service')
    sseService.broadcast('task.failed', { taskId, error: errorMessage })

    throw error
  }
}
