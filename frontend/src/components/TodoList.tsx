'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { RefreshCw, Circle, AlertCircle, Loader2, CheckCircle2, XCircle, Plus } from 'lucide-react'
import { todosApi } from '@/lib/api'
import { Todo, TodoStatus, TodoPriority, TodoStats } from '@daily-note/shared'
import { useSSE } from '@/hooks/useSSE'
import { SSEEventData } from '@/lib/sse'
import { TodoItem } from './TodoItem'
import { TodoEditor } from './TodoEditor'

/**
 * 待办状态配置（用于显示单个任务的状态）
 */
const STATUS_CONFIG: Record<
  TodoStatus,
  { icon: any; color: string; label: string }
> = {
  PENDING: {
    icon: Circle,
    color: 'text-gray-400',
    label: '待处理',
  },
  NEEDS_REVIEW: {
    icon: AlertCircle,
    color: 'text-yellow-400',
    label: '待审核',
  },
  RUNNING: {
    icon: Loader2,
    color: 'text-blue-400',
    label: '进行中',
  },
  COMPLETED: {
    icon: CheckCircle2,
    color: 'text-green-400',
    label: '已完成',
  },
  FAILED: {
    icon: XCircle,
    color: 'text-red-400',
    label: '失败',
  },
  CANCELLED: {
    icon: Circle,
    color: 'text-gray-500',
    label: '已取消',
  },
}

/**
 * 筛选状态配置（只保留未完成/已完成两种）
 */
type FilterStatus = '' | 'incomplete' | 'completed'

const FILTER_STATUS_CONFIG: Record<
  Exclude<FilterStatus, ''>,
  { label: string }
