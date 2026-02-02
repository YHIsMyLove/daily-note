'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Link2 } from 'lucide-react'
import { notesApi } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'
import { NoteBlock } from '@daily-note/shared'

interface RelatedNotesTabContentProps {
  selectedNoteId?: string
  onOpenRelatedNotes: (noteId: string) => void
}

/**
 * 关联笔记标签页内容
 * 复用 RelatedNotesSheet 的逻辑，移除 Sheet 包装
 */
export function RelatedNotesTabContent({
  selectedNoteId,
  onOpenRelatedNotes,
}: RelatedNotesTabContentProps) {
  const { data: relatedNotesResponse, isLoading } = useQuery({
    queryKey: ['related-notes', selectedNoteId],
    queryFn: () => (selectedNoteId ? notesApi.getRelated(selectedNoteId) : null),
    enabled: !!selectedNoteId,
  })

  const relatedNotes = (relatedNotesResponse?.data as NoteBlock[]) || []

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">关联笔记</h2>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {!selectedNoteId ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-sm font-semibold mb-2">未选择笔记</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              请在笔记列表中点击笔记卡片上的关联图标查看关联笔记
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : relatedNotes.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            暂无关联笔记
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {relatedNotes.map((note) => (
              <RelatedNoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RelatedNoteCard({ note }: { note: NoteBlock }) {
  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          {note.category && (
            <Badge variant="outline" className="text-xs">
              {note.category}
            </Badge>
          )}
          <span className="text-xs text-text-muted">
            {formatRelativeTime(note.createdAt)}
          </span>
        </div>
        <p className="text-sm line-clamp-3">{note.content}</p>
      </CardContent>
    </Card>
  )
}
