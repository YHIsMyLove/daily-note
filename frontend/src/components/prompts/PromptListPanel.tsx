'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { promptsApi } from '@/lib/api'
import { PromptTemplate } from '@daily-note/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Edit, RotateCcw, Trash2 } from 'lucide-react'
import { PromptEditorSheet } from './PromptEditorSheet'
import { toast } from 'sonner'

interface PromptListPanelProps {
  onClose: () => void
}

export function PromptListPanel({ onClose }: PromptListPanelProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const { data: prompts, refetch } = useQuery({
    queryKey: ['prompts'],
    queryFn: () => promptsApi.list(),
  })

  const handleReset = async (key: string) => {
    if (confirm('确认恢复为默认提示词？')) {
      try {
        await promptsApi.reset(key)
        refetch()
      } catch (error) {
        console.error('Failed to reset prompt:', error)
        toast.error('恢复失败，请稍后重试')
      }
    }
  }

  const handleDelete = async (key: string) => {
    if (confirm('确认删除此提示词？')) {
      try {
        await promptsApi.delete(key)
        refetch()
      } catch (error) {
        console.error('Failed to delete prompt:', error)
        toast.error('删除失败，请稍后重试')
      }
    }
  }

  const handleSuccess = () => {
    setEditingKey(null)
    setIsCreating(false)
    refetch()
  }

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setIsCreating(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        创建新提示词
      </Button>

      <div className="space-y-2">
        {prompts?.data?.map((prompt) => (
          <Card key={prompt.key} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm truncate">{prompt.name}</h4>
                  {prompt.isDefault && (
                    <span className="text-xs text-text-muted bg-background-secondary px-1.5 py-0.5 rounded">
                      默认
                    </span>
                  )}
                </div>
                {prompt.description && (
                  <p className="text-xs text-text-muted mt-1 line-clamp-2">{prompt.description}</p>
                )}
                <p className="text-xs text-text-muted mt-1">
                  最后更新: {new Date(prompt.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingKey(prompt.key)}
                  title="编辑"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                {!prompt.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(prompt.key)}
                    title="删除"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReset(prompt.key)}
                  title="恢复默认"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 编辑器 */}
      {(editingKey || isCreating) && (
        <PromptEditorSheet
          key={editingKey || 'create'}
          promptKey={editingKey}
          open={!!editingKey || isCreating}
          onOpenChange={(open) => {
            if (!open) {
              setEditingKey(null)
              setIsCreating(false)
            }
          }}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
