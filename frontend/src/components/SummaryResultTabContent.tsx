'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus, FileText, CheckCircle2, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SummaryAnalysisResult, TaskStatus, Summary, CategoryDistribution } from '@daily-note/shared'
import { summariesApi } from '@/lib/api'
import { SentimentCurveChart } from './charts/SentimentCurveChart'
import { TimeDistributionChart } from './charts/TimeDistributionChart'

/**
 * 清理分类分布数据
 * 数据库中可能存储了包含完整 Category 对象的数据（id, name, color, createdAt）
 * 需要转换为前端期望的 CategoryDistribution 格式（category, count, percentage）
 */
function cleanCategoryDistribution(distribution: any[]): CategoryDistribution[] {
  if (!Array.isArray(distribution)) return []

  return distribution.map((cat: any) => ({
    category: typeof cat?.category === 'string' ? cat.category : cat?.name || '未知',
    count: cat?.count ?? 0,
    percentage: cat?.percentage ?? 0,
  }))
}

/**
 * 清理总结分析结果
 * 确保数据格式符合前端期望
 */
function cleanSummaryResult(result: any): SummaryAnalysisResult {
  if (!result) return result

  return {
    ...result,
    noteStatistics: {
      ...result.noteStatistics,
      categoryDistribution: cleanCategoryDistribution(
        result.noteStatistics?.categoryDistribution ?? []
      ),
    },
  }
}

/**
 * 总结结果标签页内容
 * 复用 SummaryResultSheet 的逻辑，移除 Sheet 包装
 */
interface SummaryResultTabContentProps {
  taskId?: string | null
}

