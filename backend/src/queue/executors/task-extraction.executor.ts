/**
 * 任务提取执行器
 *
 * 从笔记内容中提取可执行的 Todo 任务
 * 支持复杂任务拆分为父子任务结构（最多3级）
 * 支持智能去重：根据 AI 分析执行 create/update/delete/skip 操作
 *
 * 注意：任务状态更新和 SSE 推送由队列管理器统一处理，执行器不应手动更新
 */
import {
  claudeService,
  ExtractedTask,
  ExtractedSubTask,
  ExistingTask,
  TaskOperationAction,
  CreateOperation,
  UpdateOperation,
  DeleteOperation,
  SkipOperation
} from '../../llm/claude.service'
import { todoService } from '../../services/todo.service'
import { sseService } from '../../services/sse.service'
import { TodoPriority, Todo } from '@daily-note/shared'

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
  createdCount: number
  updatedCount: number
  deletedCount: number
  skippedCount: number
  todos: Array<{ id: string; title: string; parentId?: string }>
  isFallback: boolean
}

/**
 * 递归创建子任务（支持孙任务）
 */
async function createSubtasks(
  parentId: string,
  subtasks: ExtractedSubTask[],
  noteId: string
): Promise<Array<{ id: string; title: string; parentId: string }>> {
  const createdSubtasks: Array<{ id: string; title: string; parentId: string }> = []

  for (const subtask of subtasks) {
    try {
      const created = await todoService.createSubTask(parentId, {
        title: subtask.title,
        description: subtask.description,
        dueDate: subtask.dueDate ? new Date(subtask.dueDate) : undefined,
      })

      createdSubtasks.push({
        id: created.id,
        title: created.title,
        parentId,
      })

      // SSE 推送：子任务创建事件
      await sseService.broadcast('todo.created', {
        todoId: created.id,
        noteId,
        title: created.title,
        parentId,
      })
    } catch (error) {
      console.error(`[TaskExtraction] Failed to create subtask:`, error)
    }
  }

  return createdSubtasks
}

/**
 * 处理创建操作
 */
async function handleCreate(
  operation: CreateOperation,
  noteId: string
): Promise<Array<{ id: string; title: string; parentId?: string }>> {
  const createdTodos: Array<{ id: string; title: string; parentId?: string }> = []
  const extractedTask = operation.task

  // 映射优先级
  const priorityMap: Record<string, TodoPriority> = {
    low: 'LOW',
    medium: 'MEDIUM',
    high: 'HIGH',
  }
  const priority = priorityMap[extractedTask.priority] || 'MEDIUM'

  // 判断任务状态：completed 表示已完成，pending 表示待办
  const isCompleted = extractedTask.status === 'completed'

  try {
    // 创建父任务
    const parentTodo = await todoService.createTodo(
      {
        title: extractedTask.title,
        description: extractedTask.description,
        priority,
        dueDate: extractedTask.dueDate ? new Date(extractedTask.dueDate) : undefined,
        noteId,
        autoCompletionEnabled: false, // 默认不启用自动完成
        status: isCompleted ? 'COMPLETED' : 'PENDING',
        completedAt: isCompleted ? new Date() : undefined,
      },
      true // 标记为 AI 生成
    )

    // SSE 推送：Todo 创建事件
    await sseService.broadcast('todo.created', {
      todoId: parentTodo.id,
      noteId,
      title: parentTodo.title,
      priority: parentTodo.priority,
      completed: isCompleted,
    })

    createdTodos.push({
      id: parentTodo.id,
      title: parentTodo.title,
    })

    // 如果有子任务，创建它们
    if (extractedTask.subtasks && extractedTask.subtasks.length > 0) {
      const createdSubtasks = await createSubtasks(
        parentTodo.id,
        extractedTask.subtasks,
        noteId
      )
      createdTodos.push(...createdSubtasks)
    }

    console.log(`[TaskExtraction] Created todo: ${parentTodo.title} (${parentTodo.id})`)
  } catch (error) {
    console.error(`[TaskExtraction] Failed to create todo:`, error)
  }

  return createdTodos
}

/**
 * 处理更新操作
 */
