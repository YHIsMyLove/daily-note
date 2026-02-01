/**
 * 周总结调度器服务
 *
 * 功能：
 * - 每周五自动触发周总结任务
 * - 周总结范围：本周一至当前周五
 * - 防止重复触发（跟踪上次执行日期）
 * - 使用定时器定期检查是否到达周五
 */
import { queueManager } from '../queue/queue-manager'
import { prisma } from '../database/prisma'
import { SummaryAnalyzerPayload } from '@daily-note/shared'

/**
 * 调度器状态
 */
export interface SchedulerStatus {
  isRunning: boolean
  lastCheckTime: Date | null
  lastRunDate: string | null
  nextRunTime: Date | null
}

/**
 * 调度器配置
 */
export interface SchedulerConfig {
  checkInterval: number        // 检查间隔（毫秒）
  priority: number             // 任务优先级
  targetDayOfWeek: number      // 目标星期几（0=周日, 1=周一, ..., 5=周五, 6=周六）
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: SchedulerConfig = {
  checkInterval: 60 * 60 * 1000,  // 每小时检查一次
  priority: 3,                     // 中等优先级
  targetDayOfWeek: 5,              // 周五 (5)
}

export class SchedulerService {
  private config: SchedulerConfig
  private isRunning: boolean = false
  private checkTimer: NodeJS.Timeout | null = null
  private lastRunDate: string | null = null

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 启动调度器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Scheduler] Scheduler is already running')
      return
    }

    this.isRunning = true
    console.log('[Scheduler] Starting weekly summary scheduler...')

    // 加载上次执行日期
    await this.loadLastRunDate()

    // 立即执行一次检查
    await this.checkAndTrigger()

    // 设置定时器
    this.checkTimer = setInterval(() => {
      this.checkAndTrigger().catch((error) => {
        console.error('[Scheduler] Error during scheduled check:', error)
      })
    }, this.config.checkInterval)

    console.log('[Scheduler] Scheduler started (checking every hour)')
  }

  /**
   * 停止调度器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }

    console.log('[Scheduler] Scheduler stopped')
  }

  /**
   * 检查是否需要触发周总结
   */
  private async checkAndTrigger(): Promise<void> {
    const now = new Date()
    const dayOfWeek = now.getDay()

    // 检查是否是周五
    if (dayOfWeek !== this.config.targetDayOfWeek) {
      return
    }

    // 获取本周五的日期字符串
    const todayStr = now.toISOString().split('T')[0]

    // 检查今天是否已经执行过
    if (this.lastRunDate === todayStr) {
      return
    }

    console.log(`[Scheduler] It's Friday (${todayStr}), triggering weekly summary...`)

    // 触发周总结
    try {
      await this.triggerWeeklySummary()
      this.lastRunDate = todayStr
      await this.saveLastRunDate(todayStr)
      console.log(`[Scheduler] Weekly summary triggered successfully for ${todayStr}`)
    } catch (error) {
      console.error('[Scheduler] Failed to trigger weekly summary:', error)
    }
  }

  /**
   * 触发周总结任务
   */
  private async triggerWeeklySummary(): Promise<void> {
    const now = new Date()

    // 计算本周一（周的开始）
    const monday = new Date(now)
    const dayOfWeek = now.getDay()
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    monday.setDate(monday.getDate() - daysFromMonday)
    monday.setHours(0, 0, 0, 0)

    // 设置结束时间为当前时间
    const endTime = new Date(now)
    endTime.setHours(23, 59, 59, 999)

    // 检查本周是否已有周总结
    const existingSummary = await prisma.summary.findFirst({
      where: {
        mode: 'week',
        startDate: {
          gte: monday,
        },
      },
    })

    if (existingSummary) {
      console.log('[Scheduler] Weekly summary already exists for this week, skipping')
      return
    }

    // 构建任务载荷
    const payload: SummaryAnalyzerPayload = {
      timeRange: {
        mode: 'week',
        startDate: monday.toISOString(),
        endDate: endTime.toISOString(),
      },
      filters: {},
    }

    // 将任务加入队列
    const task = await queueManager.enqueue(
      'summary_analyzer',
      payload,
      null,  // 周总结不关联特定笔记
      this.config.priority
    )

    console.log(`[Scheduler] Weekly summary task enqueued: ${task.id}`)
  }

  /**
   * 从数据库加载上次执行日期
   */
  private async loadLastRunDate(): Promise<void> {
    try {
      // 查找最近一个周总结任务
      const lastWeeklyTask = await prisma.claudeTask.findFirst({
        where: {
          type: 'summary_analyzer',
          status: 'COMPLETED',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      })

      if (lastWeeklyTask) {
        try {
          const payload = JSON.parse(lastWeeklyTask.payload)
          if (payload.timeRange?.mode === 'week') {
            // 使用该任务的日期作为上次执行日期
            const taskDate = new Date(lastWeeklyTask.createdAt)
            this.lastRunDate = taskDate.toISOString().split('T')[0]
          }
        } catch {
          // 忽略解析错误
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error loading last run date:', error)
    }
  }

  /**
   * 保存执行日期到数据库（通过创建记录）
   */
  private async saveLastRunDate(date: string): Promise<void> {
    // 日期已保存在 lastRunDate 中
    // 实际的持久化是通过 ClaudeTask 表中的任务记录完成的
    // 这里只更新内存状态
  }

  /**
   * 获取调度器状态
   */
  getStatus(): SchedulerStatus {
    const now = new Date()
    const nextRunTime = new Date(now)
    nextRunTime.setDate(nextRunTime.getDate() + (this.config.targetDayOfWeek - now.getDay() + 7) % 7)
    nextRunTime.setHours(0, 0, 0, 0)

    return {
      isRunning: this.isRunning,
      lastCheckTime: now,
      lastRunDate: this.lastRunDate,
      nextRunTime,
    }
  }

  /**
   * 手动触发周总结（用于测试）
   *
   * @param startDate - 可选的自定义开始日期
   * @param endDate - 可选的自定义结束日期
   */
  async manualTrigger(startDate?: Date, endDate?: Date): Promise<void> {
    const now = new Date()

    // 如果没有提供日期，使用本周一至现在
    const start = startDate || (() => {
      const monday = new Date(now)
      const dayOfWeek = now.getDay()
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      monday.setDate(monday.getDate() - daysFromMonday)
      monday.setHours(0, 0, 0, 0)
      return monday
    })()

    const end = endDate || (() => {
      const endTime = new Date(now)
      endTime.setHours(23, 59, 59, 999)
      return endTime
    })()

    // 检查是否已存在
    const existingSummary = await prisma.summary.findFirst({
      where: {
        mode: 'week',
        startDate: {
          gte: start,
          lte: end,
        },
      },
    })

    if (existingSummary) {
      throw new Error('Weekly summary already exists for this period')
    }

    // 构建任务载荷
    const payload: SummaryAnalyzerPayload = {
      timeRange: {
        mode: 'week',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      filters: {},
    }

    // 将任务加入队列
    const task = await queueManager.enqueue(
      'summary_analyzer',
      payload,
      null,
      this.config.priority
    )

    console.log(`[Scheduler] Manual weekly summary triggered: ${task.id}`)
  }
}

/**
 * 导出单例
 */
export const schedulerService = new SchedulerService()
