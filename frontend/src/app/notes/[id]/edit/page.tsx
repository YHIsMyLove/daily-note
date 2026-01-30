/**
 * 长篇笔记编辑页面
 * 用于编辑超过 200 字符的长篇笔记，提供完整的 Markdown 编辑功能
 */
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MarkdownEditor, MarkdownEditorData } from '@/components/MarkdownEditor'
import { NoteBlock } from '@daily-note/shared'
import { notesApi } from '@/lib/api'
import { Loader2, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function EditNotePage() {
  const params = useParams()
  const router = useRouter()
  const noteId = params.id as string

  const [note, setNote] = useState<NoteBlock | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // 加载笔记数据
  useEffect(() => {
    const loadNote = async () => {
      if (!noteId) {
        setError('笔记 ID 无效')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await notesApi.get(noteId)

        if (response.data) {
          console.log('[EditPage] 笔记加载成功:', {
            id: response.data.id,
            contentLength: response.data.content?.length || 0,
            contentPreview: response.data.content?.substring(0, 50) || '(empty)',
          })
          setNote(response.data)
        } else {
          setError('笔记不存在')
        }
      } catch (err) {
        console.error('Failed to load note:', err)
        setError('加载笔记失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    }

    loadNote()
  }, [noteId])

  // 处理保存
  const handleSave = async (data: MarkdownEditorData) => {
    if (!note) return

    try {
      setSaving(true)

      await notesApi.update(noteId, {
        content: data.content,
        category: data.category,
        tags: data.tags,
        importance: data.importance,
      })

      // 保存成功后返回首页
      router.push('/')
    } catch (err) {
      console.error('Failed to save note:', err)
      alert('保存失败，请稍后重试')
      throw err // 重新抛出错误，让编辑器组件知道保存失败
    } finally {
      setSaving(false)
    }
  }

  // 处理取消
  const handleCancel = () => {
    router.push('/')
  }

  // 加载状态
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-text-muted">加载笔记中...</p>
        </div>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md p-6">
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-text-primary">加载失败</h2>
              <p className="text-sm text-text-muted mt-1">{error}</p>
            </div>
            <Button onClick={() => router.push('/')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // 笔记不存在
  if (!note) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md p-6">
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-text-primary">笔记不存在</h2>
              <p className="text-sm text-text-muted mt-1">该笔记可能已被删除</p>
            </div>
            <Button onClick={() => router.push('/')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // 渲染编辑器
  return (
    <MarkdownEditor
      initialContent={note.content}
      onSave={handleSave}
      onCancel={handleCancel}
      showBackButton={true}
      placeholder="开始编写你的长篇笔记..."
      disabled={saving}
      loading={saving}
      metadata={{
        category: note.category,
        tags: note.tags,
        importance: note.importance,
      }}
    />
  )
}