async function handleUpdate(
  operation: UpdateOperation,
  noteId: string
): Promise<{ id: string; title: string } | null> {
  try {
    const updates: any = {}

    if (operation.updates.status) {
      updates.status = operation.updates.status
      // 如果状态变为已完成，设置完成时间
      if (operation.updates.status === 'COMPLETED') {
        updates.completedAt = operation.updates.completedAt
          ? new Date(operation.updates.completedAt)
          : new Date()
      }
    }

    if (operation.updates.priority) {
      updates.priority = operation.updates.priority
    }

    if (operation.updates.dueDate !== undefined) {
      updates.dueDate = operation.updates.dueDate ? new Date(operation.updates.dueDate) : null
    }

    const updatedTodo = await todoService.updateTodo(operation.taskId, updates)

    // SSE 推送：Todo 更新事件
    await sseService.broadcast('todo.updated', {
      todoId: operation.taskId,
      noteId,
      title: updatedTodo.title,
      status: updatedTodo.status,
    })

    console.log(`[TaskExtraction] Updated todo: ${updatedTodo.title} (${operation.taskId})`)
    return { id: operation.taskId, title: updatedTodo.title }
  } catch (error) {
    console.error(`[TaskExtraction] Failed to update todo ${operation.taskId}:`, error)
    return null
  }
}

/**
 * 处理删除操作
 */
async function handleDelete(
  operation: DeleteOperation,
  noteId: string
): Promise<{ id: string } | null> {
  try {
    await todoService.deleteTodo(operation.taskId)

    // SSE 推送：Todo 删除事件
    await sseService.broadcast('todo.deleted', {
      todoId: operation.taskId,
      noteId,
    })

    console.log(`[TaskExtraction] Deleted todo: ${operation.taskId}`)
    return { id: operation.taskId }
  } catch (error) {
    console.error(`[TaskExtraction] Failed to delete todo ${operation.taskId}:`, error)
    return null
  }
}

/**
 * 将 Todo 转换为 ExistingTask 格式
 */
function todoToExistingTask(todo: Todo): ExistingTask {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    status: todo.status as 'PENDING' | 'COMPLETED',
    priority: (todo.priority === 'LOW' ? 'low' : todo.priority === 'HIGH' ? 'high' : 'medium') as 'high' | 'medium' | 'low',
    dueDate: todo.dueDate ? todo.dueDate.toISOString().split('T')[0] : null,
  }
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

  // 1. 获取该笔记已有的 AI 任务
  const existingTodos = await todoService.getTodosByNoteId(noteId)
  const aiGeneratedTodos = existingTodos.filter(t => t.isAiGenerated)
  const existingTasks: ExistingTask[] = aiGeneratedTodos.map(todoToExistingTask)

  console.log(`[TaskExtraction] Found ${existingTasks.length} existing AI-generated tasks for note ${noteId}`)

  // 2. 调用 Claude API，传入已有任务
  const extractionResult = await claudeService.extractTasks(content, existingTasks)

  // 3. 统计和跟踪结果
  let createdCount = 0
  let updatedCount = 0
  let deletedCount = 0
  let skippedCount = 0
  const affectedTodos: Array<{ id: string; title: string; parentId?: string }> = []

  // 4. 根据操作类型执行相应动作
  for (const operation of extractionResult.operations) {
    switch (operation.action) {
      case 'create': {
        const created = await handleCreate(operation, noteId)
        if (created.length > 0) {
          createdCount++
          affectedTodos.push(...created)
        }
        break
      }
      case 'update': {
        const updated = await handleUpdate(operation, noteId)
        if (updated) {
          updatedCount++
          affectedTodos.push(updated)
        }
        break
      }
      case 'delete': {
        const deleted = await handleDelete(operation, noteId)
        if (deleted) {
          deletedCount++
        }
        break
      }
      case 'skip': {
        skippedCount++
        console.log(`[TaskExtraction] Skipped todo: ${operation.taskId}`)
        break
      }
    }
  }

  console.log(`[TaskExtraction] Summary: ${createdCount} created, ${updatedCount} updated, ${deletedCount} deleted, ${skippedCount} skipped`)

  // 注意：任务状态更新和 SSE 推送由队列管理器统一处理
  return {
    createdCount,
    updatedCount,
    deletedCount,
    skippedCount,
    todos: affectedTodos,
    isFallback: extractionResult.isFallback || false,
  }
}
