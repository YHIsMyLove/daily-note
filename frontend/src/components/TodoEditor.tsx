/**
 * 待办编辑器组件
 * 嵌入式编辑器，支持新建和编辑两种模式
 */
'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Plus, Sparkles, Calendar, Clock, X } from 'lucide-react'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { TodoPriority, CreateTodoRequest, UpdateTodoRequest, Todo } from '@daily-note/shared'
import { toast } from 'sonner'
import { toISOLocalDate } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface TodoEditorProps {
  mode: 'create' | 'edit'
  initialData?: Todo | null
  onSubmit: () => void | Promise<void>
  onCancel: () => void
}

// 优先级选项
const PRIORITY_OPTIONS: Array<{ value: TodoPriority; label: string; color: string }> = [
  { value: 'LOW', label: '低', color: 'bg-slate-500' },
  { value: 'MEDIUM', label: '中', color: 'bg-blue-500' },
  { value: 'HIGH', label: '高', color: 'bg-orange-500' },
  { value: 'URGENT', label: '紧急', color: 'bg-red-500' },
]

export function TodoEditor({ mode, initialData, onSubmit, onCancel }: TodoEditorProps) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [priority, setPriority] = useState<TodoPriority>(initialData?.priority || 'MEDIUM')
  const [dueDate, setDueDate] = useState<string>(
    initialData?.dueDate ? toISOLocalDate(new Date(initialData.dueDate)) : ''
  )
  const [estimatedTime, setEstimatedTime] = useState<string>(
    initialData?.metadata?.estimatedTime?.toString() || ''
  )
  const [autoCompletionEnabled, setAutoCompletionEnabled] = useState(
    initialData?.autoCompletionEnabled || false
  )
  const [submitting, setSubmitting] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)

  // 自动聚焦标题输入框
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus()
    }
  }, [])

  // 处理提交
  const handleSubmit = async () => {
    // 验证标题
    if (!title.trim()) {
      toast.error('请输入待办标题')
      return
    }

    try {
      setSubmitting(true)

      if (mode === 'create') {
        const { todosApi } = await import('@/lib/api')
        // 构建请求数据
        const data: CreateTodoRequest = {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          autoCompletionEnabled,
          autoLinkToDailyNote: true,
          metadata: {
            estimatedTime: estimatedTime ? parseInt(estimatedTime) : undefined,
          },
        }

        await todosApi.create(data)

        toast.success('待办创建成功', {
          description: title,
        })
      } else {
        // 编辑模式 - 更新待办
        const { todosApi } = await import('@/lib/api')
        const updateData: UpdateTodoRequest = {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          autoCompletionEnabled,
          metadata: {
            estimatedTime: estimatedTime ? parseInt(estimatedTime) : undefined,
          },
        }

        await todosApi.update(initialData!.id, updateData)

        toast.success('待办更新成功', {
          description: title,
        })
      }

      await onSubmit()
    } catch (error) {
      console.error('Failed to save todo:', error)
      toast.error(mode === 'create' ? '创建待办失败' : '更新待办失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // 获取今天日期（默认值）
  const getTodayDate = () => {
    return toISOLocalDate(new Date())
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  const canSubmit = title.trim().length > 0 && !submitting

  return (
    <Card className="border-primary/20 shadow-lg overflow-hidden focus-within:border-primary/80 transition-all duration-300">
      {/* 头部：返回按钮 + 标题 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
            className="h-7 w-7 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-semibold flex items-center gap-2">
            {mode === 'create' ? (
              <>
                <Plus className="h-4 w-4" />
                新建待办
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                编辑待办
              </>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
            className="h-7 px-2 text-xs"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            size="sm"
            className="h-7 px-3 text-xs"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {mode === 'create' ? '创建中' : '保存中'}
              </>
            ) : (
              <>
                {mode === 'create' ? (
                  <Plus className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                )}
                {mode === 'create' ? '创建' : '保存'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* 标题输入 */}
        <div className="space-y-1.5">
          <Label htmlFor="todo-title" className="text-sm">
            标题 <span className="text-red-500">*</span>
          </Label>
          <Input
            ref={titleInputRef}
            id="todo-title"
            placeholder="输入待办标题..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting}
            maxLength={200}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {title.length}/200
          </p>
        </div>

        {/* 描述输入 */}
        <div className="space-y-1.5">
          <Label htmlFor="todo-description" className="text-sm">
            描述
          </Label>
          <Textarea
            id="todo-description"
            placeholder="添加详细描述（可选）..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting}
            rows={3}
            maxLength={1000}
            className="text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {description.length}/1000
          </p>
        </div>

        {/* 优先级选择 */}
        <div className="space-y-1.5">
          <Label className="text-sm">优先级</Label>
          <div className="flex flex-wrap gap-2">
            {PRIORITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriority(option.value)}
                disabled={submitting}
                className={`
                  px-3 py-1.5 rounded-md text-sm font-medium transition-all
                  ${priority === option.value
                    ? `${option.color} text-white shadow-md`
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }
                  ${submitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 截止日期 */}
        <div className="space-y-1.5">
          <Label htmlFor="todo-due-date" className="text-sm flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            截止日期
          </Label>
          <Input
            id="todo-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={submitting}
            min={getTodayDate()}
            className="text-sm"
          />
        </div>

        {/* 预计时间 */}
        <div className="space-y-1.5">
          <Label htmlFor="todo-estimated-time" className="text-sm flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            预计时间（分钟）
          </Label>
          <Input
            id="todo-estimated-time"
            type="number"
            placeholder="例如：30"
            value={estimatedTime}
            onChange={(e) => setEstimatedTime(e.target.value)}
            disabled={submitting}
            min={1}
            max={1440}
            className="text-sm"
          />
        </div>

        {/* AI 自动完成开关 */}
        {mode === 'create' && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <Label htmlFor="auto-completion" className="text-sm cursor-pointer">
                  AI 自动完成
                </Label>
                <p className="text-xs text-muted-foreground">
                  启用后，AI 将尝试自动完成此待办
                </p>
              </div>
            </div>
            <Switch
              id="auto-completion"
              checked={autoCompletionEnabled}
              onCheckedChange={setAutoCompletionEnabled}
              disabled={submitting}
            />
          </div>
        )}

        {/* 提示信息 */}
        {mode === 'create' && (
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-300">
              此待办将自动关联到今日待办笔记，您可以在笔记中查看和管理所有待办事项。
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
