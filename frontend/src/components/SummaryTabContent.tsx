'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Calendar, Filter, Trash2, Sparkles, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SummaryMenu } from './SummaryMenu'
import { summariesApi } from '@/lib/api'
import { Summary, SummaryAnalyzerPayload, TimelineGroup, TimelineResponse } from '@daily-note/shared'

interface SummaryTabContentProps {
  onAnalyze: (payload: SummaryAnalyzerPayload) => Promise<{ taskId: string } | null>
  onSwitchToResult: (taskId: string) => void
}

type SummaryMode = 'day' | 'week' | 'month' | 'year' | 'all'

/**
 * 智能分析标签页内容
 * 整合了智能总结和历史记录功能
 * - 顶部：模式筛选按钮组 + 新建分析按钮
 * - 下方：按年份分组的历史分析列表
 */
export function SummaryTabContent({
  onAnalyze,
  onSwitchToResult,
}: SummaryTabContentProps) {
  const [modeFilter, setModeFilter] = useState<SummaryMode>('all')
  const [groups, setGroups] = useState<TimelineGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  /**
   * 加载时间线数据
   */
  const loadTimeline = async () => {
    setLoading(true)
    setError(null)

    try {
      const params: {
        mode?: string
        groupBy: 'month'
        limit: number
      } = {
        groupBy: 'month',
        limit: 100,
      }

      // 只有在选择了具体模式时才传递 mode 参数
      if (modeFilter !== 'all') {
        params.mode = modeFilter
      }

      const response = await summariesApi.timeline(params)
      if (response.data) {
        setGroups(response.data.groups)
      }
    } catch (err) {
      console.error('Failed to load timeline:', err)
      setError('加载分析历史失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 初始加载数据及筛选变化时重新加载
   */
  useEffect(() => {
    loadTimeline()
  }, [modeFilter])

  /**
   * 处理总结分析请求
   * 发起分析后自动切换到总结结果标签页
   */
  const handleSummaryAnalyze = async (payload: SummaryAnalyzerPayload) => {
    const response = await onAnalyze(payload)

    if (response) {
      onSwitchToResult(response.taskId)
      // 分析完成后刷新列表
      loadTimeline()
    }
  }

  /**
   * 删除总结
   */
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条分析吗？')) return

    try {
      await summariesApi.deleteRecord(id)
      loadTimeline()
    } catch (err) {
      console.error('Failed to delete summary:', err)
      alert('删除失败')
    }
  }

  /**
   * 点击分析项，查看详情
   */
  const handleSummaryClick = (summary: Summary) => {
    onSwitchToResult(summary.taskId)
  }

  /**
   * 按年份分组总结（从月份分组中提取）
   */
  const groupByYear = (groups: TimelineGroup[]): Record<string, TimelineGroup[]> => {
    const yearGroups: Record<string, TimelineGroup[]> = {}

    for (const group of groups) {
      // 从 "2024-01" 格式中提取年份
      const year = group.key.substring(0, 4)
      if (!yearGroups[year]) {
        yearGroups[year] = []
      }
      yearGroups[year].push(group)
    }

    return yearGroups
  }

  /**
   * 格式化日期范围显示
   */
  function formatDateRange(startDate: Date, endDate: Date): string {
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start.toDateString() === end.toDateString()) {
      return formatDate(startDate)
    }

    if (start.getFullYear() === end.getFullYear()) {
      if (start.getMonth() === end.getMonth()) {
        return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getDate()}日`
      }
      return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`
    }

    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  }

  function formatDate(date: Date): string {
    const d = new Date(date)
    const now = new Date()
    const isThisYear = d.getFullYear() === now.getFullYear()

    if (isThisYear) {
      return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    }

    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  function getModeName(mode: string): string {
    const names = {
      day: '日',
      week: '周',
      month: '月',
      year: '年',
      custom: '自定义',
    }
    return names[mode as keyof typeof names] || mode
  }

  function getModeColor(mode: string): string {
    const colors = {
      day: 'bg-time-mode-day',
      week: 'bg-time-mode-week',
      month: 'bg-time-mode-month',
      year: 'bg-time-mode-year',
      custom: 'bg-time-mode-custom',
    }
    return colors[mode as keyof typeof colors] || 'bg-time-mode-custom'
  }

  /**
   * 渲染模式筛选按钮组
   */
  const renderModeFilters = () => (
    <div className="flex items-center gap-2">
      {[
        { value: 'all' as const, label: '全部' },
        { value: 'day' as const, label: '日' },
        { value: 'week' as const, label: '周' },
        { value: 'month' as const, label: '月' },
        { value: 'year' as const, label: '年' },
      ].map((mode) => (
        <Button
          key={mode.value}
          variant={modeFilter === mode.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => setModeFilter(mode.value)}
          className="h-8"
        >
          {mode.label}
        </Button>
      ))}
    </div>
  )

  /**
   * 渲染总结项
   */
  const renderSummaryItem = (summary: Summary) => (
    <div
      key={summary.id}
      className="flex items-start gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
      onClick={() => handleSummaryClick(summary)}
    >
      <div className={`w-1 h-full rounded-full ${getModeColor(summary.mode)}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className="text-xs">
            {getModeName(summary.mode)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDateRange(summary.startDate, summary.endDate)}
          </span>
        </div>

        <p className="text-xs font-medium line-clamp-2 mb-1">{summary.overview}</p>

        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{summary.noteCount} 条笔记</span>
          <span>{new Date(summary.generatedAt).toLocaleDateString('zh-CN')}</span>
        </div>
      </div>

      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleDelete(summary.id)}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    </div>
  )

  /**
   * 渲染加载状态
   */
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
      <p className="text-xs text-muted-foreground">加载中...</p>
    </div>
  )

  /**
   * 渲染错误状态
   */
  const renderError = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <p className="text-xs text-destructive mb-3">{error}</p>
      <Button variant="outline" size="sm" onClick={loadTimeline} className="h-7">
        重试
      </Button>
    </div>
  )

  /**
   * 渲染空状态
   */
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <Sparkles className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-xs text-muted-foreground mb-4">
        {modeFilter === 'all' ? '暂无分析历史' : `暂无${getModeName(modeFilter)}分析`}
      </p>
      <div className="w-full max-w-xs">
        <SummaryMenu onAnalyze={handleSummaryAnalyze} />
      </div>
    </div>
  )

  // 将月份分组按年份重新组织
  const yearGroups = groupByYear(groups)
  const years = Object.keys(yearGroups).sort((a, b) => parseInt(b) - parseInt(a))

  // 计算总数
  const totalCount = groups.reduce((sum, group) => sum + group.summaries.length, 0)

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">智能分析</h2>
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalCount}
            </Badge>
          )}
        </div>

        {/* 新建分析按钮 */}
        <div className="flex items-center gap-2">
          <SummaryMenu onAnalyze={handleSummaryAnalyze} />
        </div>
      </div>

      {/* 模式筛选按钮组 */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        {renderModeFilters()}
      </div>

      {/* 分析列表 */}
      <ScrollArea className="flex-1">
        {loading ? (
          renderLoading()
        ) : error ? (
          renderError()
        ) : totalCount === 0 ? (
          renderEmpty()
        ) : (
          <div className="p-3 space-y-4">
            {years.map((year) => (
              <div key={year}>
                <h3 className="text-xs font-semibold mb-2 sticky top-0 bg-background py-1.5">
                  {year}年
                </h3>
                <div className="space-y-2">
                  {yearGroups[year].map((monthGroup) => (
                    <div key={monthGroup.key}>
                      <div className="flex items-center gap-2 mb-2 text-[10px] text-muted-foreground">
                        <span className="font-semibold">{monthGroup.label}</span>
                        <span>{monthGroup.summaries.length} 条</span>
                      </div>
                      <div className="space-y-2">
                        {monthGroup.summaries.map((summary) => renderSummaryItem(summary))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
