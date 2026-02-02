'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { tasksApi } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'
import { ClaudeTask, QueueStats, TaskStatus } from '@daily-note/shared'
import { Clock, Loader2, XCircle, X, ListChecks } from 'lucide-react'

// 状态筛选选项
const STATUS_FILTERS: { label: string; value?: TaskStatus }[] = [
  { label: '运行中', value: 'RUNNING' },
  { label: '待处理', value: 'PENDING' },
  { label: '失败', value: 'FAILED' },
  { label: '全部', value: undefined },
]

// 状态图标映射
const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  PENDING: <Clock className="h-3.5 w-3.5 text-yellow-500" />,
  RUNNING: <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />,
  COMPLETED: <span className="h-3.5 w-3.5 text-green-500">✓</span>,
  FAILED: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  CANCELLED: <span className="h-3.5 w-3.5 text-gray-500">−</span>,
}

// 状态标签映射
const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: '待处理',
  RUNNING: '运行中',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELLED: '已取消',
}

// 状态颜色映射
const STATUS_COLORS: Record<
  TaskStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDING: 'secondary',
  RUNNING: 'default',
  COMPLETED: 'outline',
  FAILED: 'destructive',
  CANCELLED: 'secondary',
}

/**
 * 任务状态标签页内容
 * 复用 TaskStatusSheet 的逻辑，移除 Sheet 包装
 */
export function TasksTabContent() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>('RUNNING')

  // 获取任务列表
  const { data: tasksResponse, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', statusFilter],
    queryFn: () => tasksApi.list({ status: statusFilter }),
    enabled: true,
  })

  // 获取统计信息
  const { data: statsResponse, isLoading: statsLoading } = useQuery({
    queryKey: ['tasks-stats'],
    queryFn: () => tasksApi.stats(),
    enabled: true,
  })

  const tasks = (tasksResponse?.data as ClaudeTask[]) || []
  const stats = (statsResponse?.data as QueueStats) || {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    maxConcurrency: 0,
  }

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
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">分析任务</h2>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-2 p-3 border-b border-border">
        <StatCard
          label="待处理"
          value={stats.pending}
          color="text-yellow-500"
          loading={statsLoading}
        />
        <StatCard
          label="运行中"
          value={stats.running}
          color="text-blue-500"
          loading={statsLoading}
        />
        <StatCard label="失败" value={stats.failed} color="text-red-500" loading={statsLoading} />
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-1.5 p-3 border-b border-border flex-wrap">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.value || 'all'}
            variant={statusFilter === filter.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(filter.value)}
            className="h-7 text-xs"
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto">
        {tasksLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-xs">暂无任务</div>
        ) : (
          <div className="p-3 space-y-2">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onCancel={() => handleCancelTask(task.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
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
      <CardContent className="p-2">
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin mx-auto text-text-muted" />
        ) : (
          <div className={`text-xl font-bold ${color}`}>{value}</div>
        )}
        <div className="text-[10px] text-text-muted mt-0.5">{label}</div>
      </CardContent>
    </Card>
  )
}

// 任务卡片组件
function TaskCard({ task, onCancel }: { task: ClaudeTask; onCancel: () => void }) {
  const canCancel = task.status === 'PENDING' || task.status === 'RUNNING'

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              {STATUS_ICONS[task.status]}
              <span className="font-medium text-xs truncate">{task.type}</span>
            </div>
            {task.noteId && (
              <div className="text-[10px] text-text-muted mb-1.5">
                笔记 #{task.noteId.slice(-6)}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Badge variant={STATUS_COLORS[task.status]} className="text-[10px]">
                {STATUS_LABELS[task.status]}
              </Badge>
              <span className="text-[10px] text-text-muted">
                {formatRelativeTime(task.createdAt)}
              </span>
            </div>
            {task.error && (
              <div className="text-[10px] text-red-500 mt-1.5 truncate">{task.error}</div>
            )}
          </div>
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-7 w-7 p-0 flex-shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
