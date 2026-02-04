/**
 * Claude API 服务
 * 负责调用 Anthropic Claude API 进行笔记分类、摘要等操作
 */
import Anthropic from '@anthropic-ai/sdk'
import { CLASSIFY_NOTE_PROMPT, ANALYZE_TRENDS_PROMPT, GENERATE_DAILY_SUMMARY_PROMPT, EXTRACT_TASKS_PROMPT } from './prompts'
import { getApiKey, getBaseUrl, getApiTimeout, getMaxRetryAttempts, getRetryInitialDelay } from '../config/claude-config'
import { promptService } from '../services/prompt.service'
import { retryWithBackoff, isNetworkError, isTimeoutError, isHttpStatusCodeRetryable } from '../utils/retry'
import { classifyError, formatUserMessage, ErrorType } from '../utils/errors'

// 分类结果类型
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

// 趋势分析结果
export interface TrendsAnalysisResult {
  summary: string
  topCategories: string[]
  emergingTopics: string[]
  recommendations: string[]
}

// 每日总结结果
export interface DailySummaryResult {
  summary: string
  keyAchievements: string[]
  pendingTasks: string[]
  insights: string[]
}

// 总结分析结果
export interface SummaryAnalysisResult {
  overview: string
  keyAchievements: string[]
  pendingTasks: string[]
  insights: string[]
}

// 分层总结输入
export interface HierarchicalSummaryInput {
  subSummaries: any[]
  timeRange: string
  level: 'week' | 'month' | 'year'
}

// 任务提取结果
export interface ExtractedTask {
  title: string
  description?: string
  priority: 'high' | 'medium' | 'low'
  dueDate: string | null
  status: 'pending' | 'completed'
  subtasks?: ExtractedSubTask[]
}

// 提取的子任务
export interface ExtractedSubTask {
  title: string
  description?: string
  dueDate?: string | null
}

// 任务提取响应
export interface TaskExtractionResult {
  operations: TaskOperationAction[]
  /** 是否为降级结果（API 失败时返回的默认结果） */
  isFallback?: boolean
}

// 任务操作类型
export type TaskOperation = 'create' | 'update' | 'delete' | 'skip'

// 已有任务信息（传给 AI 的简化格式）
export interface ExistingTask {
  id: string
  title: string
  description?: string
  status: 'PENDING' | 'COMPLETED'
  priority: 'high' | 'medium' | 'low'
  dueDate: string | null
}

// 创建操作
export interface CreateOperation {
  action: 'create'
  task: ExtractedTask
}

// 更新操作
export interface UpdateOperation {
  action: 'update'
  taskId: string
  updates: {
    status?: 'PENDING' | 'COMPLETED'
    priority?: 'high' | 'medium' | 'low'
    dueDate?: string | null
    completedAt?: string
  }
}

// 删除操作
export interface DeleteOperation {
  action: 'delete'
  taskId: string
}

// 跳过操作
export interface SkipOperation {
  action: 'skip'
  taskId: string
}

// 任务操作（联合类型）
export type TaskOperationAction = CreateOperation | UpdateOperation | DeleteOperation | SkipOperation

// 自动补全分析结果
export interface AutoCompletionAnalysisResult {
  canAutoComplete: boolean
  confidence: number // 0-100
  approach: string
  estimatedSteps: string[]
  estimatedTime: string
  requirements: string[]
  risks: string[]
  /** 是否为降级结果（API 失败时返回的默认结果） */
  isFallback?: boolean
}

// 关联分析结果
export interface RelationAnalysisOutput {
  relations: Array<{
    noteId: string
    similarity: number
    reason: string
  }>
  /** 是否为降级结果 */
  isFallback?: boolean
}

export class ClaudeService {
  private client: Anthropic
  private readonly maxAttempts: number
  private readonly initialDelay: number
  private readonly timeout: number
  private requestIdCounter: number = 0

