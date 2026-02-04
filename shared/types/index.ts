/**
 * 共享类型定义
 * 前端和后端共用
 */

// 笔记块
export interface NoteBlock {
  id: string
  content: string
  date: Date
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date // 软删除时间戳

  // LLM 处理结果
  category?: string  // 分类名称（保持向后兼容，新版本使用 categoryId）
  categoryId?: string  // 分类 ID
  tags?: string[]
  summary?: string
  sentiment?: 'positive' | 'neutral' | 'negative'

  // 关联信息
  relatedNotes?: string[]
  importance?: number

  // 每日待办笔记相关字段
  isDailyTodoNote?: boolean
  dailyTodoDate?: Date

  // 元数据（支持扩展的 metadata 结构）
  metadata?: {
    wordCount?: number
    summaryInfo?: {
      type: 'summary'
      mode: 'day' | 'week' | 'month' | 'year' | 'custom'
      timeRange: {
        startDate: string
        endDate: string
      }
      taskId: string
      previousTaskId?: string
      generatedAt: string
    }
    // 其他可选字段
    [key: string]: any
  }
}

// 分类
export interface Category {
  id: string
  name: string
  color?: string  // 颜色值，格式：HSL (如 "217 91% 60%") 或 HEX
  count?: number
}

// 标签
export interface Tag {
  id: string
  name: string
  color?: string  // 颜色值，格式：HSL (如 "217 91% 60%") 或 HEX
  count?: number
}

// 笔记关联
export interface NoteRelation {
  id: string
  fromId: string
  toId: string
  similarity?: number
  reason?: string
}

// 创建笔记请求
export interface CreateNoteRequest {
  content: string
  date?: Date
  category?: string
  tags?: string[]
  importance?: number
}

// 更新笔记请求
export interface UpdateNoteRequest {
  content?: string
  category?: string
  tags?: string[]
  importance?: number
}

// 笔记列表响应
export interface NotesListResponse {
  notes: NoteBlock[]
  total: number
  page: number
  pageSize: number
}

// 搜索请求
export interface SearchRequest {
  query: string
  category?: string
  tags?: string[]
  dateFrom?: Date
  dateTo?: Date
}

// 分类结果
export interface ClassificationResult {
  category: string
  tags: string[]
  summary: string
  sentiment: 'positive' | 'neutral' | 'negative'
  importance: number
  /** @deprecated 不再返回关联笔记，保留字段向后兼容 */
  related?: string[]
  /** 是否为降级结果（API 失败时返回的默认分类） */
  isFallback?: boolean
}

// API 响应包装
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// 统计数据
export interface StatsSummary {
  totalNotes: number
  todayNotes: number
  categories: Category[]
  topTags: Tag[]
}

// 活跃度数据
export interface ActivityData {
  date: string    // ISO 日期字符串，如 "2024-01-15"
  count: number   // 当日笔记数量
}

// 活跃度查询模式
export type ActivityMode = 'year' | 'month' | 'week' | 'day'

// 月级活跃度数据
export interface MonthlyActivityData {
  month: number     // 1-12
  year: number
  count: number
}

// 小时级活跃度数据
export interface HourlyActivityData {
  hour: number      // 0-23
  count: number
}

// 活跃度响应
export interface ActivityResponse {
  success: boolean
  data?: ActivityData[]
  error?: string
}

// ===== 任务队列相关类型 =====

// 任务状态
export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

