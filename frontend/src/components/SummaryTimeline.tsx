'use client'

/**
 * 总结时间线组件
 * 按时间维度聚合展示总结记录，支持日/周/月/年模式切换
 */
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Calendar, FileText, CheckCircle2, Clock } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Summary, TodoCompletionStats, TimelineGroup, TimelineResponse } from '@daily-note/shared'
import { summariesApi } from '@/lib/api'

type SummaryMode = 'all' | 'day' | 'week' | 'month' | 'year'
type TimelineGroupBy = 'year' | 'month'

interface SummaryTimelineProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectSummary?: (summary: Summary) => void
}

export function SummaryTimeline({ open, onOpenChange, onSelectSummary }: SummaryTimelineProps) {
  const [mode, setMode] = useState<SummaryMode>('all')
  const [groupBy, setGroupBy] = useState<TimelineGroupBy>('month')
  const [timelineData, setTimelineData] = useState<TimelineGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // 获取时间线数据
  useEffect(() => {
    if (!open) return

    const fetchTimeline = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await summariesApi.timeline({
          mode: mode === 'all' ? undefined : mode,
          groupBy,
          limit: 100,
        })
        if (response.data) {
          const data = response.data as TimelineResponse
          setTimelineData(data.groups)
        }
      } catch (err) {
        console.error('Failed to fetch timeline:', err)
        setError('获取时间线数据失败')
      } finally {
        setLoading(false)
      }
    }

    fetchTimeline()
  }, [open, mode, groupBy])

  // 切换分组折叠状态
  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  // 格式化日期
  const formatDate = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  // 格式化日期范围
  const formatDateRange = (startDate: Date, endDate: Date) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const startStr = start.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    const endStr = end.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    return startStr === endStr ? startStr : `${startStr} ~ ${endStr}`
  }

  // 获取模式标签
  const getModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      day: '日',
      week: '周',
      month: '月',
      year: '年',
      custom: '自定义',
    }
    return labels[mode] || mode
  }

  // 获取模式颜色
  const getModeColor = (mode: string) => {
    const colors: Record<string, string> = {
      day: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      week: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      month: 'bg-green-500/10 text-green-500 border-green-500/20',
      year: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      custom: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    }
    return colors[mode] || colors.custom
  }

  // 渲染 Todo 统计
  const renderTodoStats = (todoStats: TodoCompletionStats) => {
    if (todoStats.total === 0) return null

    return (
      <div className="mt-3 rounded-lg bg-muted/30 p-3">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">待办完成情况</span>
          <span className="font-medium text-foreground">
            {todoStats.completed}/{todoStats.total}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${todoStats.completionRate}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs mt-2 text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            已完成 {todoStats.completed}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-orange-500" />
            待完成 {todoStats.pending}
          </span>
          <span>{todoStats.completionRate}%</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`
      fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-background border-l border-border
      transition-transform duration-300 ease-in-out
      ${open ? 'translate-x-0' : 'translate-x-full'}
    `}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          总结时间线
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
        >
          ✕
        </Button>
      </div>

      {/* 筛选器 */}
      <div className="p-4 border-b border-border space-y-3">
        {/* 模式切换 */}
        <div className="flex gap-2">
          {(['all', 'day', 'week', 'month', 'year'] as SummaryMode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode(m)}
              className="flex-1"
            >
              {m === 'all' ? '全部' : getModeLabel(m)}
            </Button>
          ))}
        </div>

        {/* 分组方式 */}
        <div className="flex gap-2">
          <Button
            variant={groupBy === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGroupBy('month')}
            className="flex-1"
          >
            按月分组
          </Button>
          <Button
            variant={groupBy === 'year' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGroupBy('year')}
            className="flex-1"
          >
            按年分组
          </Button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="h-[calc(100vh-180px)]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">加载中...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : timelineData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <FileText className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">暂无总结记录</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {timelineData.map((group) => {
                const isCollapsed = collapsedGroups.has(group.key)

                return (
                  <div key={group.key} className="border border-border rounded-lg overflow-hidden">
                    {/* 分组头部 */}
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-medium">{group.label}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {group.summaries.length} 条
                        </Badge>
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* 分组内容 */}
                    {!isCollapsed && (
                      <div className="divide-y divide-border">
                        {group.summaries.map((summary) => (
                          <button
                            key={summary.id}
                            onClick={() => {
                              onSelectSummary?.(summary)
                              onOpenChange(false)
                            }}
                            className="w-full p-4 text-left hover:bg-muted/30 transition-colors"
                          >
                            {/* 顶部信息 */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <Badge className={getModeColor(summary.mode)}>
                                {getModeLabel(summary.mode)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDateRange(summary.startDate, summary.endDate)}
                              </span>
                            </div>

                            {/* 概述 */}
                            <p className="text-sm text-foreground/90 line-clamp-2 mb-2">
                              {summary.overview}
                            </p>

                            {/* 统计信息 */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                              <span>{summary.noteCount} 条笔记</span>
                              {summary.achievements.length > 0 && (
                                <span>{summary.achievements.length} 个成就</span>
                              )}
                              {summary.insights.length > 0 && (
                                <span>{summary.insights.length} 条洞察</span>
                              )}
                            </div>

                            {/* Todo 统计 */}
                            {renderTodoStats(summary.todoStats)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
