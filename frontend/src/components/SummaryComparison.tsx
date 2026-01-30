'use client'

/**
 * 总结对比组件
 *
 * 对比两个总结的差异
 */
import { useState, useEffect } from 'react'
import { ArrowRight, TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { summariesApi } from '@/lib/api'
import { Summary, SummaryComparison as SummaryComparisonType } from '@daily-note/shared'

interface SummaryComparisonProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  baseSummaryId: string | null
  compareSummaryId: string | null
}

/**
 * 格式化日期显示
 */
function formatDate(date: Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * 获取情绪趋势图标
 */
function getSentimentTrendIcon(trend: string) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="h-4 w-4 text-green-500" />
    case 'declining':
      return <TrendingDown className="h-4 w-4 text-red-500" />
    default:
      return <Minus className="h-4 w-4 text-gray-500" />
  }
}

/**
 * 获取情绪趋势文字
 */
function getSentimentTrendText(trend: string): string {
  const map = {
    improving: '上升',
    stable: '稳定',
    declining: '下降',
  }
  return map[trend as keyof typeof map] || trend
}

export function SummaryComparison({
  open,
  onOpenChange,
  baseSummaryId,
  compareSummaryId,
}: SummaryComparisonProps) {
  const [comparison, setComparison] = useState<SummaryComparisonType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 加载对比数据
   */
  useEffect(() => {
    if (!open || !baseSummaryId || !compareSummaryId) return

    const loadComparison = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await summariesApi.compare(baseSummaryId, compareSummaryId)
        if (response.data) {
          setComparison(response.data)
        }
      } catch (err) {
        console.error('Failed to load comparison:', err)
        setError('加载对比数据失败')
      } finally {
        setLoading(false)
      }
    }

    loadComparison()
  }, [open, baseSummaryId, compareSummaryId])

  /**
   * 渲染加载状态
   */
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
      <p className="text-sm text-muted-foreground">加载对比数据中...</p>
    </div>
  )

  /**
   * 渲染错误状态
   */
  const renderError = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <XCircle className="h-12 w-12 text-red-500 mb-4" />
      <p className="text-sm text-destructive mb-2">加载失败</p>
      <p className="text-sm text-muted-foreground">{error}</p>
    </div>
  )

  /**
   * 渲染总结头部信息
   */
  const renderSummaryHeader = (summary: Summary, label: string) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">时间范围</span>
          <span className="text-sm font-medium">
            {formatDate(summary.startDate)} ~ {formatDate(summary.endDate)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">笔记数量</span>
          <Badge variant="secondary">{summary.noteCount} 条</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">生成时间</span>
          <span className="text-sm">{formatDate(summary.generatedAt)}</span>
        </div>
      </CardContent>
    </Card>
  )

  /**
   * 渲染笔记数量变化
   */
  const renderNoteCountChange = () => {
    if (!comparison) return null

    const { noteCountChange } = comparison.differences
    const isPositive = noteCountChange > 0
    const isZero = noteCountChange === 0

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">笔记数量变化</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{comparison.base.noteCount}</p>
              <p className="text-xs text-muted-foreground">基准</p>
            </div>

            <ArrowRight className="h-5 w-5 text-muted-foreground" />

            <div className="text-center">
              <p className="text-2xl font-bold">{comparison.compare.noteCount}</p>
              <p className="text-xs text-muted-foreground">对比</p>
            </div>

            <div className="text-center px-4">
              {isPositive ? (
                <div className="flex items-center gap-1 text-green-500">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-lg font-bold">+{noteCountChange}</span>
                </div>
              ) : isZero ? (
                <div className="flex items-center gap-1 text-gray-500">
                  <Minus className="h-5 w-5" />
                  <span className="text-lg font-bold">0</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-red-500">
                  <TrendingDown className="h-5 w-5" />
                  <span className="text-lg font-bold">{noteCountChange}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">变化</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  /**
   * 渲染新增成就
   */
  const renderNewAchievements = () => {
    if (!comparison) return null

    const { newAchievements } = comparison.differences

    if (newAchievements.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              新增成就
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              没有新增成就
            </p>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            新增成就 ({newAchievements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {newAchievements.map((achievement, idx) => (
              <li
                key={idx}
                className="text-sm flex items-start gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-lg"
              >
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{achievement}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )
  }

  /**
   * 渲染完成的任务
   */
  const renderCompletedTasks = () => {
    if (!comparison) return null

    const { completedTasks } = comparison.differences

    if (completedTasks.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              已完成任务
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              没有已完成的任务
            </p>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-500" />
            已完成任务 ({completedTasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {completedTasks.map((task, idx) => (
              <li
                key={idx}
                className="text-sm flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg"
              >
                <span className="text-blue-500 mt-0.5">✓</span>
                <span className="line-through opacity-70">{task}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )
  }

  /**
   * 渲染新增洞察
   */
  const renderNewInsights = () => {
    if (!comparison) return null

    const { newInsights } = comparison.differences

    if (newInsights.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              新增洞察
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              没有新增洞察
            </p>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            新增洞察 ({newInsights.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {newInsights.map((insight, idx) => (
              <li
                key={idx}
                className="text-sm flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg"
              >
                <span className="text-yellow-500 mt-0.5">💡</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )
  }

  /**
   * 渲染情绪变化
   */
  const renderSentimentChange = () => {
    if (!comparison) return null

    const { sentimentChange } = comparison.differences

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {getSentimentTrendIcon(comparison.base.sentimentData.trend)}
            情绪变化
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                {getSentimentTrendIcon(comparison.base.sentimentData.trend)}
              </div>
              <p className="text-xs text-muted-foreground">基准</p>
              <p className="text-sm font-medium">
                {getSentimentTrendText(comparison.base.sentimentData.trend)}
              </p>
            </div>

            <ArrowRight className="h-5 w-5 text-muted-foreground" />

            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                {getSentimentTrendIcon(comparison.compare.sentimentData.trend)}
              </div>
              <p className="text-xs text-muted-foreground">对比</p>
              <p className="text-sm font-medium">
                {getSentimentTrendText(comparison.compare.sentimentData.trend)}
              </p>
            </div>

            <div className="flex-1 text-center">
              <Badge variant="secondary" className="whitespace-normal">
                {sentimentChange}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  /**
   * 渲染对比结果
   */
  const renderComparison = () => {
    if (!comparison) return null

    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          {/* 基准和对比总结信息 */}
          <div className="grid grid-cols-2 gap-4">
            {renderSummaryHeader(comparison.base, '基准总结')}
            {renderSummaryHeader(comparison.compare, '对比总结')}
          </div>

          {/* 笔记数量变化 */}
          {renderNoteCountChange()}

          {/* 新增成就 */}
          {renderNewAchievements()}

          {/* 已完成任务 */}
          {renderCompletedTasks()}

          {/* 新增洞察 */}
          {renderNewInsights()}

          {/* 情绪变化 */}
          {renderSentimentChange()}
        </div>
      </ScrollArea>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>总结对比</SheetTitle>
        </SheetHeader>

        <div className="mt-6 h-[calc(100vh-120px)]">
          {loading ? (
            renderLoading()
          ) : error ? (
            renderError()
          ) : comparison ? (
            renderComparison()
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <p className="text-sm text-muted-foreground">请选择两个总结进行对比</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
