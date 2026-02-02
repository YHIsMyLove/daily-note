/**
 * 总结服务 - 分层总结核心逻辑
 *
 * 分层架构：
 * - 日总结：直接分析当天原始笔记
 * - 周总结：基于本周7个日总结生成
 * - 月总结：基于本月约4个周总结生成
 * - 年总结：基于本年12个月总结生成
 */
import { prisma } from '../database/prisma'
import {
  SummaryAnalyzerPayload,
  SummaryAnalysisResult,
  SentimentDataPoint,
  CategoryDistribution,
  TagStats,
  ImportanceDistribution,
  WordCountStats,
  NoteStatistics,
  TaskCompletionTrend,
  TaskCompletion,
  HourlyDistribution,
  WeekdayDistribution,
  TimeDistribution,
  AISummary,
  SentimentCurve,
} from '@daily-note/shared'
import { claudeService } from '../llm/claude.service'

export class SummaryService {
  /**
   * 创建分析任务（智能选择数据源）
   */
  async createAnalysis(payload: SummaryAnalyzerPayload): Promise<SummaryAnalysisResult> {
    const { timeRange, filters } = payload
    const mode = timeRange.mode

    // 检查是否存在旧总结
    const existingSummary = await this.findExistingSummaryNote(mode, timeRange)
    const previousSummary = existingSummary?.previousSummary || null

    // 根据模式决定数据源
    if (mode === 'day') {
      return this.createDayAnalysis(timeRange, filters, previousSummary)
    } else if (mode === 'week') {
      const daySummaries = await this.getExistingSummaries('day', timeRange)
      if (daySummaries.length >= 5) {
        return this.createWeekFromDays(timeRange, filters, daySummaries, previousSummary)
      }
      return this.createWeekFromNotes(timeRange, filters, previousSummary)
    } else if (mode === 'month') {
      const weekSummaries = await this.getExistingSummaries('week', timeRange)
      if (weekSummaries.length >= 2) {
        return this.createMonthFromWeeks(timeRange, filters, weekSummaries, previousSummary)
      }
      return this.createMonthFromNotes(timeRange, filters, previousSummary)
    } else if (mode === 'year') {
      const monthSummaries = await this.getExistingSummaries('month', timeRange)
      if (monthSummaries.length >= 6) {
        return this.createYearFromMonths(timeRange, filters, monthSummaries, previousSummary)
      }
      return this.createYearFromNotes(timeRange, filters, previousSummary)
    } else if (mode === 'custom') {
      return this.createCustomAnalysis(timeRange, filters, previousSummary)
    }

    throw new Error(`Unsupported time range mode: ${mode}`)
  }

