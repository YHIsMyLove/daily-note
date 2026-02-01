/**
 * Todo 服务
 * 处理 Todo 的 CRUD 操作、筛选、统计等业务逻辑
 */
import { prisma } from '../database/prisma'
import { queueManager } from '../queue/queue-manager'
import { noteService } from './note.service'
import {
  Todo,
  CreateTodoRequest,
  UpdateTodoRequest,
  CompleteTodoRequest,
  TodoFilters,
  TodoStats,
  TodoStatus,
  TodoPriority,
} from '@daily-note/shared'

export class TodoService {
  /**
   * 根据截止日期计算优先级（紧迫度）
   * 规则：
   * - 已逾期 (dueDate < now) -> URGENT
   * - 24小时内到期 -> HIGH
   * - 3天内到期 -> MEDIUM
   * - 3天及以后 / 无dueDate -> LOW
   */
  calculatePriority(dueDate?: Date): TodoPriority {
    if (!dueDate) return 'LOW'

    const now = new Date()
    const diffMs = dueDate.getTime() - now.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffMs < 0) return 'URGENT'           // 已逾期
    if (diffHours < 24) return 'HIGH'         // 24小时内
    if (diffHours < 72) return 'MEDIUM'       // 3天内
    return 'LOW'                              // 3天及以后
  }

  /**
   * 创建 Todo
   */
  async createTodo(data: CreateTodoRequest, isAiGenerated: boolean = false): Promise<Todo> {
    // 计算层级
    let calculatedLevel = 0
    if (data.parentId) {
      const parent = await prisma.claudeTask.findUnique({
        where: { id: data.parentId },
      })
      if (!parent) {
        throw new Error('父任务不存在')
      }
      if (parent.level >= 2) {
        throw new Error('最多支持3级嵌套')
      }
      calculatedLevel = parent.level + 1
    }

    // 如果启用自动关联且没有指定 noteId，获取或创建今日待办笔记
    let finalNoteId = data.noteId
    if (
      data.autoLinkToDailyNote !== false &&
      !finalNoteId &&
      !isAiGenerated
      && !data.parentId // 子任务不自动关联到每日笔记
    ) {
      try {
        const dailyNote = await noteService.getOrCreateDailyTodoNote()
        finalNoteId = dailyNote.id

        // 追加待办内容到笔记
        await noteService.appendTodoToDailyNote(finalNoteId, {
          title: data.title,
          description: data.description,
        })
      } catch (error) {
        console.error('[TodoService] Failed to get/create daily todo note:', error)
      }
    }

    // 自动计算优先级（如果用户没有指定）
    const priority = data.priority || this.calculatePriority(data.dueDate)

    // 确定初始状态和完成时间
    const initialStatus = data.status || 'PENDING'
    const todoCompletedAt = initialStatus === 'COMPLETED'
      ? (data.completedAt || new Date())
      : undefined

    const todo = await prisma.claudeTask.create({
      data: {
        type: 'todo',
        title: data.title,
        description: data.description,
        priority: this.mapPriorityToInt(priority),
        status: initialStatus,
        dueDate: data.dueDate,
        noteId: finalNoteId,
        parentId: data.parentId,
        level: calculatedLevel,
        isAiGenerated,
        autoCompletionEnabled: data.autoCompletionEnabled || false,
        todoMetadata: data.metadata ? JSON.stringify(data.metadata) : null,
        todoCompletedAt,
        payload: JSON.stringify({
          noteContent: data.noteId ? undefined : (data.description || data.title),
        }),
      },
      include: { children: true },
    })

    return this.mapToTodo(todo)
  }

  /**
   * 获取 Todo 列表
   */
  async listTodos(options: {
    filters?: TodoFilters
    sortBy?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'title'
    sortOrder?: 'asc' | 'desc'
    page?: number
    pageSize?: number
  } = {}): Promise<{ todos: Todo[]; total: number; page: number; pageSize: number }> {
    const {
      filters,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      pageSize = 50,
    } = options

    const where: any = {
      type: 'todo', // 只查询 todo 类型的任务
    }

    // 构建过滤条件
    if (filters) {
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
        where.status = { in: statuses }
      }

      if (filters.priority) {
        const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority]
        where.priority = { in: priorities.map(this.mapPriorityToInt) }
      }

      if (filters.noteId) {
        where.noteId = filters.noteId
      }

      if (filters.isAiGenerated !== undefined) {
        where.isAiGenerated = filters.isAiGenerated
      }

      if (filters.autoCompletionEnabled !== undefined) {
        where.autoCompletionEnabled = filters.autoCompletionEnabled
      }

      if (filters.dueDateFrom || filters.dueDateTo) {
        where.dueDate = {}
        if (filters.dueDateFrom) {
          where.dueDate.gte = filters.dueDateFrom
        }
        if (filters.dueDateTo) {
          where.dueDate.lte = filters.dueDateTo
        }
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search } },
          { description: { contains: filters.search } },
        ]
      }
    }

    // 构建排序条件
    const orderBy: any = {}
    if (sortBy === 'priority') {
      orderBy.priority = sortOrder === 'asc' ? 'asc' : 'desc'
    } else {
      orderBy[sortBy] = sortOrder
    }

    const [todos, total] = await Promise.all([
      prisma.claudeTask.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.claudeTask.count({ where }),
    ])

    return {
      todos: todos.map((t) => this.mapToTodo(t)),
      total,
      page,
      pageSize,
    }
  }

  /**
   * 获取单个 Todo
   */
  async getTodo(id: string): Promise<Todo | null> {
    const todo = await prisma.claudeTask.findFirst({
      where: { id, type: 'todo' },
    })

    return todo ? this.mapToTodo(todo) : null
  }

  /**
   * 更新 Todo
   */
  async updateTodo(id: string, data: UpdateTodoRequest): Promise<Todo> {
    const updateData: any = {}

    if (data.title !== undefined) {
      updateData.title = data.title
    }

    if (data.description !== undefined) {
      updateData.description = data.description
    }

    if (data.status !== undefined) {
      updateData.status = data.status
    }

    if (data.priority !== undefined) {
      updateData.priority = this.mapPriorityToInt(data.priority)
    }

    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate
    }

    if (data.autoCompletionEnabled !== undefined) {
      updateData.autoCompletionEnabled = data.autoCompletionEnabled
    }

    if (data.metadata !== undefined) {
      updateData.todoMetadata = JSON.stringify(data.metadata)
    }

    const todo = await prisma.claudeTask.update({
      where: { id },
      data: updateData,
    })

    return this.mapToTodo(todo)
  }

  /**
   * 完成 Todo（带级联逻辑）
   * - 父任务完成时 -> 自动完成所有未完成的子任务
   * - 所有子任务完成时 -> 父任务自动完成
   */
  async completeTodo(id: string, data: CompleteTodoRequest = {}): Promise<Todo> {
    // 获取任务及其子任务
    const currentTodo = await prisma.claudeTask.findUnique({
      where: { id },
      include: { children: true },
    })

    if (!currentTodo) {
      throw new Error('Todo not found')
    }

    // 更新当前任务状态
    const todo = await prisma.claudeTask.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        todoCompletedAt: data.completedAt || new Date(),
      },
      include: { children: true },
    })

    // 如果有子任务，递归完成所有未完成的子任务
    if (currentTodo.children && currentTodo.children.length > 0) {
      await this.completeChildrenRecursively(id)
    }

    // 如果是子任务，检查父任务是否需要自动完成
    if (currentTodo.parentId) {
      await this.checkParentCompletion(currentTodo.parentId)
    }

    return this.mapToTodo(todo)
  }

  /**
   * 递归完成所有子任务
   */
  private async completeChildrenRecursively(parentId: string): Promise<void> {
    const children = await prisma.claudeTask.findMany({
      where: { parentId, status: { not: 'COMPLETED' } },
    })

    for (const child of children) {
      await this.completeTodo(child.id)
    }
  }

  /**
   * 检查父任务是否需要自动完成
   * 当所有子任务都完成时，父任务自动完成
   */
  private async checkParentCompletion(parentId: string): Promise<void> {
    const siblings = await prisma.claudeTask.findMany({
      where: { parentId },
    })

    const allCompleted = siblings.every((s) => s.status === 'COMPLETED')

    if (allCompleted) {
      await prisma.claudeTask.update({
        where: { id: parentId },
        data: {
          status: 'COMPLETED',
          todoCompletedAt: new Date(),
        },
      })
    }
  }

  /**
   * 取消 Todo
   */
  async cancelTodo(id: string): Promise<Todo> {
    const todo = await prisma.claudeTask.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    })

    return this.mapToTodo(todo)
  }

  /**
   * 删除 Todo（软删除，设置为 CANCELLED 状态）
   */
  async deleteTodo(id: string): Promise<void> {
    await prisma.claudeTask.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    })
  }

  /**
   * 永久删除 Todo
   */
  async hardDeleteTodo(id: string): Promise<void> {
    await prisma.claudeTask.delete({
      where: { id },
    })
  }

  /**
   * 获取 Todo 统计数据
   */
  async getTodoStats(filters?: TodoFilters): Promise<TodoStats> {
    const where: any = {
      type: 'todo',
    }

    // 应用相同的过滤条件
    if (filters) {
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
        where.status = { in: statuses }
      }

      if (filters.priority) {
        const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority]
        where.priority = { in: priorities.map(this.mapPriorityToInt) }
      }

      if (filters.noteId) {
        where.noteId = filters.noteId
      }

      if (filters.isAiGenerated !== undefined) {
        where.isAiGenerated = filters.isAiGenerated
      }

      if (filters.autoCompletionEnabled !== undefined) {
        where.autoCompletionEnabled = filters.autoCompletionEnabled
      }

      if (filters.dueDateFrom || filters.dueDateTo) {
        where.dueDate = {}
        if (filters.dueDateFrom) {
          where.dueDate.gte = filters.dueDateFrom
        }
        if (filters.dueDateTo) {
          where.dueDate.lte = filters.dueDateTo
        }
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search } },
          { description: { contains: filters.search } },
        ]
      }
    }

    // 获取所有 todos
    const todos = await prisma.claudeTask.findMany({ where })

    // 计算统计数据
    const stats: TodoStats = {
      total: todos.length,
      byStatus: {
        PENDING: 0,
        NEEDS_REVIEW: 0,
        RUNNING: 0,
        COMPLETED: 0,
        FAILED: 0,
        CANCELLED: 0,
      },
      byPriority: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        URGENT: 0,
      },
      aiGenerated: 0,
      autoCompletionEnabled: 0,
      completedToday: 0,
      overdue: 0,
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    for (const todo of todos) {
      // 按状态统计
      stats.byStatus[todo.status as TodoStatus]++

      // 按优先级统计
      const priority = this.mapIntToPriority(todo.priority)
      stats.byPriority[priority]++

      // AI 生成统计
      if (todo.isAiGenerated) {
        stats.aiGenerated++
      }

      // 自动完成启用统计
      if (todo.autoCompletionEnabled) {
        stats.autoCompletionEnabled++
      }

      // 今日完成统计
      if (todo.status === 'COMPLETED' && todo.todoCompletedAt) {
        const completedAt = new Date(todo.todoCompletedAt)
        if (completedAt >= today && completedAt < tomorrow) {
          stats.completedToday++
        }
      }

      // 逾期统计
      if (
        todo.status !== 'COMPLETED' &&
        todo.status !== 'CANCELLED' &&
        todo.dueDate
      ) {
        const dueDate = new Date(todo.dueDate)
        if (dueDate < today) {
          stats.overdue++
        }
      }
    }

    return stats
  }

  /**
   * 根据 noteId 获取所有相关 Todos
   */
  async getTodosByNoteId(noteId: string): Promise<Todo[]> {
    const todos = await prisma.claudeTask.findMany({
      where: {
        type: 'todo',
        noteId,
      },
      orderBy: { createdAt: 'desc' },
    })

    return todos.map((t) => this.mapToTodo(t))
  }

  /**
   * 启用 Todo 的自动完成功能
   */
  async enableAutoCompletion(id: string): Promise<Todo> {
    const todo = await prisma.claudeTask.update({
      where: { id },
      data: {
        autoCompletionEnabled: true,
        autoCompletionError: null, // 清除之前的错误
      },
    })

    // 触发自动完成检查
    await this.triggerAutoCompletion(id)

    return this.mapToTodo(todo)
  }

  /**
   * 触发 Todo 的自动完成检查
   * 将自动完成任务加入队列，由后台处理
   */
  async triggerAutoCompletion(todoId: string): Promise<void> {
    try {
      // 获取 Todo 以验证存在性并检查是否启用自动完成
      const todo = await prisma.claudeTask.findFirst({
        where: { id: todoId, type: 'todo' },
      })

      if (!todo) {
        throw new Error(`Todo not found: ${todoId}`)
      }

      // 只有启用了自动完成的任务才会触发
      if (!todo.autoCompletionEnabled) {
        return
      }

      // 检查是否已经在处理中
      if (todo.status === 'COMPLETED' || todo.status === 'CANCELLED') {
        return
      }

      // 避免重复入队：如果已有待处理的自动完成任务，则不再创建
      const existingTask = await prisma.claudeTask.findFirst({
        where: {
          type: 'auto_complete_todo',
          noteId: todoId,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      })

      if (existingTask) {
        return
      }

      // 将自动完成任务加入队列（优先级较高，因为这是用户主动触发的）
      await queueManager.enqueue('auto_complete_todo', { todoId }, todoId, 5)

      console.log(`[TodoService] Auto-completion triggered for todo: ${todoId}`)
    } catch (error) {
      console.error(`[TodoService] Error triggering auto-completion for todo ${todoId}:`, error)
      throw error
    }
  }

  /**
   * 禁用 Todo 的自动完成功能
   */
  async disableAutoCompletion(id: string): Promise<Todo> {
    const todo = await prisma.claudeTask.update({
      where: { id },
      data: {
        autoCompletionEnabled: false,
        autoCompletionTaskId: null,
        autoCompletionError: null,
      },
    })

    return this.mapToTodo(todo)
  }

  /**
   * 设置自动完成任务 ID
   */
  async setAutoCompletionTaskId(todoId: string, taskId: string): Promise<Todo> {
    const todo = await prisma.claudeTask.update({
      where: { id: todoId },
      data: {
        autoCompletionTaskId: taskId,
        status: 'RUNNING',
      },
    })

    return this.mapToTodo(todo)
  }

  /**
   * 设置自动完成错误
   */
  async setAutoCompletionError(todoId: string, error: string): Promise<Todo> {
    const todo = await prisma.claudeTask.update({
      where: { id: todoId },
      data: {
        autoCompletionError: error,
        status: 'FAILED',
        autoCompletionTaskId: null,
      },
    })

    return this.mapToTodo(todo)
  }

  /**
   * 获取子任务列表
   */
  async getSubTasks(parentId: string): Promise<Todo[]> {
    const children = await prisma.claudeTask.findMany({
      where: { parentId },
      orderBy: [{ createdAt: 'asc' }],
    })

    return children.map((c) => this.mapToTodo(c))
  }

  /**
   * 创建子任务
   */
  async createSubTask(parentId: string, data: { title: string; description?: string; dueDate?: Date }): Promise<Todo> {
    const parent = await prisma.claudeTask.findUnique({
      where: { id: parentId },
    })

    if (!parent) {
      throw new Error('父任务不存在')
    }
    if (parent.level >= 2) {
      throw new Error('最多支持3级嵌套')
    }

    return this.createTodo({
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      parentId,
    })
  }

  /**
   * 获取任务树（包含所有子任务）
   */
  async getTodoTree(id: string): Promise<Todo | null> {
    const buildTree = async (taskId: string): Promise<Todo | null> => {
      const task = await prisma.claudeTask.findUnique({
        where: { id: taskId },
        include: { children: true },
      })

      if (!task) return null

      const children = await Promise.all(
        task.children.map((child) => buildTree(child.id))
      )

      return {
        ...this.mapToTodo(task),
        children: children.filter((c) => c !== null) as Todo[],
      }
    }

    return buildTree(id)
  }

  /**
   * 获取所有根任务（用于树形展示）
   */
  async getRootTasks(filters?: TodoFilters): Promise<Todo[]> {
    const where: any = {
      type: 'todo',
      parentId: null,
    }

    // 应用过滤条件
    if (filters) {
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
        where.status = { in: statuses }
      }
      if (filters.priority) {
        const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority]
        where.priority = { in: priorities.map(this.mapPriorityToInt) }
      }
    }

    const tasks = await prisma.claudeTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return tasks.map((t) => this.mapToTodo(t))
  }

  /**
   * 将 Prisma ClaudeTask 映射为 Todo
   */
  private mapToTodo(task: any): Todo {
    const metadata = task.todoMetadata ? JSON.parse(task.todoMetadata) : undefined
    const payload = task.payload ? JSON.parse(task.payload) : {}

    return {
      id: task.id,
      title: task.title || '',
      description: task.description || undefined,
      status: task.status as TodoStatus,
      priority: this.mapIntToPriority(task.priority),
      noteId: task.noteId || undefined,
      noteContent: payload.noteContent || undefined,
      parentId: task.parentId || undefined,
      level: task.level || 0,
      dueDate: task.dueDate || undefined,
      completedAt: task.todoCompletedAt || undefined,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      isAiGenerated: task.isAiGenerated || false,
      autoCompletionEnabled: task.autoCompletionEnabled || false,
      autoCompletionTaskId: task.autoCompletionTaskId || undefined,
      autoCompletionError: task.autoCompletionError || undefined,
      metadata,
    }
  }

  /**
   * 将 TodoPriority 映射为整数
   */
  private mapPriorityToInt(priority: TodoPriority): number {
    const mapping = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      URGENT: 4,
    }
    return mapping[priority]
  }

  /**
   * 将整数映射为 TodoPriority
   */
  private mapIntToPriority(priority: number): TodoPriority {
    const mapping: Record<number, TodoPriority> = {
      1: 'LOW',
      2: 'MEDIUM',
      3: 'HIGH',
      4: 'URGENT',
    }
    return mapping[priority] || 'MEDIUM'
  }
}

export const todoService = new TodoService()
