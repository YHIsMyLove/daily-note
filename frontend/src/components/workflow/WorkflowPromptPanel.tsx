'use client'

/**
 * 工作流编辑器 - 提示词管理面板
 *
 * 提供完整的提示词管理功能：列表查看、新增、编辑、删除、恢复默认
 * 支持与工作流节点的提示词关联选择
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { promptsApi } from '@/lib/api'
import { PromptTemplate } from '@daily-note/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, RotateCcw, Trash2, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { PromptEditor } from '../prompts/PromptEditor'
import { Label } from '@/components/ui/label'

// 编辑状态：undefined=显示列表，null=新建模式，string=编辑模式（promptKey）
type EditingState = undefined | null | string

interface WorkflowPromptPanelProps {
  /** 当前选中的提示词 key（用于节点关联） */
  selectedPromptKey?: string | null
  /** 选中提示词回调（用于节点关联） */
  onSelectPrompt?: (promptKey: string | null) => void
  /** 面板是否可见 */
  isVisible?: boolean
  /** 切换面板可见性回调 */
  onToggleVisibility?: () => void
  /** 是否启用拖拽模式（用于 Pipeline 编辑器） */
  dragMode?: boolean
  /** 拖拽开始回调 */
  onDragStart?: (prompt: PromptTemplate, e: React.DragEvent) => void
}

export function WorkflowPromptPanel({
  selectedPromptKey,
  onSelectPrompt,
  isVisible = true,
  onToggleVisibility,
  dragMode = false,
  onDragStart,
}: WorkflowPromptPanelProps) {
  const [editingState, setEditingState] = useState<EditingState>(undefined)

  /**
   * 处理拖拽开始事件（用于 Pipeline 编辑器）
   */
  const handleDragStart = (prompt: PromptTemplate, e: React.DragEvent) => {
    if (!dragMode || !onDragStart) return

    // 设置拖拽数据
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'prompt',
      key: prompt.key,
      name: prompt.name,
      description: prompt.description,
    }))

    onDragStart(prompt, e)
  }

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
        alert('恢复失败，请稍后重试')
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
        alert('删除失败，请稍后重试')
      }
    }
  }

  const handleSuccess = async () => {
    setEditingState(undefined)
    await refetch()
  }

  // 获取提示词名称
  const getPromptName = (key: string) => {
    return prompts?.data?.find(p => p.key === key)?.name || key
  }

  // 编辑器模式
  if (editingState !== undefined) {
    return (
      <div className="w-80 border-r border-border/50 bg-card flex flex-col h-full">
        {/* 头部 */}
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">提示词管理</h2>
          </div>
          {onToggleVisibility && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleVisibility}
              className="h-7 w-7 p-0"
              title="收起面板"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 编辑器区域 */}
        <div className="flex-1 overflow-y-auto">
          <PromptEditor
            mode={editingState === null ? 'create' : 'edit'}
            promptKey={editingState || undefined}
            onSuccess={handleSuccess}
            onCancel={() => setEditingState(undefined)}
          />
        </div>
      </div>
    )
  }

  // 列表模式
  if (!isVisible) {
    // 折叠状态
    return (
      <button
        onClick={onToggleVisibility}
        className="absolute left-80 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10
                   w-6 h-12 flex items-center justify-center
                   bg-card border border-border/50 rounded-r-md
                   hover:bg-accent cursor-pointer"
        title="展开提示词面板"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    )
  }

  return (
    <div className="w-80 border-r border-border/50 bg-card flex flex-col h-full relative">
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">提示词管理</h2>
        </div>
        {onToggleVisibility && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleVisibility}
            className="h-7 w-7 p-0"
            title="收起面板"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 当前选中提示词显示（节点关联模式） */}
      {selectedPromptKey !== undefined && (
        <div className="px-3 py-2 border-b border-border/50 bg-muted/30">
          <Label className="text-xs text-muted-foreground">当前节点提示词</Label>
          {selectedPromptKey ? (
            <Badge variant="secondary" className="mt-1">
              {getPromptName(selectedPromptKey)}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground mt-1 block">使用默认提示词</span>
          )}
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* 创建按钮 */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setEditingState(null)}
        >
          <Plus className="h-4 w-4 mr-2" />
          创建新提示词
        </Button>

        {/* 提示词列表 */}
        <div className="space-y-2">
          {prompts?.data?.map((prompt) => (
            <Card
              key={prompt.key}
              draggable={dragMode}
              onDragStart={(e) => handleDragStart(prompt, e)}
              className={`p-3 cursor-pointer transition-colors hover:bg-accent/50 ${
                selectedPromptKey === prompt.key ? 'ring-2 ring-primary/50' : ''
              } ${dragMode ? 'cursor-move' : ''}`}
              onClick={() => onSelectPrompt?.(prompt.key)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm truncate">{prompt.name}</h4>
                    {prompt.isDefault && (
                      <span className="text-xs text-text-muted bg-background-secondary px-1.5 py-0.5 rounded flex-shrink-0">
                        默认
                      </span>
                    )}
                    {selectedPromptKey === prompt.key && (
                      <Badge variant="default" className="flex-shrink-0">已选</Badge>
                    )}
                  </div>
                  {prompt.description && (
                    <p className="text-xs text-text-muted mt-1 line-clamp-2">{prompt.description}</p>
                  )}
                  {dragMode && (
                    <p className="text-xs text-primary mt-1">🎯 拖拽到画布创建节点</p>
                  )}
                  <p className="text-xs text-text-muted mt-1">
                    最后更新: {new Date(prompt.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingState(prompt.key)
                    }}
                    title="编辑"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  {!prompt.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(prompt.key)
                      }}
                      title="删除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleReset(prompt.key)
                    }}
                    title="恢复默认"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* 使用说明 */}
        <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
          <p className="font-medium mb-1">提示:</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>点击提示词卡片可将其分配给当前节点</li>
            <li>默认提示词不可删除，可恢复</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