  /**
   * 获取指定时间范围内已存在的总结
   */
  private async getExistingSummaries(
    mode: string,
    timeRange: { startDate: string; endDate: string }
  ): Promise<any[]> {
    // 从 ClaudeTask 表查询已完成的总结任务
    // 解析 payload 中的 mode 来匹配
    const tasks = await prisma.claudeTask.findMany({
      where: {
        type: 'summary_analyzer',
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(timeRange.startDate),
          lte: new Date(timeRange.endDate),
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // 过滤出匹配 mode 的任务
    return tasks.filter((task) => {
      try {
        const payload = JSON.parse(task.payload)
        return payload.timeRange?.mode === mode
      } catch {
        return false
      }
    })
  }

  /**
   * 日总结：分析当天原始笔记
   */
  private async createDayAnalysis(
    timeRange: { startDate: string; endDate: string },
    filters: { categories?: string[]; tags?: string[] },
    previousSummary: SummaryAnalysisResult | null
  ): Promise<SummaryAnalysisResult> {
    // 获取当天所有笔记
    const notes = await this.fetchNotes(timeRange, filters)

    if (notes.length === 0) {
      return this.createEmptyResult(timeRange, 'day')
    }

    // 计算统计数据
    const sentimentCurve = this.calculateSentimentCurve(notes)
    const noteStatistics = this.calculateNoteStatistics(notes)
    const taskCompletion = this.calculateTaskCompletion(notes)
    const timeDistribution = this.calculateTimeDistribution(notes)

    // 调用 Claude 生成 AI 总结
    const summary = await claudeService.generateSummaryAnalysis({
      notes: notes.map((n) => ({
        content: n.content,
        category: n.category?.name || '未分类',
        sentiment: n.sentiment,
        importance: n.importance,
        createdAt: n.createdAt,
      })),
      timeRange: `${timeRange.startDate} 至 ${timeRange.endDate}`,
      noteCount: notes.length,
      previousSummary,
    })

    return {
      period: {
        mode: 'day',
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
        noteCount: notes.length,
      },
      summary,
      sentimentCurve,
      noteStatistics,
      taskCompletion,
      timeDistribution,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * 周总结：基于日总结生成
   */
  private async createWeekFromDays(
    timeRange: { startDate: string; endDate: string },
    filters: { categories?: string[]; tags?: string[] },
    daySummaries: any[],
    previousSummary: SummaryAnalysisResult | null
  ): Promise<SummaryAnalysisResult> {
    // 解析日总结结果
    const subSummaries = daySummaries.map((task) => {
      try {
        return JSON.parse(task.result || '{}')
      } catch {
        return null
      }
    }).filter((s): s is SummaryAnalysisResult => s !== null)

    if (subSummaries.length === 0) {
      return this.createEmptyResult(timeRange, 'week')
    }

    // 聚合日总结数据
    const sentimentCurve = this.aggregateSentimentCurves(subSummaries)
    const noteStatistics = this.aggregateNoteStatistics(subSummaries)
    const taskCompletion = this.aggregateTaskCompletion(subSummaries)
    const timeDistribution = this.aggregateTimeDistribution(subSummaries)

    // 调用 Claude 生成分层总结
    const summary = await claudeService.generateHierarchicalSummary({
      subSummaries,
      timeRange: `${timeRange.startDate} 至 ${timeRange.endDate}`,
      level: 'week',
      previousSummary,
    })

    return {
      period: {
        mode: 'week',
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
        noteCount: noteStatistics.totalCount,
      },
      summary,
      sentimentCurve,
      noteStatistics,
      taskCompletion,
      timeDistribution,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * 周总结：基于原始笔记生成（降级）
   */
  private async createWeekFromNotes(
    timeRange: { startDate: string; endDate: string },
    filters: { categories?: string[]; tags?: string[] },
    previousSummary: SummaryAnalysisResult | null
  ): Promise<SummaryAnalysisResult> {
    const notes = await this.fetchNotes(timeRange, filters)

    if (notes.length === 0) {
      return this.createEmptyResult(timeRange, 'week')
    }

    const sentimentCurve = this.calculateSentimentCurve(notes)
    const noteStatistics = this.calculateNoteStatistics(notes)
    const taskCompletion = this.calculateTaskCompletion(notes)
    const timeDistribution = this.calculateTimeDistribution(notes)

    const summary = await claudeService.generateSummaryAnalysis({
      notes: notes.map((n) => ({
        content: n.content,
        category: n.category?.name || '未分类',
        sentiment: n.sentiment,
        importance: n.importance,
        createdAt: n.createdAt,
      })),
      timeRange: `${timeRange.startDate} 至 ${timeRange.endDate}`,
      noteCount: notes.length,
      previousSummary,
    })

    return {
      period: {
        mode: 'week',
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
        noteCount: notes.length,
      },
      summary,
      sentimentCurve,
      noteStatistics,
      taskCompletion,
      timeDistribution,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * 月总结：基于周总结生成
   */
  private async createMonthFromWeeks(
    timeRange: { startDate: string; endDate: string },
    filters: { categories?: string[]; tags?: string[] },
    weekSummaries: any[],
    previousSummary: SummaryAnalysisResult | null
  ): Promise<SummaryAnalysisResult> {
    const subSummaries = weekSummaries.map((task) => {
      try {
        return JSON.parse(task.result || '{}')
      } catch {
        return null
      }
    }).filter((s): s is SummaryAnalysisResult => s !== null)

    if (subSummaries.length === 0) {
      return this.createEmptyResult(timeRange, 'month')
    }

    const sentimentCurve = this.aggregateSentimentCurves(subSummaries)
    const noteStatistics = this.aggregateNoteStatistics(subSummaries)
    const taskCompletion = this.aggregateTaskCompletion(subSummaries)
    const timeDistribution = this.aggregateTimeDistribution(subSummaries)

    const summary = await claudeService.generateHierarchicalSummary({
      subSummaries,
      timeRange: `${timeRange.startDate} 至 ${timeRange.endDate}`,
      level: 'month',
      previousSummary,
    })

    return {
      period: {
        mode: 'month',
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
        noteCount: noteStatistics.totalCount,
      },
      summary,
      sentimentCurve,
      noteStatistics,
      taskCompletion,
      timeDistribution,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * 月总结：基于原始笔记生成（降级）
   */
  private async createMonthFromNotes(
    timeRange: { startDate: string; endDate: string },
    filters: { categories?: string[]; tags?: string[] },
    previousSummary: SummaryAnalysisResult | null
  ): Promise<SummaryAnalysisResult> {
    const notes = await this.fetchNotes(timeRange, filters)

    if (notes.length === 0) {
      return this.createEmptyResult(timeRange, 'month')
    }

    const sentimentCurve = this.calculateSentimentCurve(notes)
    const noteStatistics = this.calculateNoteStatistics(notes)
    const taskCompletion = this.calculateTaskCompletion(notes)
    const timeDistribution = this.calculateTimeDistribution(notes)

    const summary = await claudeService.generateSummaryAnalysis({
      notes: notes.map((n) => ({
        content: n.content,
        category: n.category?.name || '未分类',
        sentiment: n.sentiment,
        importance: n.importance,
        createdAt: n.createdAt,
      })),
      timeRange: `${timeRange.startDate} 至 ${timeRange.endDate}`,
      noteCount: notes.length,
      previousSummary,
    })

    return {
      period: {
        mode: 'month',
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
        noteCount: notes.length,
      },
      summary,
      sentimentCurve,
      noteStatistics,
      taskCompletion,
      timeDistribution,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * 年总结：基于月总结生成
   */
  private async createYearFromMonths(
    timeRange: { startDate: string; endDate: string },
    filters: { categories?: string[]; tags?: string[] },
    monthSummaries: any[],
    previousSummary: SummaryAnalysisResult | null
  ): Promise<SummaryAnalysisResult> {
    const subSummaries = monthSummaries.map((task) => {
      try {
        return JSON.parse(task.result || '{}')
      } catch {
        return null
      }
    }).filter((s): s is SummaryAnalysisResult => s !== null)

    if (subSummaries.length === 0) {
      return this.createEmptyResult(timeRange, 'year')
    }

    const sentimentCurve = this.aggregateSentimentCurves(subSummaries)
    const noteStatistics = this.aggregateNoteStatistics(subSummaries)
    const taskCompletion = this.aggregateTaskCompletion(subSummaries)
    const timeDistribution = this.aggregateTimeDistribution(subSummaries)

    const summary = await claudeService.generateHierarchicalSummary({
      subSummaries,
      timeRange: `${timeRange.startDate} 至 ${timeRange.endDate}`,
      level: 'year',
      previousSummary,
    })

    return {
      period: {
        mode: 'year',
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
        noteCount: noteStatistics.totalCount,
      },
      summary,
      sentimentCurve,
      noteStatistics,
      taskCompletion,
      timeDistribution,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * 年总结：基于原始笔记生成（降级）
   */
  private async createYearFromNotes(
    timeRange: { startDate: string; endDate: string },
    filters: { categories?: string[]; tags?: string[] },
    previousSummary: SummaryAnalysisResult | null
  ): Promise<SummaryAnalysisResult> {
    const notes = await this.fetchNotes(timeRange, filters)

    if (notes.length === 0) {
      return this.createEmptyResult(timeRange, 'year')
    }

    const sentimentCurve = this.calculateSentimentCurve(notes)
    const noteStatistics = this.calculateNoteStatistics(notes)
    const taskCompletion = this.calculateTaskCompletion(notes)
    const timeDistribution = this.calculateTimeDistribution(notes)

    const summary = await claudeService.generateSummaryAnalysis({
      notes: notes.map((n) => ({
        content: n.content,
        category: n.category?.name || '未分类',
        sentiment: n.sentiment,
        importance: n.importance,
        createdAt: n.createdAt,
      })),
      timeRange: `${timeRange.startDate} 至 ${timeRange.endDate}`,
      noteCount: notes.length,
      previousSummary,
    })

    return {
      period: {
        mode: 'year',
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
        noteCount: notes.length,
      },
      summary,
      sentimentCurve,
      noteStatistics,
      taskCompletion,
      timeDistribution,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * 自定义范围分析
   */
  private async createCustomAnalysis(
    timeRange: { startDate: string; endDate: string },
    filters: { categories?: string[]; tags?: string[] },
    previousSummary: SummaryAnalysisResult | null
  ): Promise<SummaryAnalysisResult> {
    const notes = await this.fetchNotes(timeRange, filters)

    if (notes.length === 0) {
      return this.createEmptyResult(timeRange, 'custom')
    }

    const sentimentCurve = this.calculateSentimentCurve(notes)
    const noteStatistics = this.calculateNoteStatistics(notes)
    const taskCompletion = this.calculateTaskCompletion(notes)
    const timeDistribution = this.calculateTimeDistribution(notes)

    const summary = await claudeService.generateSummaryAnalysis({
      notes: notes.map((n) => ({
        content: n.content,
        category: n.category?.name || '未分类',
        sentiment: n.sentiment,
        importance: n.importance,
        createdAt: n.createdAt,
      })),
      timeRange: `${timeRange.startDate} 至 ${timeRange.endDate}`,
      noteCount: notes.length,
      previousSummary,
    })

    return {
      period: {
        mode: 'custom',
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
        noteCount: notes.length,
      },
      summary,
      sentimentCurve,
      noteStatistics,
      taskCompletion,
      timeDistribution,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * 获取指定时间范围的笔记
   */
  private async fetchNotes(
    timeRange: { startDate: string; endDate: string },
    filters: { categories?: string[]; tags?: string[] }
  ): Promise<any[]> {
    const startDate = new Date(timeRange.startDate)
    const endDate = new Date(timeRange.endDate)
    endDate.setHours(23, 59, 59, 999)

    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      deletedAt: null,
    }

    if (filters.categories && filters.categories.length > 0) {
      where.category = {
        name: {
          in: filters.categories,
        },
      }
    }

    if (filters.tags && filters.tags.length > 0) {
      where.noteTags = {
        some: {
          tag: {
            name: {
              in: filters.tags,
            },
          },
        },
      }
    }

    const notes = await prisma.note.findMany({
      where,
      include: {
        category: true,
        noteTags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return notes
  }

  /**
   * 计算心情曲线
   */
  private calculateSentimentCurve(notes: any[]): SentimentCurve {
    // 按日期分组统计
    const dailyMap = new Map<string, { positive: number; neutral: number; negative: number }>()

    for (const note of notes) {
      const dateKey = new Date(note.createdAt).toISOString().split('T')[0]
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { positive: 0, neutral: 0, negative: 0 })
      }
      const counts = dailyMap.get(dateKey)!
      if (note.sentiment === 'positive') counts.positive++
      else if (note.sentiment === 'negative') counts.negative++
      else counts.neutral++
    }

    const daily: SentimentDataPoint[] = Array.from(dailyMap.entries()).map(([date, counts]) => {
      const total = counts.positive + counts.neutral + counts.negative
      return {
        date,
        positive: counts.positive,
        neutral: counts.neutral,
        negative: counts.negative,
        average: total > 0 ? (counts.positive - counts.negative) / total : 0,
      }
    }).sort((a, b) => a.date.localeCompare(b.date))

    // 计算趋势
    let trend: 'improving' | 'stable' | 'declining' = 'stable'
    if (daily.length >= 2) {
      const firstAvg = daily[0].average
      const lastAvg = daily[daily.length - 1].average
      if (lastAvg - firstAvg > 0.1) trend = 'improving'
      else if (lastAvg - firstAvg < -0.1) trend = 'declining'
    }

    const summary = this.generateSentimentSummary(daily, trend)

    return { daily, trend, summary }
  }

  /**
   * 生成心情曲线摘要
   */
  private generateSentimentSummary(daily: SentimentDataPoint[], trend: 'improving' | 'stable' | 'declining'): string {
    if (daily.length === 0) return '无数据'

    const avgSentiment = daily.reduce((sum, d) => sum + d.average, 0) / daily.length
    const trendText = trend === 'improving' ? '呈上升趋势' : trend === 'declining' ? '呈下降趋势' : '保持稳定'

    return `整体情绪${trendText}，平均情绪指数为${avgSentiment.toFixed(2)}`
  }

  /**
   * 聚合多个子总结的心情曲线
   */
  private aggregateSentimentCurves(subSummaries: SummaryAnalysisResult[]): SentimentCurve {
    const allDaily = subSummaries.flatMap((s) => s.sentimentCurve.daily)

    // 合并相同日期的数据
    const dailyMap = new Map<string, SentimentDataPoint>()
    for (const data of allDaily) {
      if (dailyMap.has(data.date)) {
        const existing = dailyMap.get(data.date)!
        existing.positive += data.positive
        existing.neutral += data.neutral
        existing.negative += data.negative
        const total = existing.positive + existing.neutral + existing.negative
        existing.average = total > 0 ? (existing.positive - existing.negative) / total : 0
      } else {
        dailyMap.set(data.date, { ...data })
      }
    }

    const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    let trend: 'improving' | 'stable' | 'declining' = 'stable'
    if (daily.length >= 2) {
      const firstAvg = daily[0].average
      const lastAvg = daily[daily.length - 1].average
      if (lastAvg - firstAvg > 0.1) trend = 'improving'
      else if (lastAvg - firstAvg < -0.1) trend = 'declining'
    }

    const summary = this.generateSentimentSummary(daily, trend)

    return { daily, trend, summary }
  }

  /**
   * 计算笔记统计
   */
  private calculateNoteStatistics(notes: any[]): NoteStatistics {
    const totalCount = notes.length

    // 分类分布
    const categoryMap = new Map<string, number>()
    for (const note of notes) {
      const cat = note.category?.name || '未分类'
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1)
    }

    const categoryDistribution: CategoryDistribution[] = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
      percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
    })).sort((a, b) => b.count - a.count)

    // 标签统计
    const tagMap = new Map<string, number>()
    for (const note of notes) {
      if (note.noteTags) {
        for (const nt of note.noteTags) {
          const tagName = nt.tag.name
          tagMap.set(tagName, (tagMap.get(tagName) || 0) + 1)
        }
      }
    }

    const topTags: TagStats[] = Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    // 重要性分布
    let high = 0, medium = 0, low = 0
    for (const note of notes) {
      const imp = note.importance || 5
      if (imp >= 7) high++
      else if (imp >= 4) medium++
      else low++
    }

    const importanceDistribution: ImportanceDistribution = { high, medium, low }

    // 字数统计（统计所有非空白字符）
    const wordCounts = notes.map((n) => n.content.replace(/\s/g, '').length)
    const total = wordCounts.reduce((sum, wc) => sum + wc, 0)
    const wordCountStats: WordCountStats = {
      total,
      average: totalCount > 0 ? Math.round(total / totalCount) : 0,
      max: Math.max(...wordCounts, 0),
      min: Math.min(...wordCounts, 0),
    }

    // 计算日均笔记数
    const dateSet = new Set(notes.map((n) => new Date(n.createdAt).toISOString().split('T')[0]))
    const dailyAverage = dateSet.size > 0 ? Math.round(totalCount / dateSet.size) : 0

    return {
      totalCount,
      dailyAverage,
      categoryDistribution,
      topTags,
      importanceDistribution,
      wordCountStats,
    }
  }

  /**
   * 聚合笔记统计
   */
  private aggregateNoteStatistics(subSummaries: SummaryAnalysisResult[]): NoteStatistics {
    let totalCount = 0
    const categoryMap = new Map<string, number>()
    const tagMap = new Map<string, number>()
    let high = 0, medium = 0, low = 0
    let totalWords = 0
    let maxWords = 0
    let minWords = Infinity
    let dailySum = 0
    let dayCount = 0

    for (const summary of subSummaries) {
      totalCount += summary.noteStatistics.totalCount

      for (const cat of summary.noteStatistics.categoryDistribution) {
        categoryMap.set(cat.category, (categoryMap.get(cat.category) || 0) + cat.count)
      }

      for (const tag of summary.noteStatistics.topTags) {
        tagMap.set(tag.tag, (tagMap.get(tag.tag) || 0) + tag.count)
      }

      high += summary.noteStatistics.importanceDistribution.high
      medium += summary.noteStatistics.importanceDistribution.medium
      low += summary.noteStatistics.importanceDistribution.low

      totalWords += summary.noteStatistics.wordCountStats.total
      maxWords = Math.max(maxWords, summary.noteStatistics.wordCountStats.max)
      minWords = Math.min(minWords, summary.noteStatistics.wordCountStats.min)

      dailySum += summary.noteStatistics.dailyAverage
      dayCount++
    }

    const categoryDistribution: CategoryDistribution[] = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
      percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
    })).sort((a, b) => b.count - a.count)

    const topTags: TagStats[] = Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    const wordCountStats: WordCountStats = {
      total: totalWords,
      average: totalCount > 0 ? Math.round(totalWords / totalCount) : 0,
      max: maxWords,
      min: minWords === Infinity ? 0 : minWords,
    }

    return {
      totalCount,
      dailyAverage: dayCount > 0 ? Math.round(dailySum / dayCount) : 0,
      categoryDistribution,
      topTags,
      importanceDistribution: { high, medium, low },
      wordCountStats,
    }
  }

  /**
   * 计算任务完成情况
   */
  private calculateTaskCompletion(notes: any[]): TaskCompletion {
    let mentioned = 0
    let completed = 0
    let pending = 0

    // 按日期分组统计趋势
    const trendMap = new Map<string, { completed: number; pending: number }>()

    for (const note of notes) {
      const content = note.content.toLowerCase()
      const isTask = /任务|待办|todo|完成|pending/.test(content)
      const isCompleted = /完成|已完成|done|finished/.test(content)

      if (isTask) {
        mentioned++

        const dateKey = new Date(note.createdAt).toISOString().split('T')[0]
        if (!trendMap.has(dateKey)) {
          trendMap.set(dateKey, { completed: 0, pending: 0 })
        }
        const trend = trendMap.get(dateKey)!

        if (isCompleted) {
          completed++
          trend.completed++
        } else {
          pending++
          trend.pending++
        }
      }
    }

    const trends: TaskCompletionTrend[] = Array.from(trendMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      mentioned,
      completed,
      pending,
      completionRate: mentioned > 0 ? Math.round((completed / mentioned) * 100) : 0,
      trends,
    }
  }

  /**
   * 聚合任务完成情况
   */
  private aggregateTaskCompletion(subSummaries: SummaryAnalysisResult[]): TaskCompletion {
    let mentioned = 0
    let completed = 0
    let pending = 0
    const allTrends: TaskCompletionTrend[] = []

    for (const summary of subSummaries) {
      mentioned += summary.taskCompletion.mentioned
      completed += summary.taskCompletion.completed
      pending += summary.taskCompletion.pending
      allTrends.push(...summary.taskCompletion.trends)
    }

    // 合并相同日期的趋势
    const trendMap = new Map<string, TaskCompletionTrend>()
    for (const trend of allTrends) {
      if (trendMap.has(trend.date)) {
        const existing = trendMap.get(trend.date)!
        existing.completed += trend.completed
        existing.pending += trend.pending
      } else {
        trendMap.set(trend.date, { ...trend })
      }
    }

    const trends = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    return {
      mentioned,
      completed,
      pending,
      completionRate: mentioned > 0 ? Math.round((completed / mentioned) * 100) : 0,
      trends,
    }
  }

  /**
   * 计算时间分布
   */
  private calculateTimeDistribution(notes: any[]): TimeDistribution {
    // 小时分布
    const hourlyMap = new Map<number, number>()
    for (const note of notes) {
      const hour = new Date(note.createdAt).getHours()
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1)
    }

    const hourly: HourlyDistribution[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourlyMap.get(hour) || 0,
    }))

    // 最活跃时段
    const maxCount = Math.max(...Array.from(hourlyMap.values()))
    const mostActiveHours = Array.from(hourlyMap.entries())
      .filter(([_, count]) => count === maxCount)
      .map(([hour]) => hour)

    // 星期分布
    const weekdayMap = new Map<number, number>()
    for (const note of notes) {
      const weekday = new Date(note.createdAt).getDay()
      weekdayMap.set(weekday, (weekdayMap.get(weekday) || 0) + 1)
    }

    const weekdayDistribution: WeekdayDistribution[] = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      count: weekdayMap.get(weekday) || 0,
    }))

    return {
      hourly,
      mostActiveHours,
      weekdayDistribution,
    }
  }

  /**
   * 聚合时间分布
   */
  private aggregateTimeDistribution(subSummaries: SummaryAnalysisResult[]): TimeDistribution {
    const hourlyMap = new Map<number, number>()
    const weekdayMap = new Map<number, number>()

    for (const summary of subSummaries) {
      for (const h of summary.timeDistribution.hourly) {
        hourlyMap.set(h.hour, (hourlyMap.get(h.hour) || 0) + h.count)
      }

      for (const w of summary.timeDistribution.weekdayDistribution) {
        weekdayMap.set(w.weekday, (weekdayMap.get(w.weekday) || 0) + w.count)
      }
    }

    const hourly: HourlyDistribution[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourlyMap.get(hour) || 0,
    }))

    const maxCount = Math.max(...Array.from(hourlyMap.values()))
    const mostActiveHours = Array.from(hourlyMap.entries())
      .filter(([_, count]) => count === maxCount)
      .map(([hour]) => hour)

    const weekdayDistribution: WeekdayDistribution[] = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      count: weekdayMap.get(weekday) || 0,
    }))

    return {
      hourly,
      mostActiveHours,
      weekdayDistribution,
    }
  }

  /**
   * 创建空结果
   */
  private createEmptyResult(
    timeRange: { startDate: string; endDate: string },
    mode: string
  ): SummaryAnalysisResult {
    return {
      period: {
        mode,
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
        noteCount: 0,
      },
      summary: {
        overview: '该时间范围内没有找到符合条件的笔记',
        keyAchievements: [],
        pendingTasks: [],
        insights: [],
      },
      sentimentCurve: {
        daily: [],
        trend: 'stable',
        summary: '无数据',
      },
      noteStatistics: {
        totalCount: 0,
        dailyAverage: 0,
        categoryDistribution: [],
        topTags: [],
        importanceDistribution: { high: 0, medium: 0, low: 0 },
        wordCountStats: { total: 0, average: 0, max: 0, min: 0 },
      },
      taskCompletion: {
        mentioned: 0,
        completed: 0,
        pending: 0,
        completionRate: 0,
        trends: [],
      },
      timeDistribution: {
        hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
        mostActiveHours: [],
        weekdayDistribution: Array.from({ length: 7 }, (_, weekday) => ({ weekday, count: 0 })),
      },
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * 获取总结笔记的 category 名称
   */
  private getSummaryCategory(mode: string): string {
    const mapping = {
      day: '日总结',
      week: '周总结',
      month: '月总结',
      year: '年总结',
      custom: '自定义总结',
    }
    return mapping[mode as keyof typeof mapping] || '总结'
  }

  /**
   * 检查指定时间范围内是否已存在总结笔记
   */
  async findExistingSummaryNote(
    mode: string,
    timeRange: { startDate: string; endDate: string }
  ): Promise<{ noteId: string; previousSummary: SummaryAnalysisResult } | null> {
    const category = this.getSummaryCategory(mode)

    const notes = await prisma.note.findMany({
      where: {
        category: {
          name: category,
        },
        date: {
          gte: new Date(timeRange.startDate),
          lte: new Date(timeRange.endDate),
        },
        deletedAt: null,
      },
      take: 1,
    })

    if (notes.length === 0) return null

    const note = notes[0]
    const metadata = JSON.parse(note.metadata || '{}')

    // 从关联的 ClaudeTask 获取旧总结
    if (metadata.summaryInfo?.taskId) {
      const task = await prisma.claudeTask.findUnique({
        where: { id: metadata.summaryInfo.taskId },
      })

      if (task?.result) {
        return {
          noteId: note.id,
          previousSummary: JSON.parse(task.result),
        }
      }
    }

    return null
  }

  /**
   * 格式化总结内容为 Markdown
   */
  private formatSummaryContent(result: SummaryAnalysisResult): string {
    const { summary, period } = result

    let content = `# ${period.mode === 'day' ? '今日总结' : period.mode === 'week' ? '本周总结' : period.mode === 'month' ? '本月总结' : '年度总结'}\n\n`
    content += `**时间范围：** ${period.startDate} ~ ${period.endDate}\n`
    content += `**笔记数量：** ${period.noteCount} 条\n\n`

    content += `## 📝 概述\n\n${summary.overview}\n\n`

    if (summary.keyAchievements.length > 0) {
      content += `## ✅ 关键成就\n\n`
      summary.keyAchievements.forEach(a => content += `- ${a}\n`)
      content += `\n`
    }

    if (summary.pendingTasks.length > 0) {
      content += `## ⏳ 待办任务\n\n`
      summary.pendingTasks.forEach(t => content += `- ${t}\n`)
      content += `\n`
    }

    if (summary.insights.length > 0) {
      content += `## 💡 感悟洞察\n\n`
      summary.insights.forEach(i => content += `- ${i}\n`)
      content += `\n`
    }

    // 添加统计数据（折叠）
    content += `## 📊 统计数据\n\n`
    content += `<details>\n<summary>点击查看详细统计</summary>\n\n`

    content += `**笔记统计：**\n`
    content += `- 总数：${result.noteStatistics.totalCount}\n`
    content += `- 日均：${result.noteStatistics.dailyAverage}\n\n`

    content += `**心情趋势：** ${result.sentimentCurve.summary}\n`
    content += `**完成率：** ${result.taskCompletion.completionRate}%\n`

    content += `\n</details>\n`

    return content
  }

  /**
   * 保存总结为笔记（新建或更新）
   */
  async saveSummaryAsNote(
    result: SummaryAnalysisResult,
    taskId: string,
    timeRange: { startDate: string; endDate: string }
  ): Promise<void> {
    const mode = result.period.mode
    const categoryName = this.getSummaryCategory(mode)

    // 确保分类存在，获取 categoryId
    let categoryId: string | null = null
    const existingCategory = await prisma.category.findUnique({
      where: { name: categoryName },
    })

    if (existingCategory) {
      categoryId = existingCategory.id
    } else {
      // 如果分类不存在，创建它
      const newCategory = await prisma.category.create({
        data: { name: categoryName },
      })
      categoryId = newCategory.id
    }

    // 检查是否已存在
    const existing = await this.findExistingSummaryNote(mode, timeRange)

    // 格式化笔记内容
    const content = this.formatSummaryContent(result)

    // 构建元数据（需要序列化为 JSON 字符串）
    const metadataObj: any = {
      summaryInfo: {
        type: 'summary',
        mode,
        timeRange,
        taskId,
        previousTaskId: existing?.noteId,
        generatedAt: result.generatedAt,
      },
    }
    const metadata = JSON.stringify(metadataObj)

    if (existing) {
      // 更新现有笔记
      await prisma.note.update({
        where: { id: existing.noteId },
        data: {
          content,
          categoryId,
          metadata,
          updatedAt: new Date(),
        },
      })
    } else {
      // 创建新笔记
      await prisma.note.create({
        data: {
          content,
          date: new Date(timeRange.startDate),
          categoryId,
          metadata,
          importance: 8,
          sentiment: 'neutral',
        },
      })
    }
  }
}

export const summaryService = new SummaryService()
