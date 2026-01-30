/**
 * 笔记卡片组件
 * 支持行内编辑功能
 */
'use client'

import { useState } from 'react'
import { NoteBlock, UpdateNoteRequest } from '@daily-note/shared'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { formatDateTime, formatRelativeTime } from '@/lib/utils'
import { Link2, Star, MoreVertical, Edit2, Sparkles, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Button } from './ui/button'
import { NoteEditor, NoteEditorData } from './NoteEditor'
import { notesApi } from '@/lib/api'
import { getCategoryColorClass, getTextColorClass } from '@/lib/colors'

interface NoteCardProps {
  note: NoteBlock
  onClick?: () => void
  onAnalyze?: (noteId: string) => void
  onDelete?: (note: NoteBlock) => void
  onUpdateSuccess?: () => void
  onTaskRefresh?: () => void
  onRelatedNotesClick?: (note: NoteBlock) => void
  isEditing?: boolean
  onEditStart?: (noteId: string) => void
  onEditEnd?: () => void
}

// 情感图标映射
const sentimentIcons: Record<string, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😟',
}

export function NoteCard({ note, onClick, onAnalyze, onDelete, onUpdateSuccess, onTaskRefresh, onRelatedNotesClick, isEditing, onEditStart, onEditEnd }: NoteCardProps) {
  const [loading, setLoading] = useState(false)
  const categoryColor = getCategoryColorClass(note.category || '其他')

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEditStart?.(note.id)
  }

  const handleAnalyze = (e: React.MouseEvent) => {
    e.stopPropagation()
    onTaskRefresh?.()
    onAnalyze?.(note.id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete?.(note)
  }

  // 保存编辑
  const handleSave = async (data: NoteEditorData) => {
    try {
      setLoading(true)
      const updates: UpdateNoteRequest = {
        content: data.content,
        category: data.category,
        tags: data.tags,
        importance: data.importance,
      }
      await notesApi.update(note.id, updates)
      onEditEnd?.()

      // 刷新笔记和任务统计
      onUpdateSuccess?.()
      onTaskRefresh?.()
    } catch (error) {
      console.error('Failed to update note:', error)
      toast.error('保存失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 取消编辑
  const handleCancel = () => {
    onEditEnd?.()
  }

  // 编辑模式：渲染 NoteEditor
  if (isEditing) {
    return (
      <Card className="shadow-card-xl bg-background-card ring-1 ring-primary/30">
        <NoteEditor
          mode="edit"
          initialData={{
            content: note.content,
            category: note.category,
            tags: note.tags,
            importance: note.importance,
          }}
          onSubmit={handleSave}
          onCancel={handleCancel}
          loading={loading}
          disabled={loading}
          autoFocus={true}
        />
      </Card>
    )
  }

  // 浏览模式：渲染卡片内容
  return (
    <Card
      className="hover:shadow-card-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group bg-background-card/80 backdrop-blur-sm shadow-card p-4 relative"
      onClick={onClick}
    >
      {/* 操作按钮 - 仅在 hover 时显示 */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={handleEdit}>
              <Edit2 className="h-4 w-4 mr-2" />
              编辑
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAnalyze}>
              <Sparkles className="h-4 w-4 mr-2" />
              重新分析
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-red-500">
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 头部：分类 + 情感 + 匹配来源标记 + 时间 */}
      <div className="flex items-center justify-between mb-2 pr-8">
        <div className="flex items-center gap-1.5">
          {note.category && (
            <span className={`text-xs font-bold ${getTextColorClass(note.category)}`}>
              {note.category}
            </span>
          )}
          {note.sentiment && (
            <span className="text-xs" title={`情感: ${note.sentiment}`}>
              {sentimentIcons[note.sentiment]}
            </span>
          )}
          {/* 匹配来源标记 */}
          {note.matchSource && (
            <Badge
              variant="outline"
              className={`text-xs px-1.5 py-0.5 ${
                note.matchSource === 'createdAt'
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-green-500/20 text-green-400 border-green-500/30'
              }`}
              title={note.matchSource === 'createdAt' ? '通过创建时间匹配' : '通过更新时间匹配'}
            >
              {note.matchSource === 'createdAt' ? '创建' : '更新'}
            </Badge>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {/* 主时间：更新时间 */}
          <span className="text-xs text-text-muted" title={formatDateTime(note.updatedAt)}>
            {formatRelativeTime(note.updatedAt)}
          </span>
          {/* 副时间：创建时间（如果与更新时间不同） */}
          {new Date(note.createdAt).getTime() !== new Date(note.updatedAt).getTime() && (
            <span className="text-[10px] text-text-muted/70" title={`创建于 ${formatDateTime(note.createdAt)}`}>
              创建: {formatRelativeTime(note.createdAt)}
            </span>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="space-y-2">
        {/* 摘要 */}
        {note.summary && (
          <p className="text-sm text-text-secondary line-clamp-2">
            {note.summary}
          </p>
        )}

        {/* 内容主体 */}
        <p className="text-sm text-text-primary whitespace-pre-wrap break-words leading-relaxed line-clamp-3">
          {note.content}
        </p>

        {/* 底部元信息：标签 + 重要性 + 关联 + 字数 */}
        <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap pt-1">
          {/* 标签 */}
          {note.tags && note.tags.length > 0 && (
            <div className="flex items-center gap-1">
              {note.tags.map((tag) => (
                <Badge key={tag} variant="default" className="text-[10px] px-1.5 py-0 bg-slate-500/15 text-slate-300 border border-slate-500/25 hover:bg-slate-500/20 transition-colors cursor-pointer">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          {/* 重要性 */}
          {note.importance && note.importance > 5 && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              {note.importance}
            </span>
          )}

          {/* 关联笔记 */}
          {note.relatedNotes && note.relatedNotes.length > 0 && (
            <span
              className="flex items-center gap-0.5 cursor-pointer hover:text-primary transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onRelatedNotesClick?.(note)
              }}
              title="查看关联笔记"
            >
              <Link2 className="h-3 w-3" />
              {note.relatedNotes.length}
            </span>
          )}

          {/* 字数 */}
          {note.metadata?.wordCount && (
            <span>{note.metadata.wordCount}字</span>
          )}
        </div>
      </div>
    </Card>
  )
}
