/**
 * Claude API 服务
 * 负责调用 Anthropic Claude API 进行笔记分类、摘要等操作
 */
import Anthropic from '@anthropic-ai/sdk'
import { CLASSIFY_NOTE_PROMPT, ANALYZE_TRENDS_PROMPT, GENERATE_DAILY_SUMMARY_PROMPT } from './prompts'
import { getApiKey, getBaseUrl } from '../config/claude-config'
import { promptService } from '../services/prompt.service'

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

export class ClaudeService {
  private client: Anthropic

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

    console.log('[ClaudeService] Initialized successfully')
    console.log(`  - API Key: ${apiKey.slice(0, 20)}...${apiKey.slice(-4)}`)
    if (baseUrl) {
      console.log(`  - Base URL: ${baseUrl}`)
    }
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
    try {
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
    } catch (error) {
      console.error('Claude classification error:', error)
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
    try {
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
    } catch (error) {
      console.error('Claude trends analysis error:', error)
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
    try {
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
    } catch (error) {
      console.error('Claude daily summary error:', error)
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
    try {
      // 构建笔记摘要
      const notesSummary = data.notes.map((note, idx) => {
        const preview = note.content.slice(0, 100)
        return `${idx + 1}. [${note.category || '未分类'}] ${preview}${note.content.length > 100 ? '...' : ''}`
      }).join('\n')

      // 统计情绪分布
      const sentimentCounts = data.notes.reduce((acc, note) => {
        const sentiment = note.sentiment || 'neutral'
        acc[sentiment]++
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
    } catch (error) {
      console.error('Claude summary analysis error:', error)
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
    try {
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
    } catch (error) {
      console.error('Claude hierarchical summary error:', error)
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
}

// 导出单例
export const claudeService = new ClaudeService()
