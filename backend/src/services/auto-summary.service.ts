/**
 * 自动总结服务
 *
 * 负责检测缺失的总结并触发自动分析：
 * - 检测哪些日期有笔记但没有对应的总结
 * - 在服务启动时触发昨天的自动分析
 * - 支持检测多天内缺失的总结
 * - 使用队列管理器将任务加入队列
 */
import { prisma } from '../database/prisma'
import { queueManager } from '../queue/queue-manager'
import { SummaryAnalyzerPayload } from '@daily-note/shared'

/**
 * 未总结日期信息
 */
export interface UnsummarizedDate {
  date: string           // ISO 日期字符串 (YYYY-MM-DD)
  noteCount: number      // 当天的笔记数量
  hasNotes: boolean      // 是否有笔记
}

/**
 * 自动分析结果
 */
export interface AutoAnalysisResult {
  triggered: boolean                      // 是否触发了分析
  date: string | null                     // 触发分析的日期
  taskId: string | null                   // 创建的任务 ID
  message: string                         // 结果消息
}

/**
 * 自动总结配置
 */
export interface AutoSummaryConfig {
  lookbackDays: number                    // 向前查找的天数
  priority: number                        // 任务优先级
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: AutoSummaryConfig = {
  lookbackDays: 7,
  priority: 3,  // 中等优先级
}

export class AutoSummaryService {
  private config: AutoSummaryConfig

  constructor(config: Partial<AutoSummaryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 检测指定日期范围内未总结的日期
   *
   * @param days - 向前查找的天数（从昨天开始）
   * @returns 未总结的日期列表
   */
  async detectUnsummarizedDates(days: number = this.config.lookbackDays): Promise<UnsummarizedDate[]> {
    const results: UnsummarizedDate[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 遍历过去 N 天（从昨天开始）
    for (let i = 1; i <= days; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      // 检查这一天是否有笔记
      const dayStart = new Date(date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(date)
      dayEnd.setHours(23, 59, 59, 999)

      const noteCount = await prisma.note.count({
        where: {
          createdAt: {
            gte: dayStart,
            lte: dayEnd,
          },
          deletedAt: null,
        },
      })

      // 如果没有笔记，跳过
      if (noteCount === 0) {
        results.push({
          date: dateStr,
          noteCount: 0,
          hasNotes: false,
        })
        continue
      }

      // 检查这一天是否已有总结
      const existingSummary = await prisma.summary.findFirst({
        where: {
          mode: 'day',
          startDate: dayStart,
        },
      })

      // 如果有笔记但没有总结，记录为未总结
      if (!existingSummary) {
        results.push({
          date: dateStr,
          noteCount,
          hasNotes: true,
        })
      }
    }

    return results
  }

  /**
   * 触发最近一个未总结日期的自动分析
   *
   * @returns 自动分析结果
   */
  async triggerAutoAnalysis(): Promise<AutoAnalysisResult> {
    // 获取未总结的日期
    const unsummarized = await this.detectUnsummarizedDates()

    // 筛选出有笔记但未总结的日期
    const datesNeedingSummary = unsummarized.filter((d) => d.hasNotes)

    if (datesNeedingSummary.length === 0) {
      return {
        triggered: false,
        date: null,
        taskId: null,
        message: '没有需要自动总结的日期',
      }
    }

    // 取最近的日期（数组已按时间倒序）
    const targetDate = datesNeedingSummary[0]

    // 构建时间范围（单日）
    const startDate = new Date(targetDate.date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(targetDate.date)
    endDate.setHours(23, 59, 59, 999)

    // 构建任务载荷
    const payload: SummaryAnalyzerPayload = {
      timeRange: {
        mode: 'day',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      filters: {},
    }

    // 将任务加入队列
    const task = await queueManager.enqueue(
      'summary_analyzer',
      payload,
      null,  // 总结任务不关联特定笔记
      this.config.priority
    )

    return {
      triggered: true,
      date: targetDate.date,
      taskId: task.id,
      message: `已为 ${targetDate.date} 创建自动总结任务（${targetDate.noteCount} 条笔记）`,
    }
  }

  /**
   * 检查指定日期是否需要总结
   *
   * @param date - 日期字符串 (YYYY-MM-DD)
   * @returns 是否需要总结
   */
  async needsSummary(date: string): Promise<boolean> {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    // 检查是否有笔记
    const noteCount = await prisma.note.count({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
        deletedAt: null,
      },
    })

    if (noteCount === 0) {
      return false
    }

    // 检查是否已有总结
    const existingSummary = await prisma.summary.findFirst({
      where: {
        mode: 'day',
        startDate: dayStart,
      },
    })

    return !existingSummary
  }

  /**
   * 获取指定日期范围的总结统计
   *
   * @param days - 天数
   * @returns 统计信息
   */
  async getSummaryStats(days: number = this.config.lookbackDays): Promise<{
    total: number
    summarized: number
    unsummarized: number
    dates: UnsummarizedDate[]
  }> {
    const dates = await this.detectUnsummarizedDates(days)
    const withNotes = dates.filter((d) => d.hasNotes)
    const withoutNotes = dates.filter((d) => !d.hasNotes)

    return {
      total: dates.length,
      summarized: withoutNotes.filter((d) => !d.hasNotes).length + (dates.length - withNotes.length - withoutNotes.length),
      unsummarized: withNotes.length,
      dates,
    }
  }

  /**
   * 触发指定日期的总结
   *
   * @param date - 日期字符串 (YYYY-MM-DD)
   * @returns 任务信息
   */
  async triggerSummaryForDate(date: string): Promise<AutoAnalysisResult> {
    const needs = await this.needsSummary(date)

    if (!needs) {
      return {
        triggered: false,
        date,
        taskId: null,
        message: `日期 ${date} 不需要总结（无笔记或已总结）`,
      }
    }

    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    const payload: SummaryAnalyzerPayload = {
      timeRange: {
        mode: 'day',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      filters: {},
    }

    const task = await queueManager.enqueue(
      'summary_analyzer',
      payload,
      null,
      this.config.priority
    )

    return {
      triggered: true,
      date,
      taskId: task.id,
      message: `已为 ${date} 创建总结任务`,
    }
  }
}

/**
 * 导出单例
 */
export const autoSummaryService = new AutoSummaryService()
