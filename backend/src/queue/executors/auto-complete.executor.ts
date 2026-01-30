/**
 * Todo 自动完成执行器
 *
 * 分析 Todo 任务是否可以自动完成，并执行相应的操作
 */
import { prisma } from '../../database/prisma'
import { claudeService } from '../../llm/claude.service'
import { todoService } from '../../services/todo.service'

/**
 * 自动完成载荷
 */
export interface AutoCompletionPayload {
  todoId: string
}

/**
 * 自动完成执行结果
 */
export interface AutoCompletionExecutorResult {
  success: boolean
  canAutoComplete: boolean
  confidence: number
  approach?: string
  isFallback: boolean
  message: string
}

/**
 * 执行 Todo 自动完成分析
 *
 * @param taskId - 队列任务 ID
 * @param payload - 任务载荷，包含 todoId
 * @returns 自动完成结果
 */
export async function executeAutoCompletion(
  taskId: string,
  payload: AutoCompletionPayload
): Promise<AutoCompletionExecutorResult> {
  const { todoId } = payload

  // 1. 获取 Todo
  const todo = await prisma.claudeTask.findFirst({
    where: {
      id: todoId,
      type: 'todo',
    },
  })

  if (!todo) {
    throw new Error(`Todo not found: ${todoId}`)
  }

  // 2. 检查 Todo 状态
  if (todo.status === 'COMPLETED') {
    return {
      success: true,
      canAutoComplete: false,
      confidence: 100,
      isFallback: false,
      message: 'Todo 已经完成，无需自动完成',
    }
  }

  if (todo.status === 'CANCELLED') {
    return {
      success: false,
      canAutoComplete: false,
      confidence: 0,
      isFallback: false,
      message: 'Todo 已取消，无法自动完成',
    }
  }

  // 3. 调用 Claude API 分析是否可以自动完成
  const analysis = await claudeService.analyzeAutoCompletion({
    title: todo.title || '',
    description: todo.description || undefined,
    priority: todo.priority.toString(),
    dueDate: todo.dueDate?.toISOString(),
  })

  // 4. 更新 Todo 状态为 RUNNING
  await todoService.setAutoCompletionTaskId(todoId, taskId)

  // 5. 根据分析结果决定是否自动完成
  const confidenceThreshold = 70 // 置信度阈值

  if (analysis.canAutoComplete && analysis.confidence >= confidenceThreshold) {
    // 置信度足够高，自动完成任务
    await todoService.completeTodo(todoId, {
      completedAt: new Date(),
    })

    // 更新队列任务状态
    await prisma.claudeTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: JSON.stringify({
          todoId,
          canAutoComplete: true,
          confidence: analysis.confidence,
          approach: analysis.approach,
          estimatedSteps: analysis.estimatedSteps,
          estimatedTime: analysis.estimatedTime,
          isFallback: analysis.isFallback || false,
        }),
      },
    })

    // SSE 推送
    const { sseService } = await import('../../services/sse.service')
    sseService.broadcast('todo.completed', {
      todoId,
      taskId,
      autoCompleted: true,
      confidence: analysis.confidence,
    })

    return {
      success: true,
      canAutoComplete: true,
      confidence: analysis.confidence,
      approach: analysis.approach,
      isFallback: analysis.isFallback || false,
      message: `Todo 已自动完成 (置信度: ${analysis.confidence}%)`,
    }
  } else {
    // 置信度不足，标记为失败并记录原因
    const failureReason = analysis.canAutoComplete
      ? `置信度不足 (${analysis.confidence}% < ${confidenceThreshold}%)`
      : 'AI 判断此任务不适合自动完成'

    await todoService.setAutoCompletionError(todoId, failureReason)

    // 更新队列任务状态
    await prisma.claudeTask.update({
      where: { id: taskId },
      data: {
        status: 'FAILED',
        error: failureReason,
        result: JSON.stringify({
          todoId,
          canAutoComplete: false,
          confidence: analysis.confidence,
          reason: failureReason,
          approach: analysis.approach,
          requirements: analysis.requirements,
          risks: analysis.risks,
          isFallback: analysis.isFallback || false,
        }),
      },
    })

    // SSE 推送
    const { sseService } = await import('../../services/sse.service')
    sseService.broadcast('todo.auto_completion_failed', {
      todoId,
      taskId,
      reason: failureReason,
      confidence: analysis.confidence,
      canAutoComplete: analysis.canAutoComplete,
    })

    return {
      success: false,
      canAutoComplete: false,
      confidence: analysis.confidence,
      isFallback: analysis.isFallback || false,
      message: failureReason,
    }
  }
}
