/**
 * 待办事项卡片组件
 * 支持完成、编辑、删除、AI 自动完成等功能
 */
'use client'

import { useState } from 'react'
import { Todo, TodoStatus, TodoPriority } from '@daily-note/shared'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { formatDateTime, formatRelativeTime } from '@/lib/utils'
import {
  MoreVertical,
  Check,
  Edit2,
  Trash2,
  Loader2,
  Sparkles,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Button } from './ui/button'
import { todosApi } from '@/lib/api'

interface TodoItemProps {
  todo: Todo
  onComplete?: (todoId: string) => void
  onEdit?: (todo: Todo) => void
  onDelete?: (todoId: string) => void
  onToggleAutoCompletion?: (todoId: string, enabled: boolean) => void
  onUpdateSuccess?: () => void
}

// 状态颜色映射
const statusColors: Record<TodoStatus, string> = {
  PENDING: 'bg-gray-500/15 text-gray-300 border border-gray-500/25',
  NEEDS_REVIEW: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/25',
  RUNNING: 'bg-blue-500/15 text-blue-300 border border-blue-500/25',
  COMPLETED: 'bg-green-500/15 text-green-300 border border-green-500/25',
  FAILED: 'bg-red-500/15 text-red-300 border border-red-500/25',
  CANCELLED: 'bg-gray-400/15 text-gray-400 border border-gray-400/25',
}

// 优先级颜色映射
const priorityColors: Record<TodoPriority, string> = {
  LOW: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
  MEDIUM: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  HIGH: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  URGENT: 'bg-red-500/20 text-red-300 border border-red-500/30',
}

// 状态文本映射
const statusLabels: Record<TodoStatus, string> = {
  PENDING: '待处理',
  NEEDS_REVIEW: '待审核',
  RUNNING: '进行中',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELLED: '已取消',
}

// 优先级文本映射
const priorityLabels: Record<TodoPriority, string> = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '紧急',
}

