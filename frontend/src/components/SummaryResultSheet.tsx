'use client'

/**
 * 总结分析结果展示面板
 * Dashboard 风格展示，包含图表和统计数据
 */
import { useEffect, useState } from 'react'
import { X, RefreshCw, TrendingUp, TrendingDown, Minus, FileText, CheckCircle2, Clock, History } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SummaryAnalysisResult, TaskStatus } from '@daily-note/shared'
import { summariesApi } from '@/lib/api'
import { SentimentCurveChart } from './charts/SentimentCurveChart'
import { TimeDistributionChart } from './charts/TimeDistributionChart'
import { SummaryHistory } from './SummaryHistory'

interface SummaryResultSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string | null
}

export function SummaryResultSheet({ open, onOpenChange, taskId }: SummaryResultSheetProps) {
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('PENDING')
  const [result, setResult] = useState<SummaryAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  /**
   * 轮询任务状态
   */
  useEffect(() => {
    if (!taskId || !open) return

    const pollTask = async () => {
      try {
        const response = await summariesApi.get(taskId)
        if (response.data) {
          const task = response.data
          setTaskStatus(task.status as TaskStatus)

          if (task.status === 'COMPLETED' && task.result) {
            setResult(task.result)
            return // 任务完成，停止轮询
          }

          if (task.status === 'FAILED') {
            setError(task.error || '分析失败')
            return // 任务失败，停止轮询
          }

          // 继续轮询
          setTimeout(pollTask, 2000)
        }
      } catch (err) {
        console.error('Failed to poll task status:', err)
        setError('获取任务状态失败')
      }
    }

    pollTask()
  }, [taskId, open])

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
      <RefreshCw className="h-12 w-12 text-muted-foreground animate-spin mb-4" />
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
      <X className="h-12 w-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold mb-2">分析失败</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">{error}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => onOpenChange(false)}
      >
        关闭
      </Button>
    </div>
  )

  /**
   * 渲染空结果
   */
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">暂无数据</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        该时间范围内没有找到符合条件的笔记
      </p>
    </div>
  )

  /**
   * 渲染分析结果
   */
  const renderResult = () => {
    if (!result) return null

    if (result.period.noteCount === 0) {
      return renderEmpty()
    }

    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          {/* 时间范围信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {result.period.mode === 'day' && '今日总结'}
                  {result.period.mode === 'week' && '本周总结'}
                  {result.period.mode === 'month' && '本月总结'}
                  {result.period.mode === 'year' && '年度总结'}
                  {result.period.mode === 'custom' && '自定义总结'}
                </span>
                <Badge variant="secondary">{result.period.noteCount} 条笔记</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {formatDate(result.period.startDate)}
                {result.period.startDate !== result.period.endDate && ` ~ ${formatDate(result.period.endDate)}`}
              </p>
            </CardContent>
          </Card>

          {/* AI 总结 */}
          <Card>
            <CardHeader>
              <CardTitle>AI 总结</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">概述</h4>
                <p className="text-sm text-muted-foreground">{result.summary.overview}</p>
              </div>

              {result.summary.keyAchievements.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    关键成就
                  </h4>
                  <ul className="space-y-1">
                    {result.summary.keyAchievements.map((achievement, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">•</span>
                        {achievement}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.summary.pendingTasks.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    待办任务
                  </h4>
                  <ul className="space-y-1">
                    {result.summary.pendingTasks.map((task, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-orange-500 mt-0.5">•</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.summary.insights.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">感悟洞察</h4>
                  <ul className="space-y-1">
                    {result.summary.insights.map((insight, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 心情曲线 */}
          {result.sentimentCurve.daily.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>心情曲线</span>
                  <div className="flex items-center gap-2">
                    {getSentimentTrendIcon(result.sentimentCurve.trend)}
                    <span className="text-sm text-muted-foreground">
                      {result.sentimentCurve.summary}
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SentimentCurveChart data={result.sentimentCurve.daily} />
              </CardContent>
            </Card>
          )}

          {/* 笔记统计 */}
          <Card>
            <CardHeader>
              <CardTitle>笔记统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold">{result.noteStatistics.totalCount}</p>
                  <p className="text-sm text-muted-foreground">总笔记数</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{result.noteStatistics.dailyAverage}</p>
                  <p className="text-sm text-muted-foreground">日均笔记</p>
                </div>
              </div>

              {result.noteStatistics.categoryDistribution.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">分类分布</h4>
                  <div className="space-y-2">
                    {result.noteStatistics.categoryDistribution.slice(0, 5).map((cat) => (
                      <div key={cat.category} className="flex items-center justify-between">
                        <span className="text-sm">{cat.category}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${cat.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">{cat.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.noteStatistics.topTags.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">热门标签</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.noteStatistics.topTags.slice(0, 10).map((tag) => (
                      <Badge key={tag.tag} variant="secondary">
                        {tag.tag} ({tag.count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-2">重要性分布</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-500">
                      {result.noteStatistics.importanceDistribution.high}
                    </p>
                    <p className="text-xs text-muted-foreground">高 (7-10)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-yellow-500">
                      {result.noteStatistics.importanceDistribution.medium}
                    </p>
                    <p className="text-xs text-muted-foreground">中 (4-6)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-500">
                      {result.noteStatistics.importanceDistribution.low}
                    </p>
                    <p className="text-xs text-muted-foreground">低 (1-3)</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">字数统计</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">总字数：</span>
                    <span className="font-medium">{result.noteStatistics.wordCountStats.total}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">平均字数：</span>
                    <span className="font-medium">{result.noteStatistics.wordCountStats.average}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 任务完成情况 */}
          {result.taskCompletion.mentioned > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>任务完成情况</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{result.taskCompletion.mentioned}</p>
                    <p className="text-sm text-muted-foreground">提及任务</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-500">
                      {result.taskCompletion.completed}
                    </p>
                    <p className="text-sm text-muted-foreground">已完成</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-500">
                      {result.taskCompletion.pending}
                    </p>
                    <p className="text-sm text-muted-foreground">待完成</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    完成率：<span className="font-semibold">{result.taskCompletion.completionRate}%</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 时间分布 */}
          <Card>
            <CardHeader>
              <CardTitle>时间分布</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeDistributionChart data={result.timeDistribution} />
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>智能总结分析</SheetTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(true)}
              >
                <History className="h-4 w-4 mr-2" />
                查看历史
              </Button>
            </div>
          </SheetHeader>

          <div className="mt-6 h-[calc(100vh-120px)]">
            {taskStatus === 'PENDING' || taskStatus === 'RUNNING' ? (
              renderLoading()
            ) : taskStatus === 'FAILED' ? (
              renderError()
            ) : result ? (
              renderResult()
            ) : (
              renderLoading()
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 历史总结 */}
      <SummaryHistory
        open={showHistory}
        onOpenChange={setShowHistory}
      />
    </>
  )
}