// Claude 任务
export interface ClaudeTask {
  id: string
  type: string
  noteId?: string
  payload: any
  status: TaskStatus
  priority: number
  error?: string
  result?: any
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// 队列统计
export interface QueueStats {
  pending: number
  running: number
  completed: number
  failed: number
  maxConcurrency: number
}

// ===== 提示词模板相关类型 =====

/**
 * 变量定义
 */
export interface PromptVariable {
  name: string           // 变量名，如 'content'
  description: string    // 变量描述，如 '笔记内容'
  required: boolean      // 是否必填
  placeholder: string    // 占位符，如 '{content}'
}

/**
 * 提示词模板（列表项）
 */
export interface PromptTemplate {
  id: string
  key: string            // 唯一标识
  name: string           // 显示名称
  description?: string   // 描述
  isActive: boolean      // 是否激活
  isDefault: boolean     // 是否为系统默认
  updatedAt: Date        // 最后更新时间
}

/**
 * 提示词模板详情
 */
export interface PromptTemplateDetail extends PromptTemplate {
  systemPart: string               // 限定区
  userPart: string                 // 提示词区
  variables: PromptVariable[]      // 变量定义
}

/**
 * 创建/更新提示词请求
 */
export interface UpsertPromptRequest {
  name: string
  description?: string
  systemPart: string
  userPart: string
  variables: PromptVariable[]
}

// ===== 总结分析相关类型 =====

/**
 * 总结分析任务载荷
 */
export interface SummaryAnalyzerPayload {
  timeRange: {
    mode: 'day' | 'week' | 'month' | 'year' | 'custom'
    startDate: string
    endDate: string
  }
  filters: {
    categories?: string[]
    tags?: string[]
  }
}

/**
 * 心情曲线数据点
 */
export interface SentimentDataPoint {
  date: string
  positive: number
  neutral: number
  negative: number
  average: number
}

/**
 * 分类分布数据
 */
export interface CategoryDistribution {
  category: string
  count: number
  percentage: number
}

/**
 * 标签统计
 */
export interface TagStats {
  tag: string
  count: number
}

/**
 * 重要性分布
 */
export interface ImportanceDistribution {
  high: number   // 7-10分
  medium: number // 4-6分
  low: number    // 1-3分
}

/**
 * 字数统计
 */
export interface WordCountStats {
  total: number
  average: number
  max: number
  min: number
}

/**
 * 笔记统计
 */
export interface NoteStatistics {
  totalCount: number
  dailyAverage: number
  categoryDistribution: CategoryDistribution[]
  topTags: TagStats[]
  importanceDistribution: ImportanceDistribution
  wordCountStats: WordCountStats
}

/**
 * 任务完成趋势
 */
export interface TaskCompletionTrend {
  date: string
  completed: number
  pending: number
}

/**
 * 任务完成统计
 */
export interface TaskCompletion {
  mentioned: number
  completed: number
  pending: number
  completionRate: number
  trends: TaskCompletionTrend[]
}

/**
 * 小时级分布
 */
export interface HourlyDistribution {
  hour: number
  count: number
}

/**
 * 星期分布
 */
export interface WeekdayDistribution {
  weekday: number  // 0-6 (周日到周六)
  count: number
}

/**
 * 时间分布统计
 */
export interface TimeDistribution {
  hourly: HourlyDistribution[]
  mostActiveHours: number[]
  weekdayDistribution: WeekdayDistribution[]
}

/**
 * AI 生成的总结
 */
export interface AISummary {
  overview: string
  keyAchievements: string[]
  pendingTasks: string[]
  insights: string[]
}

/**
 * 心情曲线
 */
export interface SentimentCurve {
  daily: SentimentDataPoint[]
  trend: 'improving' | 'stable' | 'declining'
  summary: string
}

/**
 * 总结分析结果（完整）
 */
export interface SummaryAnalysisResult {
  period: {
    mode: string
    startDate: string
    endDate: string
    noteCount: number
  }
  summary: AISummary
  sentimentCurve: SentimentCurve
  noteStatistics: NoteStatistics
  taskCompletion: TaskCompletion
  timeDistribution: TimeDistribution
  generatedAt: string
}

/**
 * 总结笔记的元数据
 */
export interface SummaryNoteMetadata {
  type: 'summary'           // 标识为总结笔记
  mode: 'day' | 'week' | 'month' | 'year' | 'custom'
  timeRange: {
    startDate: string
    endDate: string
  }
  taskId: string            // 关联的 ClaudeTask ID
  previousTaskId?: string   // 更新时的上一个任务 ID
  generatedAt: string       // ISO 时间戳
}

// ===== 总结持久化相关类型 =====

/**
 * Todo 完成统计（简化版）
 */
export interface TodoCompletionStats {
  total: number
  completed: number
  pending: number
  completionRate: number
}

/**
 * 持久化的总结记录
 */
export interface Summary {
  id: string
  mode: 'day' | 'week' | 'month' | 'year' | 'custom'
  startDate: Date
  endDate: Date

  // 总结内容
  overview: string
  achievements: string[]
  pendingTasks: string[]
  insights: string[]

  // 知识提炼（暂未实现，预留字段）
  keyLearnings?: string[]
  trends?: string[]
  patterns?: string[]
  recommendations?: string[]

  // 统计数据
  noteCount: number
  sentimentData: SentimentCurve
  categoryStats: CategoryDistribution[]
  tagStats: TagStats[]
  importanceStats: ImportanceDistribution
  taskStats: TaskCompletion
  timeStats: TimeDistribution
  todoStats: TodoCompletionStats // 新增