  constructor() {
    const apiKey = getApiKey()
    const baseUrl = getBaseUrl()

    const config: any = {
      apiKey,
    }

    // 如果有自定义 baseURL，添加到配置
    if (baseUrl) {
      config.baseURL = baseUrl
    }

    this.client = new Anthropic(config)
    this.maxAttempts = getMaxRetryAttempts()
    this.initialDelay = getRetryInitialDelay()
    this.timeout = getApiTimeout()

    console.log('[ClaudeService] Initialized successfully')
    console.log(`  - API Key: ${apiKey.slice(0, 20)}...${apiKey.slice(-4)}`)
    if (baseUrl) {
      console.log(`  - Base URL: ${baseUrl}`)
    }
    console.log(`  - Max Retry Attempts: ${this.maxAttempts}`)
    console.log(`  - Initial Retry Delay: ${this.initialDelay}ms`)
    console.log(`  - API Timeout: ${this.timeout}ms`)
  }

  /**
   * 生成唯一的请求 ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now()
    const counter = ++this.requestIdCounter
    return `req_${timestamp}_${counter}`
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: any): boolean {
    const classified = classifyError(error)

    // 认证错误和配额错误不可重试
    if (classified.type === ErrorType.AUTHENTICATION ||
        classified.type === ErrorType.QUOTA_EXCEEDED ||
        classified.type === ErrorType.CLIENT) {
      return false
    }

    // 其他错误根据分类结果判断
    return classified.retryable
  }

  /**
   * 记录详细错误信息
   * @param context 操作上下文（如 'classifyNote', 'analyzeTrends'）
   * @param error 错误对象
   * @param attempt 当前重试次数
   * @param requestId 请求 ID
   * @param additionalContext 额外的上下文信息（如内容长度、模型名称等）
   */
  private logError(
    context: string,
    error: any,
    attempt?: number,
    requestId?: string,
    additionalContext?: Record<string, any>
  ): void {
    const classified = classifyError(error)
    const userMessage = formatUserMessage(classified)
    const timestamp = new Date().toISOString()

    console.error('\n' + '='.repeat(80))
    console.error(`[ClaudeService] Error in ${context}`)
    console.error('='.repeat(80))
    console.error(`Timestamp:       ${timestamp}`)
    if (requestId) {
      console.error(`Request ID:      ${requestId}`)
    }
    console.error(`Error Type:      ${classified.type}`)
    console.error(`Retryable:       ${classified.retryable ? 'Yes' : 'No'}`)
    if (attempt !== undefined) {
      console.error(`Attempt:         ${attempt} / ${this.maxAttempts}`)
    }
    if (classified.statusCode) {
      console.error(`Status Code:     ${classified.statusCode}`)
    }
    console.error(`User Message:    ${userMessage}`)
    console.error(`Details:         ${classified.details}`)

    // 记录额外上下文
    if (additionalContext && Object.keys(additionalContext).length > 0) {
      console.error(`Context:`)
      Object.entries(additionalContext).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length > 100) {
          console.error(`  - ${key}: ${value.slice(0, 100)}... (length: ${value.length})`)
        } else {
          console.error(`  - ${key}: ${JSON.stringify(value)}`)
        }
      })
    }

    // 记录堆栈跟踪（如果有）
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 5)
      console.error(`Stack Trace (first 5 lines):`)
      console.error(stackLines.map((line: string) => `  ${line}`).join('\n'))
    }

    console.error('='.repeat(80) + '\n')
  }

  /**
   * 分类笔记
   */
  async classifyNote(
    content: string,
    options: {
      existingCategories?: Array<{ name: string; count: number }>
      existingTags?: Array<{ name: string; count: number }>
    } = {}
  ): Promise<ClassificationResult> {
    const context = 'classifyNote'
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    try {
      return await retryWithBackoff(
        async () => {
          // 格式化分类列表
          const categoriesText = options.existingCategories
            ?.map((c) => `- ${c.name} (使用 ${c.count} 次)`)
            .join('\n') || '暂无分类'

          // 格式化标签列表
          const tagsText = options.existingTags
            ?.map((t) => `- ${t.name} (使用 ${t.count} 次)`)
            .join('\n') || '暂无标签'

          // 从 PromptService 获取提示词
          const prompt = await promptService.getPrompt('classify_note', {
            content,
            existingCategories: categoriesText,
            existingTags: tagsText,
          })

          const message = await this.client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          })

          // 提取 JSON 响应
          const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)

          if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Claude response')
          }

          const result = JSON.parse(jsonMatch[0]) as ClassificationResult

          // 验证返回结果
          if (!result.category || !result.tags || !result.summary) {
            throw new Error('Invalid classification result from Claude')
          }

          return { ...result, isFallback: false }
        },
        {
          maxAttempts: this.maxAttempts,
          initialDelay: this.initialDelay,
          isRetryable: (error) => this.isRetryableError(error),
          onRetry: (error, attempt) => {
            this.logError(
              context,
              error,
              attempt,
              requestId,
              {
                contentLength: content.length,
                contentWordCount: content.split(/\s+/).length,
                model: 'claude-3-5-sonnet-20241022',
                maxTokens: 1024,
                existingCategoriesCount: options.existingCategories?.length || 0,
                existingTagsCount: options.existingTags?.length || 0,
              }
            )
          }
        }
      )
    } catch (error) {
      const duration = Date.now() - startTime
      this.logError(
        context,
        error,
        this.maxAttempts,
        requestId,
        {
          contentLength: content.length,
          contentWordCount: content.split(/\s+/).length,
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 1024,
          existingCategoriesCount: options.existingCategories?.length || 0,
          existingTagsCount: options.existingTags?.length || 0,
          duration: `${duration}ms`,
          finalFailure: true,
        }
      )
      // 返回默认分类
      return this.getDefaultClassification(content)
    }
  }

  /**
   * 分析趋势
   */
  async analyzeTrends(data: {
    dateRange: string
    noteCount: number
    categoryDistribution: string
    tagDistribution: string
  }): Promise<TrendsAnalysisResult> {
    const context = 'analyzeTrends'
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    try {
      return await retryWithBackoff(
        async () => {
          const prompt = await promptService.getPrompt('analyze_trends', {
            dateRange: data.dateRange,
            noteCount: data.noteCount,
            categoryDistribution: data.categoryDistribution,
            tagDistribution: data.tagDistribution,
          })

          const message = await this.client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          })

          const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)

          if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Claude response')
          }

          return JSON.parse(jsonMatch[0]) as TrendsAnalysisResult
        },
        {
          maxAttempts: this.maxAttempts,
          initialDelay: this.initialDelay,
          isRetryable: (error) => this.isRetryableError(error),
          onRetry: (error, attempt) => {
            this.logError(
              context,
              error,
              attempt,
              requestId,
              {
                dateRange: data.dateRange,
                noteCount: data.noteCount,
                model: 'claude-3-5-sonnet-20241022',
                maxTokens: 1024,
              }
            )
          }
        }
      )
    } catch (error) {
      const duration = Date.now() - startTime
      this.logError(
        context,
        error,
        this.maxAttempts,
        requestId,
        {
          dateRange: data.dateRange,
          noteCount: data.noteCount,
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 1024,
          duration: `${duration}ms`,
          finalFailure: true,
        }
      )
      return {
        summary: '暂无趋势分析',
        topCategories: [],
        emergingTopics: [],
        recommendations: [],
      }
    }
  }

  /**
   * 生成每日总结
   */
  async generateDailySummary(data: {
    date: string
    noteCount: number
    categorySummary: string
    importantNotes: string
  }): Promise<DailySummaryResult> {
    const context = 'generateDailySummary'
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    try {
      return await retryWithBackoff(
        async () => {
          const prompt = await promptService.getPrompt('generate_daily_summary', {
            date: data.date,
            noteCount: data.noteCount,
            categorySummary: data.categorySummary,
            importantNotes: data.importantNotes,
          })

          const message = await this.client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          })

          const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)

          if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Claude response')
          }

          return JSON.parse(jsonMatch[0]) as DailySummaryResult
        },
        {
          maxAttempts: this.maxAttempts,
          initialDelay: this.initialDelay,
          isRetryable: (error) => this.isRetryableError(error),
          onRetry: (error, attempt) => {
            this.logError(
              context,
              error,
              attempt,
              requestId,
              {
                date: data.date,
                noteCount: data.noteCount,
                model: 'claude-3-5-sonnet-20241022',
                maxTokens: 1024,
              }
            )
          }
        }
      )
    } catch (error) {
      const duration = Date.now() - startTime
      this.logError(
        context,
        error,
        this.maxAttempts,
        requestId,
        {
          date: data.date,
          noteCount: data.noteCount,
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 1024,
          duration: `${duration}ms`,
          finalFailure: true,
        }
      )
      return {
        summary: '暂无总结',
        keyAchievements: [],
        pendingTasks: [],
        insights: [],
      }
    }
  }

  /**
   * 生成总结分析（用于日总结分析原始笔记）
   */
  async generateSummaryAnalysis(data: {
    notes: Array<{
      content: string
      category?: string
      sentiment?: string
      importance?: number
      createdAt: Date
    }>
    timeRange: string
    noteCount: number
    previousSummary?: any
  }): Promise<SummaryAnalysisResult> {
    const context = 'generateSummaryAnalysis'
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    try {
      return await retryWithBackoff(
        async () => {
          // 构建笔记摘要
          const notesSummary = data.notes.map((note, idx) => {
            const preview = note.content.slice(0, 100)
            return `${idx + 1}. [${note.category || '未分类'}] ${preview}${note.content.length > 100 ? '...' : ''}`
          }).join('\n')

          // 统计情绪分布
          const sentimentCounts = data.notes.reduce<Record<string, number>>((acc, note) => {
            const sentiment = note.sentiment || 'neutral'
            acc[sentiment] = (acc[sentiment] || 0) + 1
            return acc
          }, { positive: 0, neutral: 0, negative: 0 })

          // 提取高重要性笔记
          const importantNotes = data.notes
            .filter((n) => (n.importance || 0) >= 7)
            .map((n) => n.content.slice(0, 200))
            .join('\n\n')

          // 构建提示词
          let prompt = await promptService.getPrompt('summary_analysis', {
            timeRange: data.timeRange,
            noteCount: data.noteCount.toString(),
            notesSummary: notesSummary.slice(0, 5000), // 限制长度
            sentimentSummary: `积极: ${sentimentCounts.positive}, 中性: ${sentimentCounts.neutral}, 消极: ${sentimentCounts.negative}`,
            importantNotes: importantNotes.slice(0, 3000),
          })

          // 如果有旧总结，增强提示词
          if (data.previousSummary) {
            const previousText = this.formatPreviousSummary(data.previousSummary)
            prompt = `
${prompt}

**重要：这是一次更新操作，请参考以下旧总结进行改进和更新：**

${previousText}

请基于旧总结的结构和内容，结合新数据生成一份更新后的总结。
- 保留旧总结中有价值的内容
- 添加新的信息和变化
- 更新过时的数据
`.trim()
          }

          const message = await this.client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2048,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          })

          const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)

          if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Claude response')
          }

          return JSON.parse(jsonMatch[0]) as SummaryAnalysisResult
        },
        {
          maxAttempts: this.maxAttempts,
          initialDelay: this.initialDelay,
          isRetryable: (error) => this.isRetryableError(error),
          onRetry: (error, attempt) => {
            this.logError(
              context,
              error,
              attempt,
              requestId,
              {
                timeRange: data.timeRange,
                noteCount: data.noteCount,
                notesProcessed: data.notes.length,
                hasPreviousSummary: !!data.previousSummary,
                model: 'claude-3-5-sonnet-20241022',
                maxTokens: 2048,
              }
            )
          }
        }
      )
    } catch (error) {
      const duration = Date.now() - startTime
      this.logError(
        context,
        error,
        this.maxAttempts,
        requestId,
        {
          timeRange: data.timeRange,
          noteCount: data.noteCount,
          notesProcessed: data.notes.length,
          hasPreviousSummary: !!data.previousSummary,
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 2048,
          duration: `${duration}ms`,
          finalFailure: true,
        }
      )
      return {
        overview: '暂无总结',
        keyAchievements: [],
        pendingTasks: [],
        insights: [],
      }
    }
  }

  /**
   * 基于子总结生成分层总结（用于周/月/年总结）
   */
  async generateHierarchicalSummary(data: HierarchicalSummaryInput & { previousSummary?: any }): Promise<SummaryAnalysisResult> {
    const context = 'generateHierarchicalSummary'
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    try {
      return await retryWithBackoff(
        async () => {
          // 提取所有子总结的关键信息
          const subSummaries = data.subSummaries.map((s: any, idx: number) => {
            return `
## ${idx + 1}. ${s.period?.mode || 'summary'} (${s.period?.startDate || 'N/A'} - ${s.period?.endDate || 'N/A'})
笔记数: ${s.period?.noteCount || 0}
${s.summary?.overview || ''}

关键成就:
${(s.summary?.keyAchievements || []).map((a: string) => `- ${a}`).join('\n')}

待办任务:
${(s.summary?.pendingTasks || []).map((t: string) => `- ${t}`).join('\n')}

感悟:
${(s.summary?.insights || []).map((i: string) => `- ${i}`).join('\n')}
`
          }).join('\n---\n')

          // 构建提示词
          let prompt = await promptService.getPrompt('hierarchical_summary', {
            level: data.level,
            timeRange: data.timeRange,
            subSummariesCount: data.subSummaries.length.toString(),
            subSummaries: subSummaries.slice(0, 8000), // 限制长度
          })

          // 如果有旧总结，增强提示词
          if (data.previousSummary) {
            const previousText = this.formatPreviousSummary(data.previousSummary)
            prompt = `
${prompt}

**重要：这是一次更新操作，请参考以下旧总结进行改进和更新：**

${previousText}

请基于旧总结的结构和内容，结合新数据生成一份更新后的总结。
- 保留旧总结中有价值的内容
- 添加新的信息和变化
- 更新过时的数据
`.trim()
          }

          const message = await this.client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2048,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          })

          const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)

          if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Claude response')
          }

          return JSON.parse(jsonMatch[0]) as SummaryAnalysisResult
        },
        {
          maxAttempts: this.maxAttempts,
          initialDelay: this.initialDelay,
          isRetryable: (error) => this.isRetryableError(error),
          onRetry: (error, attempt) => {
            this.logError(
              context,
              error,
              attempt,
              requestId,
              {
                level: data.level,
                timeRange: data.timeRange,
                subSummariesCount: data.subSummaries.length,
                hasPreviousSummary: !!data.previousSummary,
                model: 'claude-3-5-sonnet-20241022',
                maxTokens: 2048,
              }
            )
          }
        }
      )
    } catch (error) {
      const duration = Date.now() - startTime
      this.logError(
        context,
        error,
        this.maxAttempts,
        requestId,
        {
          level: data.level,
          timeRange: data.timeRange,
          subSummariesCount: data.subSummaries.length,
          hasPreviousSummary: !!data.previousSummary,
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 2048,
          duration: `${duration}ms`,
          finalFailure: true,
        }
      )
      return {
        overview: '暂无总结',
        keyAchievements: [],
        pendingTasks: [],
        insights: [],
      }
    }
  }

  /**
   * 格式化旧总结内容
   */
  private formatPreviousSummary(summary: any): string {
    return `
## 旧总结内容

**概述：**
${summary.summary?.overview || '无概述'}

**关键成就：**
${(summary.summary?.keyAchievements || []).map((a: string) => `- ${a}`).join('\n') || '无'}

**待办任务：**
${(summary.summary?.pendingTasks || []).map((t: string) => `- ${t}`).join('\n') || '无'}

**感悟洞察：**
${(summary.summary?.insights || []).map((i: string) => `- ${i}`).join('\n') || '无'}
  `.trim()
  }

  /**
   * 分析任务是否可以自动完成
   */
  async analyzeAutoCompletion(task: {
    title: string
    description?: string
    priority: string
    dueDate?: string
  }): Promise<AutoCompletionAnalysisResult> {
    const context = 'analyzeAutoCompletion'
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    try {
      return await retryWithBackoff(
        async () => {
          // 构建任务描述
          const taskDescription = `
任务标题: ${task.title}
${task.description ? `任务描述: ${task.description}` : ''}
优先级: ${task.priority}
${task.dueDate ? `截止日期: ${task.dueDate}` : '无截止日期'}
`.trim()

          // 从 PromptService 获取提示词
          const prompt = await promptService.getPrompt('auto_completion_analysis', {
            task: taskDescription,
          })

          const message = await this.client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2048,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          })

          const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)

          if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Claude response')
          }

          const result = JSON.parse(jsonMatch[0]) as AutoCompletionAnalysisResult

          // 验证返回结果
          if (typeof result.canAutoComplete !== 'boolean' ||
              typeof result.confidence !== 'number' ||
              !result.approach ||
              !Array.isArray(result.estimatedSteps)) {
            throw new Error('Invalid auto-completion analysis result from Claude')
          }

          // 确保 confidence 在 0-100 范围内
          result.confidence = Math.max(0, Math.min(100, result.confidence))

          return { ...result, isFallback: false }
        },
        {
          maxAttempts: this.maxAttempts,
          initialDelay: this.initialDelay,
          isRetryable: (error) => this.isRetryableError(error),
          onRetry: (error, attempt) => {
            this.logError(
              context,
              error,
              attempt,
              requestId,
              {
                taskTitle: task.title,
                taskPriority: task.priority,
                hasDescription: !!task.description,
                hasDueDate: !!task.dueDate,
                model: 'claude-3-5-sonnet-20241022',
                maxTokens: 2048,
              }
            )
          }
        }
      )
    } catch (error) {
      const duration = Date.now() - startTime
      this.logError(
        context,
        error,
        this.maxAttempts,
        requestId,
        {
          taskTitle: task.title,
          taskPriority: task.priority,
          hasDescription: !!task.description,
          hasDueDate: !!task.dueDate,
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 2048,
          duration: `${duration}ms`,
          finalFailure: true,
        }
      )
      // 返回保守的默认分析结果
      return this.getDefaultAutoCompletionAnalysis(task)
    }
  }

  /**
   * 从文本内容中提取任务（支持智能去重）
   * @param content 笔记内容
   * @param existingTasks 已有任务列表
   */
  async extractTasks(content: string, existingTasks: ExistingTask[] = []): Promise<TaskExtractionResult> {
    const context = 'extractTasks'
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    try {
      return await retryWithBackoff(
        async () => {
          // 格式化已有任务列表
          let existingTasksText = '暂无已有任务'
          if (existingTasks.length > 0) {
            existingTasksText = existingTasks.map(t => {
              const dueDateStr = t.dueDate ? t.dueDate : '无截止日期'
              return `- ID: ${t.id}, 标题: "${t.title}", 状态: ${t.status}, 优先级: ${t.priority}, 截止日期: ${dueDateStr}`
            }).join('\n')
          }

          // 替换 Prompt 中的占位符
          const prompt = EXTRACT_TASKS_PROMPT
            .replace('{content}', content)
            .replace('{existingTasks}', existingTasksText)

          const message = await this.client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2048,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          })

          const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)

          if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Claude response')
          }

          const result = JSON.parse(jsonMatch[0]) as TaskExtractionResult

          // 验证返回结果
          if (!result.operations || !Array.isArray(result.operations)) {
            throw new Error('Invalid task extraction result from Claude')
          }

          return { ...result, isFallback: false }
        },
        {
          maxAttempts: this.maxAttempts,
          initialDelay: this.initialDelay,
          isRetryable: (error) => this.isRetryableError(error),
          onRetry: (error, attempt) => {
            this.logError(
              context,
              error,
              attempt,
              requestId,
              {
                contentLength: content.length,
                contentWordCount: content.split(/\s+/).length,
                existingTasksCount: existingTasks.length,
                model: 'claude-3-5-sonnet-20241022',
                maxTokens: 2048,
              }
            )
          }
        }
      )
    } catch (error) {
      const duration = Date.now() - startTime
      this.logError(
        context,
        error,
        this.maxAttempts,
        requestId,
        {
          contentLength: content.length,
          contentWordCount: content.split(/\s+/).length,
          existingTasksCount: existingTasks.length,
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 2048,
          duration: `${duration}ms`,
          finalFailure: true,
        }
      )
      // 返回空操作列表
      return {
        operations: [],
        isFallback: true,
      }
    }
  }

  /**
   * 获取默认分类（当 Claude API 调用失败时）
   */
  private getDefaultClassification(content: string): ClassificationResult {
    const wordCount = content.split(/\s+/).length

    // 根据内容长度和关键词推断
    let category = '其他'
    const lowerContent = content.toLowerCase()

    if (lowerContent.includes('完成') || lowerContent.includes('任务') || lowerContent.includes('待办')) {
      category = '待办事项'
    } else if (lowerContent.includes('学习') || lowerContent.includes('阅读') || lowerContent.includes('笔记')) {
      category = '学习笔记'
    } else if (lowerContent.includes('工作') || lowerContent.includes('项目') || lowerContent.includes('会议')) {
      category = '工作总结'
    } else if (lowerContent.includes('想法') || lowerContent.includes('灵感') || lowerContent.includes('创意')) {
      category = '想法记录'
    } else if (lowerContent.includes('今天') || lowerContent.includes('吃饭') || lowerContent.includes('生活')) {
      category = '生活琐事'
    }

    return {
      category,
      tags: [category, '默认'],
      summary: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
      sentiment: 'neutral',
      importance: wordCount > 100 ? 7 : 5,
      isFallback: true,
    }
  }

  /**
   * 获取默认自动补全分析（当 Claude API 调用失败时）
   */
  private getDefaultAutoCompletionAnalysis(task: {
    title: string
    description?: string
    priority: string
    dueDate?: string
  }): AutoCompletionAnalysisResult {
    const lowerTitle = task.title.toLowerCase()

    // 默认保守策略：大多数任务不能自动完成
    let canAutoComplete = false
    let confidence = 10
    let approach = '此任务需要人工判断和执行，AI 无法自动完成'
    let estimatedSteps: string[] = ['需要用户手动处理']
    let estimatedTime = '未知'
    let requirements: string[] = ['需要人工介入']
    let risks: string[] = ['自动执行可能导致错误']

    // 某些简单的信息查询类任务可能可以自动完成
    if (lowerTitle.match(/^(查询|搜索|查找|获取)/) &&
        !lowerTitle.includes('敏感') &&
        !lowerTitle.includes('私人') &&
        !lowerTitle.includes('密码')) {
      canAutoComplete = true
      confidence = 60
      approach = '这是一个信息查询类任务，可以尝试自动搜索和汇总信息'
      estimatedSteps = ['分析查询需求', '搜索相关信息', '汇总结果']
      estimatedTime = '5-15分钟'
      requirements = ['明确的信息来源', '清晰的数据格式要求']
      risks = ['信息可能不准确', '需要验证搜索结果']
    }

    return {
      canAutoComplete,
      confidence,
      approach,
      estimatedSteps,
      estimatedTime,
      requirements,
      risks,
      isFallback: true,
    }
  }

  /**
   * 分析笔记关联性
   * @param input 包含当前笔记和候选笔记的数据
   * @returns 关联分析结果
   */
  async analyzeRelations(input: {
    currentNote: {
      id: string
      title: string
      content: string
      category?: string
      tags: string[]
    }
    candidateNotes: Array<{
      id: string
      content: string
      summary?: string
      category?: string
      tags: string[]
      date: Date
    }>
  }): Promise<RelationAnalysisOutput> {
    const context = 'analyzeRelations'
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    try {
      return await retryWithBackoff(
        async () => {
          // 格式化候选笔记列表
          const candidateNotesText = input.candidateNotes.map((n, idx) => {
            const preview = n.content.slice(0, 150)
            return `${idx + 1}. [ID: ${n.id}] ${n.category || '未分类'} | ${n.tags.join(', ') || '无标签'}
日期：${n.date.toLocaleDateString('zh-CN')}
${preview}${n.content.length > 150 ? '...' : ''}`
          }).join('\n\n')

          // 从 PromptService 获取提示词
          const prompt = await promptService.getPrompt('analyze_relations', {
            currentNoteTitle: input.currentNote.title,
            currentNoteContent: input.currentNote.content,
            currentNoteCategory: input.currentNote.category || '未分类',
            currentNoteTags: input.currentNote.tags.join(', ') || '无',
            candidateNotesList: candidateNotesText,
          })

          const message = await this.client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2048,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          })

          // 提取 JSON 响应
          const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)

          if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Claude response')
          }

          const result = JSON.parse(jsonMatch[0]) as RelationAnalysisOutput

          // 验证返回结果
          if (!Array.isArray(result.relations)) {
            throw new Error('Invalid relation analysis result from Claude')
          }

          return { ...result, isFallback: false }
        },
        {
          maxAttempts: this.maxAttempts,
          initialDelay: this.initialDelay,
          isRetryable: (error) => this.isRetryableError(error),
          onRetry: (error, attempt) => {
            this.logError(
              context,
              error,
              attempt,
              requestId,
              {
                currentNoteId: input.currentNote.id,
                candidateCount: input.candidateNotes.length,
                model: 'claude-3-5-sonnet-20241022',
                maxTokens: 2048,
              }
            )
          }
        }
      )
    } catch (error) {
      const duration = Date.now() - startTime
      this.logError(
        context,
        error,
        this.maxAttempts,
        requestId,
        {
          currentNoteId: input.currentNote.id,
          candidateCount: input.candidateNotes.length,
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 2048,
          duration: `${duration}ms`,
          finalFailure: true,
        }
      )
      // 返回空关联列表
      return {
        relations: [],
        isFallback: true,
      }
    }
  }
}

// 导出单例
export const claudeService = new ClaudeService()
