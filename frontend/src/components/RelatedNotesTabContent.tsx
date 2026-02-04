'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Link2, RefreshCw } from 'lucide-react'
import { notesApi } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'
import { NoteBlock } from '@daily-note/shared'
import { toast } from 'sonner'

interface RelatedNotesTabContentProps {
  selectedNoteId?: string
  onOpenRelatedNotes: (noteId: string) => void
}

// 扩展 NoteBlock 类型以包含关联信息
type RelatedNoteBlock = NoteBlock & {
  similarity?: number
  reason?: string
}

/**
 * 关联笔记标签页内容
 * 显示关联笔记、相似度、关联原因，支持手动刷新
 */
export function RelatedNotesTabContent({
  selectedNoteId,
  onOpenRelatedNotes,
}: RelatedNotesTabContentProps) {
  const queryClient = useQueryClient()

  const { data: relatedNotesResponse, isLoading, refetch } = useQuery({
    queryKey: ['related-notes', selectedNoteId],
    queryFn: () => (selectedNoteId ? notesApi.getRelated(selectedNoteId) : null),
    enabled: !!selectedNoteId,
  })

  const relatedNotes = (relatedNotesResponse?.data as RelatedNoteBlock[]) || []

  // 手动触发关联分析
  const analyzeMutation = useMutation({
    mutationFn: () => {
      if (!selectedNoteId) throw new Error('No note selected')
      return notesApi.analyzeRelations(selectedNoteId)
    },
    onSuccess: (data) => {
      toast.success('关联分析已启动', {
        description: '任务 ID: ' + data.data.taskId,
      })
      // 3秒后刷新关联笔记列表
      setTimeout(() => {
        refetch()
      }, 3000)
    },
    onError: (error: any) => {
      toast.error('关联分析启动失败', {
        description: error.userMessage || error.message || '未知错误',
      })
    },
  })

  const handleRefresh = () => {
    refetch()
  }

  const handleAnalyze = () => {
    analyzeMutation.mutate()
  }

  const getSimilarityColor = (similarity?: number) => {
    if (!similarity) return 'bg-muted'
    if (similarity >= 0.8) return 'bg-green-500'
    if (similarity >= 0.5) return 'bg-blue-500'
    if (similarity >= 0.2) return 'bg-yellow-500'
    return 'bg-gray-400'
  }

  const getSimilarityLabel = (similarity?: number) => {
    if (!similarity) return null
    if (similarity >= 0.8) return '强关联'
    if (similarity >= 0.5) return '中等关联'
    if (similarity >= 0.2) return '弱关联'
    return null
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">关联笔记</h2>
          {relatedNotes.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {relatedNotes.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={isLoading}
            title="刷新"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleAnalyze}
            disabled={analyzeMutation.isPending || !selectedNoteId}
            title="重新分析关联"
          >
            <Loader2 className={`h-3.5 w-3.5 ${analyzeMutation.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
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
          <div className="flex flex-col items-center justify-center h-full py-12 text-center text-text-muted">
            <Link2 className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm mb-4">暂无关联笔记</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzeMutation.isPending}
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  分析关联
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {relatedNotes.map((note) => (
              <RelatedNoteCard
                key={note.id}
                note={note}
                getSimilarityColor={getSimilarityColor}
                getSimilarityLabel={getSimilarityLabel}
                onClick={() => onOpenRelatedNotes(note.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RelatedNoteCard({
  note,
  getSimilarityColor,
  getSimilarityLabel,
  onClick,
}: {
  note: RelatedNoteBlock
  getSimilarityColor: (similarity?: number) => string
  getSimilarityLabel: (similarity?: number) => string | null
  onClick: () => void
}) {
  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-3">
        {/* 头部：分类、日期、相似度 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {note.category && (
              <Badge variant="outline" className="text-xs">
                {note.category}
              </Badge>
            )}
            <span className="text-xs text-text-muted">
              {formatRelativeTime(note.createdAt)}
            </span>
          </div>

          {/* 相似度显示 */}
          {note.similarity !== undefined && (
            <div className="flex items-center gap-1.5">
              {getSimilarityLabel(note.similarity) && (
                <Badge
                  variant="outline"
                  className={`text-xs ${getSimilarityColor(note.similarity)} text-white border-0`}
                >
                  {getSimilarityLabel(note.similarity)}
                </Badge>
              )}
              <span className="text-xs font-medium text-text-muted">
                {Math.round(note.similarity * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* 笔记内容 */}
        <p className="text-sm line-clamp-2 mb-2">{note.content}</p>

        {/* 关联原因 */}
        {note.reason && (
          <div className="flex items-start gap-1.5 text-xs text-text-muted bg-muted/50 rounded px-2 py-1.5">
            <Link2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{note.reason}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
