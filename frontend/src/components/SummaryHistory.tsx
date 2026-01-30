'use client'

/**
 * 总结历史组件
 *
 * 展示所有历史总结，支持按时间、模式筛选
 */
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Calendar, Filter, Trash2, Eye, GitCompareArrows } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { summariesApi } from '@/lib/api'
import { Summary, SummaryHistoryFilters } from '@daily-note/shared'
import { SummaryResultSheet } from './SummaryResultSheet'
import { SummaryComparison } from './SummaryComparison'
import { toast } from 'sonner'

interface SummaryHistoryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 格式化日期显示
 */
function formatDate(date: Date): string {
  const d = new Date(date)
  const now = new Date()
  const isThisYear = d.getFullYear() === now.getFullYear()

  if (isThisYear) {
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * 格式化日期范围显示
 */
function formatDateRange(startDate: Date, endDate: Date): string {
  const start = new Date(startDate)
  const end = new Date(endDate)

  // 如果是同一天
  if (start.toDateString() === end.toDateString()) {
    return formatDate(startDate)
  }

  // 如果是同一年
  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      // 同月：1月1日 - 5日
      return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getDate()}日`
    }
    // 不同月：1月1日 - 2月5日
    return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`
  }

  // 不同年：2023年1月1日 - 2024年2月5日
  return `${formatDate(startDate)} - ${formatDate(endDate)}`
}

/**
 * 获取模式显示名称
 */
function getModeName(mode: string): string {
  const names = {
    day: '日总结',
    week: '周总结',
    month: '月总结',
    year: '年总结',
    custom: '自定义',
  }
  return names[mode as keyof typeof names] || mode
}

/**
 * 获取模式颜色
 */
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