  // 元数据
  generatedAt: Date
  updatedAt: Date
  taskId: string
  isAutoGenerated: boolean
}

/**
 * 总结对比结果
 */
export interface SummaryComparison {
  base: Summary
  compare: Summary
  differences: {
    noteCountChange: number
    newAchievements: string[]
    completedTasks: string[]
    newInsights: string[]
    sentimentChange: string
  }
}

/**
 * 总结历史查询过滤器
 */
export interface SummaryHistoryFilters {
  mode?: string
  year?: number
  month?: number
  limit?: number
}

/**
 * 时间线分组方式
 */
export type TimelineGroupBy = 'year' | 'month'

/**
 * 时间线分组数据
 */
export interface TimelineGroup {
  key: string        // 分组标识，如 "2024" 或 "2024-01"
  label: string      // 显示标签，如 "2024年" 或 "2024年1月"
  summaries: Summary[]
}

/**
 * 时间线响应
 */
export interface TimelineResponse {
  groups: TimelineGroup[]
  total: number
}

// ===== Todo 相关类型 =====

export type {
  TodoStatus,
  TodoPriority,
  Todo,
  CreateTodoRequest,
  UpdateTodoRequest,
  CompleteTodoRequest,
  TodoListResponse,
  TodoFilters,
  TodoSortBy,
  TodoSortOrder,
  TodoListQuery,
  TaskExtractionResult,
  AutoCompletionAnalysis,
  TodoStats,
} from './todo'

// ===== 知识图谱相关类型 =====

/**
 * 图谱节点
 */
export interface GraphNode {
  id: string
  label?: string
  content: string
  category?: string
  tags?: string[]
  sentiment?: 'positive' | 'neutral' | 'negative'
  importance?: number
  date: string
  size?: number
  color?: string
}

/**
 * 图谱边
 */
export interface GraphEdge {
  id: string
  from: string
  to: string
  similarity?: number
  weight?: number
  reason?: string
  type?: 'similarity' | 'reference' | 'tag'
}

/**
 * 图谱数据
 */
export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  total: number
  stats?: {
    nodeCount: number
    edgeCount: number
    categoryDistribution: Category[]
  }
}

/**
 * 图谱过滤器
 */
export interface GraphFilters {
  categories?: string[]
  tags?: string[]
  dateFrom?: string
  dateTo?: string
  minSimilarity?: number
  minImportance?: number
  limit?: number
  sentiment?: 'positive' | 'neutral' | 'negative'
}

// ===== 工作流相关类型 =====

export type {
  WorkflowTrigger,
  WorkflowStep,
  WorkflowConnection,
  WorkflowConfig,
  WorkflowConfigDetail,
  TaskTypeDefinition,
  WorkflowNode,
  WorkflowEdge,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  CreateWorkflowStepRequest,
  UpdateWorkflowStepRequest,
  CreateWorkflowConnectionRequest,
  WorkflowExport,
  WorkflowImportRequest,
  // Pipeline 相关类型
  PipelineTrigger,
  PipelineNode,
  PipelineEdge,
  Pipeline,
  PipelineDetail,
  PipelineExecutionStatus,
  PipelineNodeExecutionStatus,
  PipelineExecution,
  PipelineNodeExecution,
  CreatePipelineRequest,
  UpdatePipelineRequest,
  CreatePipelineNodeRequest,
  UpdatePipelineNodeRequest,
  CreatePipelineEdgeRequest,
  ExecutePipelineRequest,
  PipelineVisNode,
  PipelineVisEdge,
} from './workflow'

// 单独导出值（常量）
export { WorkflowTriggerLabels, PipelineTriggerLabels } from './workflow'

// ===== 笔记查询相关类型 =====

/**
 * 时间范围输入参数
 */
export interface DateRangeInput {
  mode: 'day' | 'week' | 'month' | 'year' | 'custom'
  value?: string        // YYYY-MM-DD 或 YYYY-MM 或 YYYY
  startDate?: string    // custom 模式下的起始日期 YYYY-MM-DD
  endDate?: string      // custom 模式下的结束日期 YYYY-MM-DD
}

/**
 * 时间范围查询结果
 */
export interface DateRange {
  startDate: Date
  endDate: Date
}

/**
 * 笔记查询参数
 */
export interface NoteQueryParams {
  // 时间范围（新增）
  dateRange?: DateRangeInput

  // 向后兼容：单日查询
  date?: Date

  // 筛选条件
  category?: string
  tags?: string[]
  keyword?: string  // 新增：关键字全文搜索

  // 分页
  page?: number
  pageSize?: number

  // 日期字段筛选模式
  dateFilterMode?: 'createdAt' | 'updatedAt' | 'both'

  // 是否包含已删除笔记
  includeDeleted?: boolean
}

