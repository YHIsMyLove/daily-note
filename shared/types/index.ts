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
  category?: string
  tags?: string[]
  summary?: string
  sentiment?: 'positive' | 'neutral' | 'negative'

  // 关联信息
  relatedNotes?: string[]
  importance?: number

  // 元数据
  metadata?: {
    wordCount?: number
  }

  // 匹配来源标记（用于日期筛选时标识是通过创建时间还是更新时间匹配）
  matchSource?: 'createdAt' | 'updatedAt' | null
}

// 分类
export interface Category {
  name: string
  count: number
}

// 标签
export interface Tag {
  id: string
  name: string
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

/**
 * 笔记列表过滤器
 * 用于查询和过滤笔记列表
 */
export interface NotesListFilter {
  date?: Date                                                      // 单个日期（向后兼容）
  dateFrom?: Date                                                  // 起始日期（范围筛选）
  dateTo?: Date                                                    // 结束日期（范围筛选）
  category?: string                                                // 分类筛选
  tags?: string[]                                                  // 标签筛选
  page?: number                                                    // 页码
  pageSize?: number                                                // 每页数量
  includeDeleted?: boolean                                         // 是否包含已删除笔记
  dateFilterMode?: 'createdAt' | 'updatedAt' | 'both'             // 日期筛选模式
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

// ===== 知识图谱相关类型 =====

/**
 * 图节点
 * 表示知识图谱中的一个节点（笔记）
 */
export interface GraphNode {
  id: string                  // 笔记 ID
  label: string               // 显示标签（笔记内容预览或标题）
  category?: string           // 分类（用于节点颜色）
  sentiment?: 'positive' | 'neutral' | 'negative'  // 情感（用于节点颜色）
  importance?: number         // 重要性（用于节点大小）
  date: string                // 日期（ISO 字符串）
  content?: string            // 完整内容（用于点击预览）
  tags?: string[]             // 标签列表
  cluster?: string            // 所属聚类标识
  size?: number               // 节点大小（可由 importance 计算得出）
  color?: string              // 节点颜色（可由 category/sentiment 计算得出）
}

/**
 * 图边
 * 表示知识图谱中节点之间的关系
 */
export interface GraphEdge {
  id: string                  // 边 ID
  from: string                // 源节点 ID
  to: string                  // 目标节点 ID
  similarity?: number         // 相似度（0-1，用于边的粗细）
  weight?: number             // 权重（可用于边的粗细）
  reason?: string             // 关联原因/标签
  type?: string               // 关系类型（如 'similarity', 'reference', 'tag' 等）
}

/**
 * 图数据响应
 */
export interface GraphData {
  nodes: GraphNode[]          // 节点列表
  edges: GraphEdge[]          // 边列表
  total: number               // 节点总数
  stats?: {
    nodeCount: number         // 节点数量
    edgeCount: number         // 边数量
    clusterCount?: number     // 聚类数量
    categoryDistribution?: Category[]  // 分类分布
  }
}

/**
 * 图查询过滤器
 */
export interface GraphFilters {
  categories?: string[]       // 分类筛选
  tags?: string[]             // 标签筛选
  dateFrom?: string           // 起始日期（ISO 字符串）
  dateTo?: string             // 结束日期（ISO 字符串）
  minSimilarity?: number      // 最小相似度（过滤边）
  minImportance?: number      // 最小重要性（过滤节点）
  limit?: number              // 节点数量限制
  sentiment?: 'positive' | 'neutral' | 'negative'  // 情感筛选
  clusterId?: string          // 聚类 ID 筛选
}

/**
 * 图查询请求
 */
export interface GraphRequest extends GraphFilters {
  // 继承 GraphFilters 的所有字段
}

/**
 * 图数据响应包装
 */
export interface GraphResponse extends ApiResponse<GraphData> {
  // 继承 ApiResponse 的 success, data, error 字段
}
