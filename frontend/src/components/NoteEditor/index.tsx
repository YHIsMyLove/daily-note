/**
 * 统一笔记编辑器组件
 * 支持新建和编辑两种模式，支持行内编辑
 * 紧凑布局，支持分类和标签选择，星星选择重要性
 */
'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Card } from '../ui/card'
import { Send, X, Folder, Tag, Eye, EyeOff } from 'lucide-react'
import { CategorySelector } from './CategorySelector'
import { TagSelector } from './TagSelector'
import { ImportanceStars } from './ImportanceStars'
import { UpdateNoteRequest } from '@daily-note/shared'
import { Loader2 } from 'lucide-react'
import { MarkdownViewer } from '../MarkdownViewer'

export interface NoteEditorData {
  content: string
  category?: string
  tags?: string[]
  importance?: number
}

interface NoteEditorProps {
  // 模式：create | edit
  mode: 'create' | 'edit'

  // 编辑模式的初始数据
  initialData?: {
    content?: string
    category?: string
    tags?: string[]
    importance?: number
  }

  // 回调函数
  onSubmit: (data: NoteEditorData) => Promise<void> | void
  onCancel?: () => void

  // UI 配置
  placeholder?: string
  autoFocus?: boolean

  // 功能开关
  showCategory?: boolean
  showTags?: boolean
  showImportance?: boolean

  // 状态
  disabled?: boolean
  loading?: boolean
}

export function NoteEditor({
  mode = 'create',
  initialData,
  onSubmit,
  onCancel,
  placeholder = '今天有什么想记录的？...',
  autoFocus = false,
  showCategory = true,
  showTags = true,
  showImportance = true,
  disabled = false,
  loading = false,
}: NoteEditorProps) {
  // 表单状态
  const [content, setContent] = useState(initialData?.content || '')
  const [category, setCategory] = useState(initialData?.category || '')
  const [tags, setTags] = useState<string[]>(initialData?.tags || [])
  const [importance, setImportance] = useState(initialData?.importance || 0)
  const [showPreview, setShowPreview] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动聚焦
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  // 处理提交
  const handleSubmit = async () => {
    if (!content.trim()) return

    const data: NoteEditorData = {
      content: content.trim(),
      ...(showCategory && category && { category }),
      ...(showTags && tags.length > 0 && { tags }),
      ...(showImportance && importance > 0 && { importance }),
    }

    await onSubmit(data)

    // 创建模式下清空表单
    if (mode === 'create') {
      setContent('')
      setCategory('')
      setTags([])
      setImportance(0)
    }
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (mode === 'edit' && onCancel) {
        onCancel()
      } else {
        setContent('')
        setTags([])
      }
    }
  }

  // 处理取消
  const handleCancel = () => {
    if (mode === 'edit' && onCancel) {
      onCancel()
    } else {
      setContent('')
      setCategory('')
      setTags([])
      setImportance(0)
    }
  }

  const canSubmit = content.trim().length > 0 && !disabled && !loading

  return (
    <Card className="border-primary/20 shadow-lg overflow-hidden focus-within:border-primary/50 transition-colors">
      {/* 紧凑布局：padding 减小 */}
      <div className="p-3 space-y-2">
        {/* 内容输入区 - 紧凑模式 */}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || loading}
          className="min-h-[60px] resize-none bg-transparent border-0 focus:ring-0 focus:outline-none"
          rows={4}
        />

        {/* Markdown 预览区域 */}
        {showPreview && content.trim() && (
          <div className="border-t border-border/50 pt-2">
            <div className="text-xs text-text-muted mb-1">预览</div>
            <div className="bg-slate-900/30 rounded p-2 max-h-60 overflow-y-auto">
              <MarkdownViewer
                content={content}
                className="text-sm"
              />
            </div>
          </div>
        )}

        {/* 选项区域 - 单行紧凑布局 */}
          <div className="flex items-center gap-4 pt-2 border-t border-border/50 flex-wrap">
            {/* 分类选择 - 紧凑版 */}
            {showCategory && (
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-text-muted" />
                <CategorySelector
                  value={category}
                  onChange={setCategory}
                  compact
                />
              </div>
            )}

            {/* 分隔线 */}
            {(showCategory && showTags) && (
              <div className="h-4 w-px bg-border/50" />
            )}

            {/* 标签选择 - 紧凑版 */}
            {showTags && (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-text-muted" />
                <TagSelector
                  value={tags}
                  onChange={setTags}
                  compact
                />
              </div>
            )}

            {/* 分隔线 */}
            {((showCategory || showTags) && showImportance) && (
              <div className="h-4 w-px bg-border/50" />
            )}

            {/* 重要性选择 - 紧凑版 */}
            {showImportance && (
              <ImportanceStars
                value={importance}
                onChange={setImportance}
                size="sm"
                disabled={disabled || loading}
                showLabel={false}
              />
            )}
          </div>

        {/* 操作按钮区 - 紧凑布局 */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Markdown 预览切换按钮 */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              disabled={disabled || loading}
              className="h-6 px-2 text-xs text-text-muted hover:text-text-primary"
              title={showPreview ? '隐藏预览' : '显示预览'}
            >
              {showPreview ? (
                <EyeOff className="h-3.5 w-3.5 mr-1" />
              ) : (
                <Eye className="h-3.5 w-3.5 mr-1" />
              )}
              预览
            </Button>

            {/* 字数统计提示 */}
            <span className="text-xs text-text-muted">
              {content.length} 字 · Ctrl+Enter 提交
              {mode === 'edit' && ' · Esc 取消'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* 取消按钮（仅编辑模式） */}
            {mode === 'edit' && onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={disabled || loading}
              >
                <X className="h-4 w-4 mr-1" />
                取消
              </Button>
            )}

            {/* 提交按钮 */}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              size="sm"
              className="shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {mode === 'create' ? '提交' : '保存'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
