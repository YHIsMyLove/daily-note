/**
 * 笔记列表组件
 */
'use client'

import { useState } from 'react'
import { NoteBlock } from '@daily-note/shared'
import { NoteCard } from './NoteCard'
import { ScrollArea } from './ui/scroll-area'
import { Loader2 } from 'lucide-react'

interface NoteListProps {
  notes: NoteBlock[]
  loading?: boolean
  onNoteClick?: (note: NoteBlock) => void
  onNoteAnalyze?: (noteId: string) => void
  onNoteDelete?: (note: NoteBlock) => void
  onUpdateSuccess?: () => void
  onTaskRefresh?: () => void
  onRelatedNotesClick?: (note: NoteBlock) => void
  emptyMessage?: string
}

export function NoteList({
  notes,
  loading = false,
  onNoteClick,
  onNoteAnalyze,
  onNoteDelete,
  onUpdateSuccess,
  onTaskRefresh,
  onRelatedNotesClick,
  emptyMessage = '暂无笔记',
}: NoteListProps) {
  // 编辑状态管理 - 同一时间只能编辑一个笔记
  const [editingNoteId, setEditingNoteId] = useState<string | undefined>()

  const handleEditStart = (noteId: string) => {
    setEditingNoteId(noteId)
  }

  const handleEditEnd = () => {
    setEditingNoteId(undefined)
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-text-muted">加载中...</span>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-6xl mb-4">📝</div>
        <p className="text-text-muted">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-4">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onClick={() => onNoteClick?.(note)}
            onAnalyze={onNoteAnalyze}
            onDelete={onNoteDelete}
            onUpdateSuccess={onUpdateSuccess}
            onTaskRefresh={onTaskRefresh}
            onRelatedNotesClick={onRelatedNotesClick}
            isEditing={editingNoteId === note.id}
            onEditStart={handleEditStart}
            onEditEnd={handleEditEnd}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
