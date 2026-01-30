'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { ScrollArea } from './ui/scroll-area'
import { RefreshCw, Circle, CheckCircle2, Clock, AlertCircle, XCircle, Loader2 } from 'lucide-react'
import { todosApi } from '@/lib/api'
import { Todo, TodoStatus, TodoPriority, TodoStats } from '@daily-note/shared'
import { useSSE } from '@/hooks/useSSE'
import { SSEEventData } from '@/lib/sse'
import { TodoItem } from './TodoItem'

/**
 * 待办状态配置
 */
const STATUS_CONFIG: Record<
  TodoStatus,
  { icon: any; color: string; label: string; bgColor: string }
> = {
  PENDING: {
    icon: Circle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-500',
    label: '待处理',
  },
  NEEDS_REVIEW: {
    icon: AlertCircle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500',
    label: '待审核',
  },
  RUNNING: {
    icon: Loader2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500',
    label: '进行中',
  },
  COMPLETED: {
    icon: CheckCircle2,
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
    icon: Circle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-400',
    label: '已取消',
  },
}

/**
 * 优先级配置
 */
const PRIORITY_CONFIG: Record<
  TodoPriority,
  { label: string }
> = {
  LOW: { label: '低' },
  MEDIUM: { label: '中' },
  HIGH: { label: '高' },
  URGENT: { label: '紧急' },
}

/**
 * TodoList 组件属性
 */
interface TodoListProps {
  noteId?: string // 可选：只显示特定笔记的待办
}

/**
 * TodoList 组件
 *
 * 功能：
 * - 显示待办列表（带状态和优先级筛选）
 * - 显示统计信息
 * - 通过 SSE 实时更新
 * - 完成待办功能
 */
