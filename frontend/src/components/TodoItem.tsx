/**
 * 待办事项卡片组件
 * 支持嵌套结构显示、折叠展开、添加子任务
 */
'use client'

import { useState } from 'react'
import { Todo, TodoPriority } from '@daily-note/shared'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { formatDateTime, formatRelativeTime } from '@/lib/utils'
import {
  Check,
  Loader2,
  Calendar,
  AlertCircle,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Plus,
  Edit,
} from 'lucide-react'
import { Button } from './ui/button'
import { todosApi } from '@/lib/api'

interface TodoItemProps {
  todo: Todo
  level: number            // 0=根任务, 1=子任务, 2=孙任务
  hasChildren: boolean
  isCollapsed: boolean
  onToggleCollapse: (id: string) => void
  onComplete: (id: string) => void
  onAddSubTask: (parentId: string) => void
  onEdit: (todo: Todo) => void
  onUpdateSuccess?: () => void
}

// 优先级配置（根据时间紧迫度显示）
const priorityConfig: Record<TodoPriority, { label: string; className: string }> = {
  LOW: { label: '低', className: 'bg-slate-600/30 text-slate-400 border-slate-600/40' },
  MEDIUM: { label: '中', className: 'bg-yellow-600/30 text-yellow-300 border-yellow-600/40' },
  HIGH: { label: '高', className: 'bg-orange-600/30 text-orange-300 border-orange-600/40' },
  URGENT: { label: '紧急', className: 'bg-red-600/30 text-red-300 border-red-600/40' },
}

export function TodoItem({
  todo,
  level,
  hasChildren,
  isCollapsed,
  onToggleCollapse,
  onComplete,
  onAddSubTask,
  onEdit,
  onUpdateSuccess,
}: TodoItemProps) {
  const [completing, setCompleting] = useState(false)
  const isCompleted = todo.status === 'COMPLETED'
  const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date() && !isCompleted

  // 计算缩进样式
  const indentStyle = {
    marginLeft: `${level * 16}px`,
    paddingLeft: `${level * 8 + 12}px`,
  }

  // 连接线样式
  const treeLineStyle = {
    position: 'absolute' as const,
    left: `${level * 16 + 7}px`,
    top: 0,
    bottom: 0,
    width: '1px',
    backgroundColor: 'hsl(var(--border))',
  }

  // 完成待办
  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (completing || isCompleted) return

    try {
      setCompleting(true)
      await todosApi.complete(todo.id)
      onComplete(todo.id)
      onUpdateSuccess?.()
    } catch (error) {
      console.error('Failed to complete todo:', error)
    } finally {
      setCompleting(false)
    }
  }

  const priority = priorityConfig[todo.priority] || priorityConfig.MEDIUM

  return (
    <div className="relative">
      {/* 连接线 */}
      {level > 0 && <div style={treeLineStyle} />}

      <Card
        className={`group relative bg-card/50 border-border/50 hover:bg-card/80 hover:border-border transition-all duration-200 ${
          isCompleted ? 'opacity-50' : ''
        }`}
      >
        <div className="p-3" style={indentStyle}>
          {/* 第一行：折叠按钮 + 完成复选框 + 标题 */}
          <div className="flex items-start gap-2 mb-2">
            {/* 折叠按钮 */}
            {hasChildren && (
              <button
                onClick={() => onToggleCollapse(todo.id)}
                className="mt-0.5 flex-shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            )}

            {/* 占位符（保持对齐） */}
            {!hasChildren && <div className="w-4 h-4 flex-shrink-0" />}

            {/* 完成复选框 */}
            <button
              onClick={handleComplete}
              disabled={completing || isCompleted}
              className={`
                mt-0.5 flex-shrink-0 w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-all
                ${isCompleted
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-border hover:border-primary hover:bg-primary/10'
                }
                ${completing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              title={isCompleted ? '已完成' : '标记为完成'}
            >
              {completing ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : isCompleted ? (
                <Check className="h-2.5 w-2.5" />
              ) : null}
            </button>

            {/* 标题 */}
            <h3 className={`flex-1 text-sm font-medium leading-snug ${
              isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
            }`}>
              {todo.title}
            </h3>

            {/* 操作按钮组 */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* 编辑按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(todo)}
                className="h-6 px-2 text-xs text-primary flex-shrink-0"
              >
                <Edit className="w-3 h-3" />
              </Button>
              {/* 添加子任务按钮 */}
              {level < 2 && !isCompleted && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddSubTask(todo.id)}
                  className="h-6 px-2 text-xs text-primary flex-shrink-0"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  子任务
                </Button>
              )}
            </div>
          </div>

          {/* 第二行：标签 */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2 ml-6">
            {/* 优先级标签（基于时间紧迫度） */}
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 border ${priority.className}`}
            >
              {priority.label}
            </Badge>

            {/* AI 提取标记 */}
            {todo.isAiGenerated && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 border bg-purple-500/20 text-purple-300 border-purple-500/30"
              >
                <Sparkles className="h-2.5 w-2.5 mr-1" />
                AI 提取
              </Badge>
            )}

            {/* 逾期标记 */}
            {isOverdue && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 border bg-red-500/20 text-red-300 border-red-500/30"
              >
                <AlertCircle className="h-2.5 w-2.5 mr-1" />
                已逾期
              </Badge>
            )}

            {/* 用户标签 */}
            {todo.metadata?.tags?.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 border bg-muted/50 text-muted-foreground border-border/50"
              >
                #{tag}
              </Badge>
            ))}
          </div>

          {/* 第三行：描述内容 */}
          {todo.description && (
            <p className={`text-xs ml-6 ${
              isCompleted ? 'text-muted-foreground/50 line-through' : 'text-muted-foreground'
            }`}>
              {todo.description}
            </p>
          )}

          {/* 底部元信息：截止日期 */}
          {todo.dueDate && (
            <div className="flex items-center gap-3 mt-2 ml-6 text-[10px] text-muted-foreground">
              <span
                className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : ''}`}
                title={`截止日期: ${formatDateTime(todo.dueDate)}`}
              >
                <Calendar className="h-2.5 w-2.5" />
                {formatRelativeTime(todo.dueDate)}
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
