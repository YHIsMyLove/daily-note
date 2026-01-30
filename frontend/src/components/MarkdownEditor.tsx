/**
 * Markdown 编辑器组件
 * 使用 @mdxeditor/editor 提供富文本 Markdown 编辑功能
 * 支持实时预览、工具栏、快捷键等
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { MDXEditor, type MDXEditorMethods } from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Save, X, Loader2, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

/**
 * Markdown 编辑器数据接口
 */
export interface MarkdownEditorData {
  content: string
  category?: string
  tags?: string[]
  importance?: number
}

interface MarkdownEditorProps {
  /** 初始 Markdown 内容 */
  initialContent?: string
  /** 保存回调函数 */
  onSave: (data: MarkdownEditorData) => Promise<void> | void
  /** 取消回调函数 */
  onCancel?: () => void
  /** 是否显示返回按钮 */
  showBackButton?: boolean
  /** 占位符文本 */
  placeholder?: string
  /** 禁用状态 */
  disabled?: boolean
  /** 加载状态 */
  loading?: boolean
  /** 额外的元数据（分类、标签等） */
  metadata?: Omit<MarkdownEditorData, 'content'>
}

/**
 * Markdown 编辑器组件
 *
 * 提供功能完整的 Markdown 编辑体验，包括：
 * - 实时预览
 * - 工具栏（格式化、链接、图片等）
 * - 快捷键支持
 * - 保存/取消操作
 *
 * @example
 * ```tsx
 * <MarkdownEditor
 *   initialContent="# Hello\n\nThis is **bold** text."
 *   onSave={handleSave}
 *   onCancel={handleCancel}
 * />
 * ```
 */
export function MarkdownEditor({
  initialContent = '',
  onSave,
  onCancel,
  showBackButton = false,
  placeholder = '开始编写你的长篇笔记...',
  disabled = false,
  loading = false,
  metadata,
}: MarkdownEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const editorRef = useState<MDXEditorMethods | null>(null)[0]
  const router = useRouter()

  // 更新 content 当 initialContent 变化时（外部数据加载）
  useEffect(() => {
    setContent(initialContent)
  }, [initialContent])

  // 检测内容变化
  const handleChange = useCallback((newContent: string) => {
    setContent(newContent)
    setHasChanges(newContent !== initialContent)
  }, [initialContent])

  // 处理保存
  const handleSave = async () => {
    if (!content.trim() || isSaving) return

    setIsSaving(true)
    try {
      const data: MarkdownEditorData = {
        content: content.trim(),
        ...metadata,
      }
      await onSave(data)
      setHasChanges(false)
    } finally {
      setIsSaving(false)
    }
  }

  // 处理取消
  const handleCancel = () => {
    if (hasChanges) {
      // 如果有未保存的更改，显示确认提示
      const confirmed = confirm('您有未保存的更改，确定要取消吗？')
      if (!confirmed) return
    }
    if (onCancel) {
      onCancel()
    } else {
      // 默认返回上一页
      router.back()
    }
  }

  // 处理返回
  const handleBack = () => {
    if (hasChanges) {
      const confirmed = confirm('您有未保存的更改，确定要离开吗？')
      if (!confirmed) return
    }
    router.back()
  }

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      // Escape 取消
      if (e.key === 'Escape') {
        handleCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [content, hasChanges, isSaving])

  const canSave = content.trim().length > 0 && hasChanges && !disabled && !isSaving && !loading

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 顶部工具栏 */}
      <Card className="border-b border-border rounded-none">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* 返回按钮 */}
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                disabled={isSaving || loading}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                返回
              </Button>
            )}

            {/* 标题/状态 */}
            <div className="flex flex-col">
              <h1 className="text-base font-semibold text-text-primary">
                长篇笔记编辑
              </h1>
              <span className="text-xs text-text-muted">
                {content.length} 字符
                {hasChanges && ' · 有未保存的更改'}
              </span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            {/* 取消按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving || loading}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              取消
            </Button>

            {/* 保存按钮 */}
            <Button
              onClick={handleSave}
              disabled={!canSave}
              size="sm"
              className="gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-0"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  保存
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* 编辑器区域 */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-5xl mx-auto p-6">
          <Card className="h-full border-border/50 shadow-lg overflow-hidden">
            <div className="h-full">
              <MDXEditor
                ref={editorRef}
                markdown={content}
                onChange={handleChange}
                placeholder={placeholder}
                disabled={disabled || loading}
                className="h-full prose prose-sm dark:prose-invert max-w-none"
                contentEditableClassName="min-h-[500px] p-4 focus:outline-none"
              />
            </div>
          </Card>
        </div>
      </div>

      {/* 底部提示 */}
      <div className="border-t border-border bg-background-secondary/50 px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-4">
            <span>Ctrl+S 保存</span>
            <span>Escape 取消</span>
          </div>
          <div>
            支持 Markdown 语法：标题、列表、代码块、链接等
          </div>
        </div>
      </div>
    </div>
  )
}
