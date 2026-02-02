'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { X, RefreshCw, Clock, CheckCircle, XCircle, Loader } from 'lucide-react'
import { tasksApi } from '@/lib/api'
import { ClaudeTask, QueueStats, TaskStatus } from '@daily-note/shared'
import { useSSE } from '@/hooks/useSSE'
import { SSEEventData } from '@/lib/sse'

/**
 * 任务状态配置
 */
const STATUS_CONFIG: Record<
  TaskStatus,
  { icon: any; color: string; label: string; bgColor: string }
> = {
  PENDING: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500',
    label: '待执行',
  },
  RUNNING: {
    icon: Loader,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500',
    label: '执行中',
  },
  COMPLETED: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-500',
    label: '已完成',
  },
  FAILED: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-500',
    label: '失败',
  },
  CANCELLED: {
    icon: X,
    color: 'text-gray-600',
    bgColor: 'bg-gray-500',
    label: '已取消',
  },
}

/**
 * 任务队列面板组件
 *
 * 功能：
 * - 显示任务列表（带状态筛选）
 * - 显示队列统计信息
 * - 通过 SSE 实时更新
 * - 取消任务功能
 */
export function TaskQueuePanel() {
  const queryClient = useQueryClient()
  const [tasks, setTasks] = useState<ClaudeTask[]>([])
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // SSE 实时监听
  useSSE(undefined, {
    onTaskCreated: (data: SSEEventData) => {
      // 任务创建时添加到列表（根据筛选条件）
      const task = data as unknown as ClaudeTask
      if (!selectedStatus || selectedStatus === task.status) {
        setTasks((prev) => [task, ...prev])
      }
    },
    onTaskStarted: (data: SSEEventData) => {
      // 任务开始时更新状态
      const task = data as unknown as ClaudeTask
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: 'RUNNING' as TaskStatus, startedAt: task.startedAt } : t
        )
      )
    },
    onTaskCompleted: (data: SSEEventData) => {
      // 任务完成时更新状态
      const task = data as unknown as ClaudeTask
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: 'COMPLETED' as TaskStatus, completedAt: task.completedAt, result: task.result }
            : t
        )
      )
    },
    onTaskFailed: (data: SSEEventData) => {
      // 任务失败时更新状态
      const task = data as unknown as ClaudeTask
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: 'FAILED' as TaskStatus, completedAt: task.completedAt, error: task.error }
            : t
        )
      )
    },
    onTaskCancelled: (data: SSEEventData) => {
      // 任务取消时更新状态
      const task = data as unknown as ClaudeTask
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'CANCELLED' as TaskStatus } : t))
      )
    },
    onStatsUpdated: (data: SSEEventData) => {
      // 统计更新时只更新统计数据
      setStats(data as unknown as QueueStats)
      queryClient.setQueryData(['tasks-stats'], { success: true, data })
    },
  })

  /**
   * 加载数据
   */
  const loadData = async () => {
    try {
      setRefreshing(true)
      const [tasksRes, statsRes] = await Promise.all([
        tasksApi.list(selectedStatus ? { status: selectedStatus } : undefined),
        tasksApi.stats(),
      ])
      setTasks(tasksRes.data ?? [])
      setStats(statsRes.data ?? null)
    } catch (error) {
      console.error('Failed to load task data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  /**
   * 取消任务
   */
  const handleCancelTask = async (taskId: string) => {
    if (!confirm('确定要取消这个任务吗？')) {
      return
    }

    try {
      await tasksApi.cancel(taskId)
      // 取消后立即刷新
      await loadData()
    } catch (error) {
      console.error('Failed to cancel task:', error)
      alert('取消任务失败')
    }
  }

  /**
   * 初始加载数据
   */
  useEffect(() => {
    loadData()
  }, [selectedStatus])

  return (
    <Card className="p-4 h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Claude 任务队列</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="flex flex-wrap gap-3 mb-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-task-status-pending" />
            <span>待执行: {stats.pending}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Loader className="w-4 h-4 text-task-status-running" />
            <span>执行中: {stats.running}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-task-status-completed" />
            <span>已完成: {stats.completed}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-red-500" />
            <span>失败: {stats.failed}</span>
          </div>
          <div className="ml-auto text-xs text-gray-500">
            并发上限: {stats.maxConcurrency}
          </div>
        </div>
      )}

      {/* 状态筛选 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant={selectedStatus === '' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedStatus('')}
        >
          全部
        </Button>
        {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((status) => (
          <Button
            key={status}
            variant={selectedStatus === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedStatus(status)}
          >
            {STATUS_CONFIG[status].label}
          </Button>
        ))}
      </div>

      {/* 任务列表 */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              加载中...
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              暂无任务
            </div>
          ) : (
            tasks.map((task) => {
              const StatusIcon = STATUS_CONFIG[task.status].icon
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <StatusIcon
                      className={`w-5 h-5 p-1 rounded-full ${STATUS_CONFIG[task.status].bgColor} text-white flex-shrink-0`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">
                        {task.type}
                      </div>
                      {task.noteId && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          笔记: {task.noteId.slice(0, 8)}...
                        </div>
                      )}
                      {task.error && (
                        <div className="text-xs text-red-500 truncate">
                          {task.error}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(task.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {task.status === 'PENDING' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelTask(task.id)}
                      className="flex-shrink-0 ml-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </Card>
  )
}