export function TodoItem({
  todo,
  onComplete,
  onEdit,
  onDelete,
  onToggleAutoCompletion,
  onUpdateSuccess,
}: TodoItemProps) {
  const [loading, setLoading] = useState(false)
  const [completing, setCompleting] = useState(false)

  const statusColor = statusColors[todo.status] || statusColors.PENDING
  const priorityColor = priorityColors[todo.priority] || priorityColors.MEDIUM
  const isCompleted = todo.status === 'COMPLETED'
  const isFailed = todo.status === 'FAILED'

  // 完成待办
  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (completing || isCompleted) return

    try {
      setCompleting(true)
      await todosApi.complete(todo.id)
      onComplete?.(todo.id)
      onUpdateSuccess?.()
    } catch (error) {
      console.error('Failed to complete todo:', error)
    } finally {
      setCompleting(false)
    }
  }

  // 编辑待办
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit?.(todo)
  }

  // 删除待办
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete?.(todo.id)
  }

  // 切换 AI 自动完成（用于开关组件）
  const handleSwitchAutoCompletion = async (checked: boolean) => {
    try {
      setLoading(true)
      if (checked) {
        await todosApi.enableAutoCompletion(todo.id)
      } else {
        await todosApi.disableAutoCompletion(todo.id)
      }
      onToggleAutoCompletion?.(todo.id, checked)
      onUpdateSuccess?.()
    } catch (error) {
      console.error('Failed to toggle auto-completion:', error)
    } finally {
      setLoading(false)
    }
  }

  // 切换 AI 自动完成（用于菜单项）
  const handleToggleAutoCompletion = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await handleSwitchAutoCompletion(!todo.autoCompletionEnabled)
  }

  // 检查是否逾期
  const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date() && !isCompleted

  return (
    <Card
      className={`hover:shadow-card-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group bg-background-card/80 backdrop-blur-sm shadow-card p-4 relative ${
        isCompleted ? 'opacity-60' : ''
      }`}
    >
      {/* 完成复选框 */}
      <div className="absolute top-4 left-4">
        <button
          onClick={handleComplete}
          disabled={completing || isCompleted}
          className={`
            w-5 h-5 rounded border-2 flex items-center justify-center transition-all
            ${isCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-400 hover:border-green-500 hover:bg-green-500/10'
            }
            ${completing ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          title={isCompleted ? '已完成' : '标记为完成'}
        >
          {completing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isCompleted ? (
            <Check className="h-3 w-3" />
          ) : null}
        </button>
      </div>

      {/* 操作按钮 - 仅在 hover 时显示 */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={handleEdit} disabled={isCompleted}>
              <Edit2 className="h-4 w-4 mr-2" />
              编辑
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleAutoCompletion} disabled={loading || isCompleted}>
              <Sparkles className="h-4 w-4 mr-2" />
              {todo.autoCompletionEnabled ? '禁用 AI 自动完成' : '启用 AI 自动完成'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-red-500">
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 内容区域 */}
      <div className="ml-10 pr-8">
        {/* 头部：状态 + 优先级 + AI 生成标记 + 逾期标记 */}
        <div className="flex items-center gap-1.5 mb-2">
          <Badge variant="outline" className={`text-xs px-1.5 py-0.5 ${statusColor}`}>
            {statusLabels[todo.status]}
          </Badge>
          <Badge variant="outline" className={`text-xs px-1.5 py-0.5 ${priorityColor}`}>
            {priorityLabels[todo.priority]}
          </Badge>
          {todo.isAiGenerated && (
            <Badge
              variant="outline"
              className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              AI 提取
            </Badge>
          )}
          {isOverdue && (
            <Badge
              variant="outline"
              className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-300 border border-red-500/30"
            >
              <AlertCircle className="h-3 w-3 mr-1" />
              已逾期
            </Badge>
          )}
          {todo.autoCompletionEnabled && !isCompleted && (
            <Badge
              variant="outline"
              className="text-xs px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              AI 自动完成
            </Badge>
          )}
        </div>

        {/* 标题 */}
        <h3 className={`text-base font-semibold mb-1 ${isCompleted ? 'line-through text-text-muted' : 'text-text-primary'}`}>
          {todo.title}
        </h3>

        {/* 描述 */}
        {todo.description && (
          <p className={`text-sm mb-2 ${isCompleted ? 'text-text-muted/70 line-through' : 'text-text-secondary'} line-clamp-2`}>
            {todo.description}
          </p>
        )}

        {/* 底部元信息：截止日期 + 创建时间 + 自动完成错误 */}
        <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
          {/* 截止日期 */}
          {todo.dueDate && (
            <span
              className={`flex items-center gap-0.5 ${isOverdue ? 'text-red-400' : ''}`}
              title={`截止日期: ${formatDateTime(todo.dueDate)}`}
            >
              <Calendar className="h-3 w-3" />
              {formatRelativeTime(todo.dueDate)}
            </span>
          )}

          {/* 创建时间 */}
          <span title={`创建于 ${formatDateTime(todo.createdAt)}`}>
            创建于 {formatRelativeTime(todo.createdAt)}
          </span>

          {/* 自动完成错误信息 */}
          {isFailed && todo.autoCompletionError && (
            <span className="flex items-center gap-0.5 text-red-400" title={todo.autoCompletionError}>
              <AlertCircle className="h-3 w-3" />
              自动完成失败
            </span>
          )}
        </div>

        {/* 元数据标签 */}
        {todo.metadata?.tags && todo.metadata.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {todo.metadata.tags.map((tag) => (
              <Badge
                key={tag}
                variant="default"
                className="text-[10px] px-1.5 py-0 bg-slate-500/15 text-slate-300 border border-slate-500/25"
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* AI 自动完成开关 - 仅在未完成时显示 */}
        {!isCompleted && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
            <Switch
              id={`auto-complete-${todo.id}`}
              checked={todo.autoCompletionEnabled}
              onCheckedChange={handleSwitchAutoCompletion}
              disabled={loading}
              onClick={(e) => e.stopPropagation()}
            />
            <Label
              htmlFor={`auto-complete-${todo.id}`}
              className="text-xs text-text-secondary cursor-pointer flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Sparkles className="h-3 w-3" />
              AI 自动完成
            </Label>
            {loading && (
              <Loader2 className="h-3 w-3 animate-spin text-text-muted" />
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
