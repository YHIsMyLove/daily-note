/**
 * 关联笔记面板组件
 * 显示与当前笔记关联的其他笔记
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Link2 } from 'lucide-react'
import { notesApi } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'
import { NoteBlock } from '@daily-note/shared'

interface RelatedNotesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  noteId: string
}

export function RelatedNotesSheet({ open, onOpenChange, noteId }: RelatedNotesSheetProps) {
  const { data: relatedNotesResponse, isLoading } = useQuery({
    queryKey: ['related-notes', noteId],
    queryFn: () => notesApi.getRelated(noteId),
    enabled: open && !!noteId,
  })

  const relatedNotes = (relatedNotesResponse?.data as NoteBlock[]) || []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[450px] flex flex-col">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            关联笔记
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
            </div>
          ) : relatedNotes.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              暂无关联笔记
            </div>
          ) : (
            <div className="space-y-3">
              {relatedNotes.map((note) => (
                <RelatedNoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function RelatedNoteCard({ note }: { note: NoteBlock }) {
  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
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