export function TodoList({ noteId }: TodoListProps) {
  const queryClient = useQueryClient()
  const [todos, setTodos] = useState<Todo[]>([])
  const [stats, setStats] = useState<TodoStats | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<TodoStatus | ''>('')
  const [selectedPriority, setSelectedPriority] = useState<TodoPriority | ''>('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // SSE 实时监听
  useSSE(undefined, {
    onTodoCreated: (data: SSEEventData) => {
      const todo = data as unknown as Todo
      // 如果指定了 noteId，只显示匹配的待办
      if (noteId && todo.noteId !== noteId) return
      // 根据筛选条件决定是否添加到列表
      const statusMatch = !selectedStatus || selectedStatus === todo.status
      const priorityMatch = !selectedPriority || selectedPriority === todo.priority
      if (statusMatch && priorityMatch) {
        setTodos((prev) => [todo, ...prev])
      }
    },
    onTodoUpdated: (data: SSEEventData) => {
      const todo = data as unknown as Todo
      // 如果指定了 noteId，只更新匹配的待办
      if (noteId && todo.noteId !== noteId) return
      setTodos((prev) => {
        const exists = prev.find((t) => t.id === todo.id)
        if (!exists) {
          // 如果是新增的待办，检查筛选条件
          const statusMatch = !selectedStatus || selectedStatus === todo.status
          const priorityMatch = !selectedPriority || selectedPriority === todo.priority
          if (statusMatch && priorityMatch) {
            return [...prev, todo]
          }
          return prev
        }
        // 更新现有待办
        return prev.map((t) => (t.id === todo.id ? todo : t))
      })
    },
    onTodoCompleted: (data: SSEEventData) => {
      const todo = data as unknown as Todo
      // 如果指定了 noteId，只更新匹配的待办
      if (noteId && todo.noteId !== noteId) return
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id
            ? { ...t, status: 'COMPLETED' as TodoStatus, completedAt: todo.completedAt }
            : t
        )
      )
    },
    onTodoDeleted: (data: SSEEventData) => {
      const todo = data as unknown as Todo
      setTodos((prev) => prev.filter((t) => t.id !== todo.id))
    },
    onTodoStatsUpdated: (data: SSEEventData) => {
      setStats(data as unknown as TodoStats)
      queryClient.setQueryData(['todos-stats'], { success: true, data })
    },
  })

  /**
   * 加载数据
   */
  const loadData = async () => {
    try {
      setRefreshing(true)

      // 构建查询参数
      const filters: {
        noteId?: string
        status?: TodoStatus
        priority?: TodoPriority
      } = {}

      if (noteId) filters.noteId = noteId
      if (selectedStatus) filters.status = selectedStatus
      if (selectedPriority) filters.priority = selectedPriority

      const [todosRes, statsRes] = await Promise.all([
        todosApi.list(Object.keys(filters).length > 0 ? { filters } : undefined),
        todosApi.stats(),
      ])

      setTodos(todosRes.data?.todos ?? [])
      setStats(statsRes.data ?? null)
    } catch (error) {
      console.error('Failed to load todo data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  /**
   * 处理待办完成
   */
  const handleComplete = (todoId: string) => {
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todoId
          ? { ...t, status: 'COMPLETED' as TodoStatus, completedAt: new Date() }
          : t
      )
    )
  }

  /**
   * 处理待办删除
   */
  const handleDelete = async (todoId: string) => {
    if (!confirm('确定要删除这个待办吗？')) {
      return
    }

    try {
      await todosApi.delete(todoId)
      setTodos((prev) => prev.filter((t) => t.id !== todoId))
      await loadData()
    } catch (error) {
      console.error('Failed to delete todo:', error)
      alert('删除待办失败')
    }
  }

  /**
   * 处理待办编辑
   */
  const handleEdit = (todo: Todo) => {
    // TODO: 实现编辑功能（打开编辑对话框）
    console.log('Edit todo:', todo)
  }

  /**
   * 切换 AI 自动完成
   */
  const handleToggleAutoCompletion = (todoId: string, enabled: boolean) => {
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todoId ? { ...t, autoCompletionEnabled: enabled } : t
      )
    )
  }

  /**
   * 初始加载数据
   */
  useEffect(() => {
    loadData()
  }, [selectedStatus, selectedPriority, noteId])

  return (
    <Card className="p-4 h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          {noteId ? '笔记待办' : '待办事项'}
        </h2>
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
      {stats && !noteId && (
        <div className="flex flex-wrap gap-3 mb-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Circle className="w-4 h-4 text-gray-500" />
            <span>待处理: {stats.byStatus.PENDING}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            <span>待审核: {stats.byStatus.NEEDS_REVIEW}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 text-blue-500" />
            <span>进行中: {stats.byStatus.RUNNING}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span>已完成: {stats.byStatus.COMPLETED}</span>
          </div>
          {stats.overdue > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span>已逾期: {stats.overdue}</span>
            </div>
          )}
        </div>
      )}

      {/* 状态筛选 */}
      {!noteId && (
        <div className="flex flex-wrap gap-2 mb-3">
          <Button
            variant={selectedStatus === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedStatus('')}
          >
            全部状态
          </Button>
          {(Object.keys(STATUS_CONFIG) as TodoStatus[]).map((status) => (
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
      )}

      {/* 优先级筛选 */}
      {!noteId && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant={selectedPriority === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPriority('')}
          >
            全部优先级
          </Button>
          {(Object.keys(PRIORITY_CONFIG) as TodoPriority[]).map((priority) => (
            <Button
              key={priority}
              variant={selectedPriority === priority ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPriority(priority)}
            >
              {PRIORITY_CONFIG[priority].label}
            </Button>
          ))}
        </div>
      )}

      {/* 待办列表 */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              加载中...
            </div>
          ) : todos.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {noteId ? '此笔记暂无待办事项' : '暂无待办事项'}
            </div>
          ) : (
            todos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onComplete={handleComplete}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleAutoCompletion={handleToggleAutoCompletion}
                onUpdateSuccess={loadData}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  )
}