export function SummaryHistory({ open, onOpenChange }: SummaryHistoryProps) {
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<SummaryHistoryFilters>({})
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])

  /**
   * 加载总结历史
   */
  const loadSummaries = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await summariesApi.history(filters)
      if (response.data) {
        setSummaries(response.data)
      }
    } catch (err) {
      console.error('Failed to load summary history:', err)
      setError('加载总结历史失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 组件打开时加载数据
   */
  useEffect(() => {
    if (open) {
      loadSummaries()
    }
  }, [open, filters])

  /**
   * 查看总结详情
   */
  const handleViewDetail = (summary: Summary) => {
    setSelectedSummary(summary)
    setShowDetail(true)
  }

  /**
   * 删除总结
   */
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条总结吗？')) return

    try {
      await summariesApi.deleteRecord(id)
      loadSummaries()
    } catch (err) {
      console.error('Failed to delete summary:', err)
      toast.error('删除失败')
    }
  }

  /**
   * 切换对比模式
   */
  const toggleCompareMode = () => {
    setCompareMode(!compareMode)
    setSelectedForCompare([])
  }

  /**
   * 选择/取消选择对比项
   */
  const toggleSelectForCompare = (id: string) => {
    if (selectedForCompare.includes(id)) {
      setSelectedForCompare(selectedForCompare.filter(sid => sid !== id))
    } else {
      if (selectedForCompare.length >= 2) {
        toast.error('最多只能选择2个总结进行对比')
        return
      }
      setSelectedForCompare([...selectedForCompare, id])
    }
  }

  /**
   * 执行对比
   */
  const handleCompare = () => {
    if (selectedForCompare.length !== 2) {
      toast.error('请选择2个总结进行对比')
      return
    }
    // 对比功能将在 SummaryComparison 组件中实现
  }

  /**
   * 按年份分组总结
   */
  const groupByYear = (summaries: Summary[]): Record<string, Summary[]> => {
    const groups: Record<string, Summary[]> = {}

    for (const summary of summaries) {
      const year = new Date(summary.startDate).getFullYear()
      if (!groups[year]) {
        groups[year] = []
      }
      groups[year].push(summary)
    }

    return groups
  }

  /**
   * 渲染筛选器
   */
  const renderFilters = () => (
    <div className="p-4 border-b space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">筛选条件</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters({})}
        >
          清除
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">总结模式</label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'day', label: '日' },
            { value: 'week', label: '周' },
            { value: 'month', label: '月' },
            { value: 'year', label: '年' },
            { value: 'custom', label: '自定义' },
          ].map((mode) => (
            <Button
              key={mode.value}
              variant={filters.mode === mode.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (filters.mode === mode.value) {
                  setFilters({ ...filters, mode: undefined })
                } else {
                  setFilters({ ...filters, mode: mode.value })
                }
              }}
            >
              {mode.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">年份</label>
        <div className="flex flex-wrap gap-2">
          {[
            new Date().getFullYear(),
            new Date().getFullYear() - 1,
            new Date().getFullYear() - 2,
          ].map((year) => (
            <Button
              key={year}
              variant={filters.year === year ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (filters.year === year) {
                  setFilters({ ...filters, year: undefined })
                } else {
                  setFilters({ ...filters, year })
                }
              }}
            >
              {year}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )

  /**
   * 渲染对比模式操作栏
   */
  const renderCompareBar = () => (
    <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950/20 border-b flex items-center justify-between">
      <div className="flex items-center gap-2">
        <GitCompareArrows className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-medium">对比模式</span>
        <Badge variant="secondary">
          已选择 {selectedForCompare.length}/2
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleCompareMode}
        >
          取消
        </Button>
        <Button
          variant="default"
          size="sm"
          disabled={selectedForCompare.length !== 2}
          onClick={handleCompare}
        >
          开始对比
        </Button>
      </div>
    </div>
  )

  /**
   * 渲染总结项
   */
  const renderSummaryItem = (summary: Summary) => (
    <div
      key={summary.id}
      className={`flex items-start gap-3 p-4 hover:bg-muted/50 rounded-lg transition-colors ${
        compareMode && selectedForCompare.includes(summary.id)
          ? 'bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-500'
          : compareMode
          ? 'border-2 border-transparent cursor-pointer'
          : ''
      }`}
      onClick={() => compareMode && toggleSelectForCompare(summary.id)}
    >
      <div className={`w-1 h-full rounded-full ${getModeColor(summary.mode)}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className="text-xs">
            {getModeName(summary.mode)}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {formatDateRange(summary.startDate, summary.endDate)}
          </span>
          {compareMode && selectedForCompare.includes(summary.id) && (
            <Badge variant="default" className="text-xs">
              已选择
            </Badge>
          )}
        </div>

        <p className="text-sm font-medium line-clamp-2 mb-1">
          {summary.overview}
        </p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{summary.noteCount} 条笔记</span>
          <span>
            {new Date(summary.generatedAt).toLocaleDateString('zh-CN')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleViewDetail(summary)}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => handleDelete(summary.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  /**
   * 渲染加载状态
   */
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
      <p className="text-sm text-muted-foreground">加载中...</p>
    </div>
  )

  /**
   * 渲染错误状态
   */
  const renderError = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <p className="text-sm text-destructive mb-4">{error}</p>
      <Button variant="outline" size="sm" onClick={loadSummaries}>
        重试
      </Button>
    </div>
  )

  /**
   * 渲染空状态
   */
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-sm text-muted-foreground">暂无总结历史</p>
    </div>
  )

  const groupedSummaries = groupByYear(summaries)
  const years = Object.keys(groupedSummaries).sort((a, b) => parseInt(b) - parseInt(a))

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>总结历史</SheetTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleCompareMode}
              >
                <GitCompareArrows className="h-4 w-4 mr-2" />
                {compareMode ? '取消对比' : '对比'}
              </Button>
            </div>
          </SheetHeader>

          <div className="mt-6">
            {/* 对比模式操作栏 */}
            {compareMode && renderCompareBar()}

            {/* 筛选按钮 */}
            <div className="mb-4">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                筛选条件
                {showFilters ? (
                  <ChevronDown className="h-4 w-4 ml-auto" />
                ) : (
                  <ChevronRight className="h-4 w-4 ml-auto" />
                )}
              </Button>
            </div>

            {/* 筛选器 */}
            {showFilters && renderFilters()}

            {/* 总结列表 */}
            <ScrollArea className="h-[calc(100vh-240px)]">
              {loading ? (
                renderLoading()
              ) : error ? (
                renderError()
              ) : summaries.length === 0 ? (
                renderEmpty()
              ) : (
                <div className="space-y-6">
                  {years.map((year) => (
                    <div key={year}>
                      <h3 className="text-sm font-semibold mb-3 sticky top-0 bg-background py-2">
                        {year}年
                      </h3>
                      <div className="space-y-2">
                        {groupedSummaries[year].map((summary) => renderSummaryItem(summary))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* 总结详情 */}
      {selectedSummary && (
        <SummaryResultSheet
          open={showDetail}
          onOpenChange={setShowDetail}
          taskId={selectedSummary.taskId}
        />
      )}

      {/* 总结对比 */}
      {selectedForCompare.length === 2 && (
        <SummaryComparison
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedForCompare([])
              setCompareMode(false)
            }
          }}
          baseSummaryId={selectedForCompare[0]}
          compareSummaryId={selectedForCompare[1]}
        />
      )}
    </>
  )
}
