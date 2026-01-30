/**
 * 任务提取执行器
 *
 * 从笔记内容中提取可执行的 Todo 任务
 */
import { prisma } from '../../database/prisma'
import { claudeService } from '../../llm/claude.service'
import { todoService } from '../../services/todo.service'
import { TodoPriority } from '@daily-note/shared'

/**
 * 任务提取载荷
 */
export interface TaskExtractionPayload {
  noteId: string
  content: string
}

/**
 * 任务提取结果
 */
export interface TaskExtractionExecutorResult {
  extractedCount: number
  todos: Array<{ id: string; title: string }>
  isFallback: boolean
}

/**
 * 执行任务提取
 *
 * @param taskId - 任务 ID
 * @param payload - 任务载荷，包含 noteId 和 content
 * @returns 提取结果
 */
export async function executeTaskExtraction(
  taskId: string,
  payload: TaskExtractionPayload
): Promise<TaskExtractionExecutorResult> {
  const { noteId, content } = payload

  // 1. 调用 Claude API 提取任务
  const extractionResult = await claudeService.extractTasks(content)

  // 2. 将提取的任务转换为 Todo 记录
  const createdTodos: Array<{ id: string; title: string }> = []

  if (extractionResult.tasks.length > 0) {
    for (const extractedTask of extractionResult.tasks) {
      // 只处理可执行的任务
      if (!extractedTask.actionable) {
        continue
      }

      // 映射优先级
      const priorityMap: Record<string, TodoPriority> = {
        low: 'LOW',
        medium: 'MEDIUM',
        high: 'HIGH',
      }
      const priority = priorityMap[extractedTask.priority] || 'MEDIUM'

      // 创建 Todo
      const todo = await todoService.createTodo(
        {
          title: extractedTask.title,
          description: extractedTask.description,
          priority,
          dueDate: extractedTask.dueDate ? new Date(extractedTask.dueDate) : undefined,
          noteId,
          autoCompletionEnabled: false, // 默认不启用自动完成
        },
        true // 标记为 AI 生成
      )

      createdTodos.push({
        id: todo.id,
        title: todo.title,
      })
    }
  }

  // 3. 更新任务状态
  await prisma.claudeTask.update({
    where: { id: taskId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      result: JSON.stringify({
        extractedCount: createdTodos.length,
        todos: createdTodos,
        isFallback: extractionResult.isFallback || false,
      }),
    },
  })

  // 4. SSE 推送任务完成通知
  const { sseService } = await import('../../services/sse.service')
  sseService.broadcast('task.completed', {
    taskId,
    noteId,
    extractedCount: createdTodos.length,
    todos: createdTodos,
  })

  return {
    extractedCount: createdTodos.length,
    todos: createdTodos,
    isFallback: extractionResult.isFallback || false,
  }
}