export function SummaryResultTabContent({ taskId: propTaskId }: SummaryResultTabContentProps) {
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(propTaskId || null)
  const [currentSummary, setCurrentSummary] = useState<Summary | null>(null)
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('PENDING')
  const [result, setResult] = useState<SummaryAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  /**
   * 加载最新的总结结果
   */
  const loadLatestSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await summariesApi.history({ limit: 1 })
      if (response.data && response.data.length > 0) {
        const summary = response.data[0]
        const taskId = summary.taskId
        setCurrentTaskId(taskId)
        setCurrentSummary(summary)

        // 轮询加载总结详情
        const pollTask = async () => {
          try {
            const detailResponse = await summariesApi.get(taskId)
            if (detailResponse.data) {
              const task = detailResponse.data
              setTaskStatus(task.status as TaskStatus)

              if (task.status === 'COMPLETED' && task.result) {
                setResult(cleanSummaryResult(task.result))
                setCurrentSummary(detailResponse.data as Summary)
                setLoading(false)
                return // 任务完成，停止轮询
              }

              if (task.status === 'FAILED') {
                setError(task.error || '分析失败')
                setLoading(false)
                return // 任务失败，停止轮询
              }

              // 继续轮询（PENDING 或 RUNNING 状态）
              setTimeout(pollTask, 2000)
            }
          } catch (err) {
            console.error('Failed to poll task status:', err)
            setError('获取任务状态失败')
            setLoading(false)
          }
        }

        pollTask()
      } else {
        setResult(null)
        setLoading(false)
      }
    } catch (err) {
      console.error('Failed to load latest summary:', err)
      setError('加载总结失败')
      setLoading(false)
    }
  }

  /**
   * 根据 taskId 加载总结详情（带轮询）
   */
  const loadSummaryById = async (taskId: string) => {
    setLoading(true)
    setError(null)
    setCurrentTaskId(taskId)

    const pollTask = async () => {
      try {
        const detailResponse = await summariesApi.get(taskId)
        if (detailResponse.data) {
          const task = detailResponse.data
          setTaskStatus(task.status as TaskStatus)

          if (task.status === 'COMPLETED' && task.result) {
            setResult(cleanSummaryResult(task.result))
            setCurrentSummary(detailResponse.data as Summary)
            setLoading(false)
            return // 任务完成，停止轮询
          }

          if (task.status === 'FAILED') {
            setError(task.error || '分析失败')
            setLoading(false)
            return // 任务失败，停止轮询
          }

          // 继续轮询（PENDING 或 RUNNING 状态）
          setTimeout(pollTask, 2000)
        }
      } catch (err) {
        console.error('Failed to load summary:', err)
        setError('加载总结失败')
        setLoading(false)
      }
    }

    pollTask()
  }

  // 当 propTaskId 变化时更新
  useEffect(() => {
    if (propTaskId) {
      loadSummaryById(propTaskId)
    } else if (!currentTaskId) {
      // 如果没有指定的 taskId，加载最新的
      loadLatestSummary()
    }
  }, [propTaskId])

  // 初始加载（如果没有 propTaskId）
  useEffect(() => {
    if (!propTaskId && !currentTaskId) {
      loadLatestSummary()
    }
  }, [])

  /**
   * 获取情绪趋势图标
   */
  const getSentimentTrendIcon = (trend: string) => {
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
   * 格式化日期
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  /**
   * 渲染加载状态
   */
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <RefreshCw className="h-12 w-12 text-primary animate-spin mb-4" />
      <h3 className="text-lg font-semibold mb-2">正在生成分析报告</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {taskStatus === 'PENDING' ? '任务排队中...' : '正在分析笔记数据...'}
      </p>
    </div>
  )

  /**
   * 渲染错误状态
   */
  const renderError = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <X className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold mb-2">分析失败</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">{error}</p>
    </div>
  )

  /**
   * 渲染空状态
   */
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">暂无总结结果</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        请在「智能总结」标签页选择时间范围生成总结
      </p>
    </div>
  )

  /**
   * 渲染分析结果
   */
  const renderResult = () => {
    if (!result) return null

    // 判断是否为日分析模式
    const isDayMode = result.period.mode === 'day'

    if (result.period.noteCount === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">暂无数据</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            该时间范围内没有找到符合条件的笔记
          </p>
        </div>
      )
    }

    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {/* 时间范围信息 */}
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>
                  {result.period.mode === 'day' && '今日总结'}
                  {result.period.mode === 'week' && '本周总结'}
                  {result.period.mode === 'month' && '本月总结'}
                  {result.period.mode === 'year' && '年度总结'}
                  {result.period.mode === 'custom' && '自定义总结'}
                </span>
                <Badge variant="default" className="font-semibold text-xs">
                  {result.period.noteCount} 条笔记
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs font-medium text-foreground/80">
                {formatDate(result.period.startDate)}
                {result.period.startDate !== result.period.endDate &&
                  ` ~ ${formatDate(result.period.endDate)}`}
              </p>
            </CardContent>
          </Card>

          {/* AI 总结 */}
          <Card className="bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="text-base">AI 总结</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-background/50 p-3 border">
                <h4 className="text-xs font-semibold mb-2 text-foreground">概述</h4>
                <p className="text-xs leading-relaxed text-foreground/90">
                  {result.summary.overview}
                </p>
              </div>

              {result.summary.keyAchievements.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    关键成就
                  </h4>
                  <ul className="space-y-1.5">
                    {result.summary.keyAchievements.map((achievement, idx) => (
                      <li
                        key={idx}
                        className="text-xs leading-relaxed text-foreground/80 flex items-start gap-2"
                      >
                        <span className="text-green-500 mt-0.5 font-bold text-[10px]">✓</span>
                        <span>{achievement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.summary.pendingTasks.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-2 text-foreground">
                    <Clock className="h-3 w-3 text-orange-500" />
                    待办任务
                  </h4>
                  <ul className="space-y-1.5">
                    {result.summary.pendingTasks.map((task, idx) => (
                      <li
                        key={idx}
                        className="text-xs leading-relaxed text-foreground/80 flex items-start gap-2"
                      >
                        <span className="text-orange-500 mt-0.5 font-bold text-[10px]">○</span>
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.summary.insights.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2 text-foreground">感悟洞察</h4>
                  <ul className="space-y-1.5">
                    {result.summary.insights.map((insight, idx) => (
                      <li
                        key={idx}
                        className="text-xs leading-relaxed text-foreground/80 flex items-start gap-2"
                      >
                        <span className="text-blue-500 mt-0.5 text-[10px]">💡</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 心情曲线 - 日分析时不显示 */}
          {!isDayMode && result.sentimentCurve.daily.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>心情曲线</span>
                  <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1">
                    {getSentimentTrendIcon(result.sentimentCurve.trend)}
                    <span className="text-xs font-medium">
                      {result.sentimentCurve.summary}
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <SentimentCurveChart data={result.sentimentCurve.daily} />
              </CardContent>
            </Card>
          )}

          {/* 笔记统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">笔记统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-primary/10 p-3 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {result.noteStatistics.totalCount}
                  </p>
                  <p className="text-xs font-medium text-foreground/70 mt-1">总笔记数</p>
                </div>
                {!isDayMode && (
                  <div className="rounded-lg bg-secondary p-3 text-center">
                    <p className="text-2xl font-bold">
                      {result.noteStatistics.dailyAverage}
                    </p>
                    <p className="text-xs font-medium text-foreground/70 mt-1">日均笔记</p>
                  </div>
                )}
              </div>

              {result.noteStatistics.categoryDistribution.length > 0 && (
                <div className="rounded-lg bg-muted/30 p-3">
                  <h4 className="text-xs font-semibold mb-2 text-foreground">分类分布</h4>
                  <div className="space-y-2">
                    {result.noteStatistics.categoryDistribution.slice(0, 5).map((cat) => (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{cat.category}</span>
                          <span className="text-muted-foreground">{cat.count}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${cat.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.noteStatistics.topTags.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2 text-foreground">热门标签</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.noteStatistics.topTags.slice(0, 10).map((tag) => (
                      <Badge key={tag.tag} variant="secondary" className="text-xs">
                        {tag.tag} <span className="ml-1 text-muted-foreground">({tag.count})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-muted/30 p-3">
                <h4 className="text-xs font-semibold mb-2 text-foreground">重要性分布</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center rounded-lg bg-green-500/10 p-2">
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {result.noteStatistics.importanceDistribution.high}
                    </p>
                    <p className="text-[10px] font-medium text-foreground/70 mt-1">高 (7-10)</p>
                  </div>
                  <div className="text-center rounded-lg bg-yellow-500/10 p-2">
                    <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                      {result.noteStatistics.importanceDistribution.medium}
                    </p>
                    <p className="text-[10px] font-medium text-foreground/70 mt-1">中 (4-6)</p>
                  </div>
                  <div className="text-center rounded-lg bg-gray-400/10 p-2">
                    <p className="text-xl font-bold text-gray-500">
                      {result.noteStatistics.importanceDistribution.low}
                    </p>
                    <p className="text-[10px] font-medium text-foreground/70 mt-1">低 (1-3)</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 任务完成情况 */}
          {result.taskCompletion.mentioned > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">任务完成情况</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-xl font-bold">{result.taskCompletion.mentioned}</p>
                    <p className="text-xs font-medium text-foreground/70 mt-1">提及任务</p>
                  </div>
                  <div className="rounded-lg bg-green-500/10 p-3 text-center">
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {result.taskCompletion.completed}
                    </p>
                    <p className="text-xs font-medium text-foreground/70 mt-1">已完成</p>
                  </div>
                  <div className="rounded-lg bg-orange-500/10 p-3 text-center">
                    <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      {result.taskCompletion.pending}
                    </p>
                    <p className="text-xs font-medium text-foreground/70 mt-1">待完成</p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/30 p-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">完成率</span>
                    <span className="font-bold text-base text-primary">
                      {result.taskCompletion.completionRate}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${result.taskCompletion.completionRate}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 时间分布 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">时间分布</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <TimeDistributionChart data={result.timeDistribution} />
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">总结结果</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={loadLatestSummary}
          disabled={loading}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        {loading || taskStatus === 'PENDING' || taskStatus === 'RUNNING' ? (
          renderLoading()
        ) : taskStatus === 'FAILED' ? (
          renderError()
        ) : result ? (
          renderResult()
        ) : (
          renderEmpty()
        )}
      </div>
    </div>
  )
}
