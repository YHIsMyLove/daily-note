/**
 * 任务状态面板组件
 * 显示分析任务列表、统计信息和操作按钮
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { tasksApi } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'
import { ClaudeTask, QueueStats, TaskStatus } from '@daily-note/shared'
import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  Ban,
  ListChecks,
  X,
  List,
} from 'lucide-react'

interface TaskStatusSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// 状态筛选选项（顺序：运行中/待处理/失败/全部，移除已完成）
const STATUS_FILTERS: { label: string; value?: TaskStatus }[] = [
  { label: '运行中', value: 'RUNNING' },
  { label: '待处理', value: 'PENDING' },
  { label: '失败', value: 'FAILED' },
  { label: '全部', value: undefined },
]

// 状态图标映射
const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  PENDING: <Clock className="h-4 w-4 text-yellow-500" />,
  RUNNING: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  COMPLETED: <CheckCircle className="h-4 w-4 text-green-500" />,
  FAILED: <XCircle className="h-4 w-4 text-red-500" />,
  CANCELLED: <Ban className="h-4 w-4 text-gray-500" />,
}

// 状态文本映射
const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: '待处理',
  RUNNING: '运行中',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELLED: '已取消',
}

// 状态颜色映射
const STATUS_COLORS: Record<TaskStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  RUNNING: 'default',
  COMPLETED: 'outline',
  FAILED: 'destructive',
  CANCELLED: 'secondary',
}

export function TaskStatusSheet({ open, onOpenChange }: TaskStatusSheetProps) {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>('RUNNING')

  // 获取任务列表
  const { data: tasksResponse, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', statusFilter],
    queryFn: () => tasksApi.list({ status: statusFilter }),
    // 移除轮询，依赖 SSE 事件更新
    enabled: open,
  })

  // 获取统计信息
  const { data: statsResponse, isLoading: statsLoading } = useQuery({
    queryKey: ['tasks-stats'],
    queryFn: () => tasksApi.stats(),
    // 移除轮询，依赖 SSE 事件更新
    enabled: open,
  })

  const tasks = (tasksResponse?.data as ClaudeTask[]) || []
  const stats = (statsResponse?.data as QueueStats) || {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    maxConcurrency: 0,
  }

  // 监听任务状态变化
  const previousTasks = useRef<ClaudeTask[]>([])

  useEffect(() => {
    if (tasks.length > 0 && previousTasks.current.length > 0) {
      // 检测是否有新完成的任务
      const hasNewCompleted = tasks.some(task =>
        task.status === 'COMPLETED' &&
        previousTasks.current.some(pt => pt.id === task.id && pt.status !== 'COMPLETED')
      )

      if (hasNewCompleted) {
        // 任务完成时刷新任务统计
        queryClient.invalidateQueries({ queryKey: ['tasks-stats'] })
      }
    }

    previousTasks.current = tasks
  }, [tasks, queryClient])

  // 取消任务
  const handleCancelTask = async (taskId: string) => {
    try {
      await tasksApi.cancel(taskId)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks-stats'] })
    } catch (error) {
      console.error('Failed to cancel task:', error)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[450px] flex flex-col">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            分析任务
          </SheetTitle>
        </SheetHeader>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatCard label="待处理" value={stats.pending} color="text-yellow-500" loading={statsLoading} />
          <StatCard label="运行中" value={stats.running} color="text-blue-500" loading={statsLoading} />
          <StatCard label="失败" value={stats.failed} color="text-red-500" loading={statsLoading} />
        </div>

        {/* 状态筛选 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.value || 'all'}
              variant={statusFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* 任务列表 */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {tasksLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              暂无任务
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onCancel={() => handleCancelTask(task.id)}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// 统计卡片组件
function StatCard({
  label,
  value,
  color,
  loading,
}: {
  label: string
  value: number
  color: string
  loading?: boolean
}) {
  return (
    <Card className="text-center">
      <CardContent className="p-3">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mx-auto text-text-muted" />
        ) : (
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
        )}
        <div className="text-xs text-text-muted mt-1">{label}</div>
      </CardContent>
    </Card>
  )
}

// 任务卡片组件
function TaskCard({
  task,
  onCancel,
}: {
  task: ClaudeTask
  onCancel: () => void
}) {
  const canCancel = task.status === 'PENDING' || task.status === 'RUNNING'

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {STATUS_ICONS[task.status]}
              <span className="font-medium text-sm truncate">{task.type}</span>
            </div>
            {task.noteId && (
              <div className="text-xs text-text-muted mb-2">
                笔记 #{task.noteId.slice(-6)}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_COLORS[task.status]} className="text-xs">
                {STATUS_LABELS[task.status]}
              </Badge>
              <span className="text-xs text-text-muted">
                {formatRelativeTime(task.createdAt)}
              </span>
            </div>
            {task.error && (
              <div className="text-xs text-red-500 mt-2 truncate">
                {task.error}
              </div>
            )}
          </div>
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
