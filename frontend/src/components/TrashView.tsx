'use client'

/**
 * 回收站组件
 *
 * 展示已删除的笔记，支持恢复和永久删除
 */
import { useState, useEffect } from 'react'
import { Trash2, RotateCcw, AlertCircle, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { notesApi } from '@/lib/api'
import { NoteBlock } from '@daily-note/shared'

interface TrashViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestore?: () => void // 恢复后的回调
}

/**
 * 格式化日期显示
 */
function formatDate(date: Date): string {
  const d = new Date(date)
  const now = new Date()
  const isThisYear = d.getFullYear() === now.getFullYear()

  if (isThisYear) {
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * 格式化日期时间显示
 */
function formatDateTime(date: Date): string {
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TrashView({ open, onOpenChange, onRestore }: TrashViewProps) {
  const [notes, setNotes] = useState<NoteBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 加载回收站笔记
   */
  const loadTrash = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await notesApi.getTrash()
      if (response.data) {
        setNotes(response.data)
      }
    } catch (err) {
      console.error('Failed to load trash:', err)
      setError('加载回收站失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 组件打开时加载数据
   */
  useEffect(() => {
    if (open) {
      loadTrash()
    }
  }, [open])

  /**
   * 恢复笔记
   */
  const handleRestore = async (id: string) => {
    if (!confirm('确定要恢复这条笔记吗？')) return

    try {
      await notesApi.restore(id)
      loadTrash()
      onRestore?.()
    } catch (err) {
      console.error('Failed to restore note:', err)
      alert('恢复失败')
    }
  }

  /**
   * 永久删除笔记
   */
  const handlePermanentDelete = async (id: string) => {
    if (!confirm('确定要永久删除这条笔记吗？此操作无法撤销！')) return

    try {
      await notesApi.permanentDelete(id)
      loadTrash()
    } catch (err) {
      console.error('Failed to permanently delete note:', err)
      alert('删除失败')
    }
  }

  /**
   * 渲染笔记项
   */
  const renderNoteItem = (note: NoteBlock) => (
    <div
      key={note.id}
      className="flex items-start gap-3 p-4 hover:bg-muted/50 rounded-lg transition-colors border border-border"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(note.date)}
          </span>
          {note.category && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded">
              {note.category}
            </span>
          )}
        </div>

        <p className="text-sm line-clamp-3 mb-2 whitespace-pre-wrap">
          {note.content}
        </p>

        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {note.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {note.deletedAt && (
          <p className="text-xs text-muted-foreground">
            删除于 {formatDateTime(note.deletedAt)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
          onClick={() => handleRestore(note.id)}
          title="恢复"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => handlePermanentDelete(note.id)}
          title="永久删除"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  /**
   * 渲染加载状态
   */
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
      <p className="text-sm text-muted-foreground">加载中...</p>
    </div>
  )

  /**
   * 渲染错误状态
   */
  const renderError = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <p className="text-sm text-destructive mb-4">{error}</p>
      <Button variant="outline" size="sm" onClick={loadTrash}>
        重试
      </Button>
    </div>
  )

  /**
   * 渲染空状态
   */
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <Trash2 className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-sm text-muted-foreground">回收站为空</p>
    </div>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>回收站</SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          <ScrollArea className="h-[calc(100vh-140px)]">
            {loading ? (
              renderLoading()
            ) : error ? (
              renderError()
            ) : notes.length === 0 ? (
              renderEmpty()
            ) : (
              <div className="space-y-2">
                {notes.map((note) => renderNoteItem(note))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