> = {
  incomplete: { label: '未完成' },
  completed: { label: '已完成' },
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
 * 将平铺的 todo 列表转换为树形结构
 */
function buildTodoTree(todos: Todo[]): Todo[] {
  const todoMap = new Map<string, Todo>()
  const rootTodos: Todo[] = []

  // 第一遍：创建映射并初始化 children
  todos.forEach((todo) => {
    todoMap.set(todo.id, { ...todo, children: [] })
  })

  // 第二遍：构建树形结构
  todos.forEach((todo) => {
    const enrichedTodo = todoMap.get(todo.id)!
    if (todo.parentId && todoMap.has(todo.parentId)) {
      const parent = todoMap.get(todo.parentId)!
      if (!parent.children) parent.children = []
      parent.children.push(enrichedTodo)
    } else {
      rootTodos.push(enrichedTodo)
    }
  })

  return rootTodos
}

/**
 * TodoList 组件
 *
 * 功能：
 * - 显示待办列表（带状态和优先级筛选）
 * - 显示统计信息
 * - 通过 SSE 实时更新
 * - 支持嵌套任务结构（最多3级）
 * - 完成待办功能
 * - 添加子任务功能
 */
export function TodoList({ noteId }: TodoListProps) {
  const queryClient = useQueryClient()
  const [todos, setTodos] = useState<Todo[]>([])
  const [stats, setStats] = useState<TodoStats | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('incomplete')
  const [selectedPriority, setSelectedPriority] = useState<TodoPriority | ''>('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // 编辑器状态：undefined=显示列表，null=新建模式，Todo=编辑模式
  const [editingTodo, setEditingTodo] = useState<Todo | null | undefined>(undefined)
  // 折叠状态管理
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  // SSE 实时监听
  useSSE(undefined, {
    onTodoCreated: (data: SSEEventData) => {
      const todo = data as unknown as Todo
      if (noteId && todo.noteId !== noteId) return
      // 防御性检查：确保 status 和 priority 存在
      const todoStatus = todo.status || 'PENDING'
      const todoPriority = todo.priority || 'MEDIUM'
      const statusMatch = checkStatusMatch(selectedStatus, todoStatus)
      const priorityMatch = !selectedPriority || selectedPriority === todoPriority
      if (statusMatch && priorityMatch) {
        setTodos((prev) => [...prev, todo])
      }
    },
    onTodoUpdated: (data: SSEEventData) => {
      const todo = data as unknown as Todo
      if (noteId && todo.noteId !== noteId) return

      // 防御性检查：确保 status 和 priority 存在
      const todoStatus = todo.status || 'PENDING'
      const todoPriority = todo.priority || 'MEDIUM'
      const statusMatch = checkStatusMatch(selectedStatus, todoStatus)
      const priorityMatch = !selectedPriority || selectedPriority === todoPriority

      setTodos((prev) => {
        const exists = prev.find((t) => t.id === todo.id)
        if (!exists) {
          return statusMatch && priorityMatch ? [...prev, todo] : prev
        }
        // 更新现有任务：符合条件则更新，否则移除
        if (statusMatch && priorityMatch) {
          return prev.map((t) => (t.id === todo.id ? todo : t))
        }
        return prev.filter((t) => t.id !== todo.id)
      })
    },
    onTodoCompleted: (data: SSEEventData) => {
      const todo = data as unknown as Todo
      if (noteId && todo.noteId !== noteId) return

      // 防御性检查：确保 priority 存在
      const todoPriority = todo.priority || 'MEDIUM'
      const statusMatch = checkStatusMatch(selectedStatus, 'COMPLETED')
      const priorityMatch = !selectedPriority || selectedPriority === todoPriority

      setTodos((prev) => {
        if (statusMatch && priorityMatch) {
          return prev.map((t) =>
            t.id === todo.id
              ? { ...t, status: 'COMPLETED' as TodoStatus, completedAt: todo.completedAt }
              : t
          )
        }
        return prev.filter((t) => t.id !== todo.id)
      })
    },
    onTodoDeleted: (data: SSEEventData) => {
      const todo = data as unknown as Todo
      setTodos((prev) => prev.filter((t) => t.id !== todo.id))
    },
    onStatsUpdated: (data: SSEEventData) => {
      setStats(data as unknown as TodoStats)
      queryClient.setQueryData(['todos-stats'], { success: true, data })
    },
  })

  /**
   * 检查状态是否匹配筛选条件
   */
  const checkStatusMatch = (filter: FilterStatus, todoStatus: TodoStatus): boolean => {
    if (!filter) return true
    if (filter === 'completed') return todoStatus === 'COMPLETED'
    return todoStatus !== 'COMPLETED' // incomplete 匹配所有非已完成状态
  }

  /**
   * 加载数据
   */
  const loadData = async () => {
    try {
      setRefreshing(true)

      const query: {
        noteId?: string
        status?: TodoStatus
        priority?: TodoPriority
      } = {}

      if (noteId) query.noteId = noteId
      // 只在筛选"已完成"时传递 status 参数
      if (selectedStatus === 'completed') query.status = 'COMPLETED'
      // "未完成"筛选通过前端过滤实现
      if (selectedPriority) query.priority = selectedPriority

      const [todosRes, statsRes] = await Promise.all([
        todosApi.list(Object.keys(query).length > 0 ? { filters: query } : undefined),
        todosApi.stats(),
      ])

      let todosList = todosRes.data?.todos ?? []
      // 前端过滤未完成状态
      if (selectedStatus === 'incomplete') {
        todosList = todosList.filter((t) => t.status !== 'COMPLETED')
      }

      setTodos(todosList)
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
    setTodos((prev) => {
      const updateTodo = (todos: Todo[]): Todo[] => {
        return todos.map((t) => {
          if (t.id === todoId) {
            return { ...t, status: 'COMPLETED' as TodoStatus, completedAt: new Date() }
          }
          if (t.children) {
            return { ...t, children: updateTodo(t.children) }
          }
          return t
        })
      }
      return updateTodo(prev)
    })
  }

  /**
   * 切换折叠状态
   */
  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /**
   * 添加子任务
   */
  const handleAddSubTask = async (parentId: string) => {
    const title = prompt('请输入子任务标题:')
    if (!title) return

    try {
      await todosApi.createSubTask(parentId, { title })
      await loadData()
    } catch (error) {
      console.error('Failed to create subtask:', error)
      alert('创建子任务失败')
    }
  }

  /**
   * 初始加载数据
   */
  useEffect(() => {
    loadData()
  }, [selectedStatus, selectedPriority, noteId])

  // 构建树形结构
  const todoTree = buildTodoTree(todos)

  /**
   * 递归渲染任务树
   */
  const renderTodo = (todo: Todo) => {
    const isCollapsed = collapsedIds.has(todo.id)
    const hasChildren = todo.children && todo.children.length > 0

    return (
      <div key={todo.id}>
        <TodoItem
          todo={todo}
          level={todo.level}
          hasChildren={hasChildren}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
          onComplete={handleComplete}
          onAddSubTask={handleAddSubTask}
          onEdit={setEditingTodo}
          onUpdateSuccess={loadData}
        />

        {/* 渲染子任务 */}
        {hasChildren && !isCollapsed && (
          <div>
            {todo.children!.map((child) => renderTodo(child))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* 编辑器模式 */}
      {editingTodo !== undefined ? (
        <TodoEditor
          mode={editingTodo === null ? 'create' : 'edit'}
          initialData={editingTodo || undefined}
          onSubmit={async () => {
            setEditingTodo(undefined)
            await loadData()
          }}
          onCancel={() => setEditingTodo(undefined)}
        />
      ) : (
        <>
          {/* 头部 */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">
              {noteId ? '笔记待办' : '待办事项'}
            </h2>
            <div className="flex items-center gap-1.5">
              {!noteId && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setEditingTodo(null)}
                  className="h-7 px-2 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  新建
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={refreshing}
                className="h-7 w-7 p-0"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

      {/* 统计信息 - 紧凑显示 */}
      {stats && !noteId && (
        <div className="flex flex-wrap gap-2 mb-3 text-[10px]">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50">
            <Circle className="w-2.5 h-2.5 text-gray-400" />
            <span className="text-muted-foreground">待处理: {stats.byStatus?.PENDING ?? 0}</span>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50">
            <AlertCircle className="w-2.5 h-2.5 text-yellow-400" />
            <span className="text-muted-foreground">待审核: {stats.byStatus?.NEEDS_REVIEW ?? 0}</span>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50">
            <Loader2 className="w-2.5 h-2.5 text-blue-400" />
            <span className="text-muted-foreground">进行中: {stats.byStatus?.RUNNING ?? 0}</span>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50">
            <CheckCircle2 className="w-2.5 h-2.5 text-green-400" />
            <span className="text-muted-foreground">已完成: {stats.byStatus?.COMPLETED ?? 0}</span>
          </div>
          {stats.overdue > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10">
              <AlertCircle className="w-2.5 h-2.5 text-red-400" />
              <span className="text-red-400">已逾期: {stats.overdue}</span>
            </div>
          )}
        </div>
      )}

      {/* 筛选器 - 两行布局 */}
      {!noteId && (
        <div className="flex flex-col gap-2 mb-3">
          {/* 状态筛选 - 第一行 */}
          <div className="flex items-center gap-1 bg-muted/30 rounded-md p-0.5 overflow-x-auto">
            <button
              onClick={() => setSelectedStatus('')}
              className={`
                px-3 py-1 rounded text-[10px] font-medium transition-all whitespace-nowrap
                ${selectedStatus === ''
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
            >
              全部
            </button>
            <button
              onClick={() => setSelectedStatus('incomplete')}
              className={`
                px-3 py-1 rounded text-[10px] font-medium transition-all whitespace-nowrap
                ${selectedStatus === 'incomplete'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
            >
              未完成
            </button>
            <button
              onClick={() => setSelectedStatus('completed')}
              className={`
                px-3 py-1 rounded text-[10px] font-medium transition-all whitespace-nowrap
                ${selectedStatus === 'completed'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
            >
              已完成
            </button>
          </div>

          {/* 优先级筛选 - 第二行 */}
          <div className="flex items-center gap-1 bg-muted/30 rounded-md p-0.5 overflow-x-auto">
            <button
              onClick={() => setSelectedPriority('')}
              className={`
                px-2 py-1 rounded text-[10px] font-medium transition-all whitespace-nowrap
                ${selectedPriority === ''
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
            >
              全部优先级
            </button>
            {(Object.keys(PRIORITY_CONFIG) as TodoPriority[]).map((priority) => (
              <button
                key={priority}
                onClick={() => setSelectedPriority(priority)}
                className={`
                  px-2 py-1 rounded text-[10px] font-medium transition-all whitespace-nowrap
                  ${selectedPriority === priority
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }
                `}
              >
                {PRIORITY_CONFIG[priority].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 待办列表 */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              加载中...
            </div>
          ) : todoTree.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              {noteId ? '此笔记暂无待办事项' : '暂无待办事项'}
            </div>
          ) : (
            todoTree.map((todo) => renderTodo(todo))
          )}
        </div>
      </ScrollArea>
        </>
      )}
    </div>
  )
}
