/**
 * Todo 相关类型定义
 * 前端和后端共用
 */

// Todo 状态（扩展自 TaskStatus，增加待审核状态）
export type TodoStatus = 'PENDING' | 'NEEDS_REVIEW' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

// Todo 优先级
export type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

/**
 * Todo 实体
 */
export interface Todo {
  id: string

  // 任务基本信息
  title: string
  description?: string
  status: TodoStatus
  priority: TodoPriority

  // 关联信息
  noteId?: string          // 来源笔记 ID
  noteContent?: string     // 来源笔记内容片段（用于上下文）

  // 嵌套结构支持
  parentId?: string        // 父任务 ID
  level: number            // 层级：0=根任务, 1=子任务, 2=孙任务
  children?: Todo[]        // 子任务列表（懒加载时可能为空）

  // 时间相关
  dueDate?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date

  // AI 相关
  isAiGenerated: boolean        // 是否由 AI 提取
  autoCompletionEnabled: boolean // 是否启用 AI 自动完成

  // 自动完成的执行信息
  autoCompletionTaskId?: string // AI 自动完成任务的 ClaudeTask ID
  autoCompletionError?: string  // 自动完成失败时的错误信息

  // 元数据
  metadata?: {
    estimatedTime?: number   // 预估完成时间（分钟）
    complexity?: 'simple' | 'medium' | 'complex'
    tags?: string[]
  }
}

/**
 * 创建 Todo 请求
 */
export interface CreateTodoRequest {
  title: string
  description?: string
  priority?: TodoPriority
  dueDate?: Date
  noteId?: string
  autoCompletionEnabled?: boolean
  autoLinkToDailyNote?: boolean  // 自动关联到今日待办笔记（默认 true）
  status?: TodoStatus  // 任务状态（默认 PENDING，可用于创建已完成任务）
  completedAt?: Date   // 完成时间（当 status 为 COMPLETED 时使用）
  metadata?: {
    estimatedTime?: number
    complexity?: 'simple' | 'medium' | 'complex'
    tags?: string[]
  }
  parentId?: string  // 父任务 ID，用于创建子任务
}

/**
 * 创建子任务请求
 */
export interface CreateSubTaskRequest {
  title: string
  description?: string
  dueDate?: Date
  estimatedTime?: number
}

/**
 * 更新 Todo 请求
 */
export interface UpdateTodoRequest {
  title?: string
  description?: string
  status?: TodoStatus
  priority?: TodoPriority
  dueDate?: Date
  autoCompletionEnabled?: boolean
  metadata?: {
    estimatedTime?: number
    complexity?: 'simple' | 'medium' | 'complex'
    tags?: string[]
  }
}

/**
 * 完成 Todo 请求
 */
export interface CompleteTodoRequest {
  completedAt?: Date  // 可选，默认使用当前时间
}

/**
 * Todo 列表响应
 */
export interface TodoListResponse {
  todos: Todo[]
  total: number
  page: number
  pageSize: number
}

/**
 * Todo 过滤器
 */
export interface TodoFilters {
  status?: TodoStatus | TodoStatus[]
  priority?: TodoPriority | TodoPriority[]
  noteId?: string
  isAiGenerated?: boolean
  autoCompletionEnabled?: boolean
  dueDateFrom?: Date
  dueDateTo?: Date
  search?: string  // 标题或描述的文本搜索
}

/**
 * Todo 排序选项
 */
export type TodoSortBy = 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'title'
export type TodoSortOrder = 'asc' | 'desc'

/**
 * Todo 列表查询参数
 */
export interface TodoListQuery {
  filters?: TodoFilters
  sortBy?: TodoSortBy
  sortOrder?: TodoSortOrder
  page?: number
  pageSize?: number
}

/**
 * AI 任务提取结果
 */
export interface TaskExtractionResult {
  tasks: CreateTodoRequest[]
  summary: string
  confidence: number  // 0-1 之间的置信度
}

/**
 * AI 自动完成分析结果
 */
export interface AutoCompletionAnalysis {
  canAutoComplete: boolean
  reason: string
  suggestedAction?: string  // AI 建议的执行动作
  estimatedCompletionTime?: number  // 预估完成时间（分钟）
}

/**
 * Todo 统计数据
 */
export interface TodoStats {
  total: number
  byStatus: Record<TodoStatus, number>
  byPriority: Record<TodoPriority, number>
  aiGenerated: number
  autoCompletionEnabled: number
  completedToday: number
  overdue: number
}
