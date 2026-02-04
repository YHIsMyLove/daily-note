'use client'

/**
 * Pipeline 编辑器主页面
 *
 * 整合提示词面板和流程图，支持拖拽创建提示词管道
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pipelineApi } from '@/lib/pipeline-api'
import { promptsApi } from '@/lib/api'
import { WorkflowPromptPanel } from './WorkflowPromptPanel'
import { PipelineFlowChart } from './PipelineFlowChart'
import type { PipelineDetail, PromptTemplate } from '@daily-note/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Settings, Play, Save } from 'lucide-react'
import { toast } from 'sonner'

interface PipelineEditorProps {
  pipelineId?: string
  onClose?: () => void
}

export function PipelineEditor({ pipelineId, onClose }: PipelineEditorProps) {
  const queryClient = useQueryClient()
  const [isPromptPanelVisible, setIsPromptPanelVisible] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 获取 Pipeline 详情
  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['pipeline', pipelineId],
    queryFn: () => pipelineId ? pipelineApi.getById(pipelineId) : null,
    enabled: !!pipelineId,
  })

  // 获取提示词列表
  const { data: promptsResponse } = useQuery({
    queryKey: ['prompts'],
    queryFn: () => promptsApi.list(),
  })

  const prompts = promptsResponse?.data || []

  // 保存 Pipeline（更新节点位置等）
  const saveMutation = useMutation({
    mutationFn: async (updatedPipeline: PipelineDetail) => {
      setIsSaving(true)
      // 逐个更新节点位置
      for (const node of updatedPipeline.nodes) {
        await pipelineApi.updateNode(updatedPipeline.id, node.id, {
          nodeX: node.nodeX,
          nodeY: node.nodeY,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
      toast.success('保存成功')
      setIsSaving(false)
    },
    onError: (error) => {
      toast.error('保存失败: ' + (error as Error).message)
      setIsSaving(false)
    },
  })

  // 执行 Pipeline
  const executeMutation = useMutation({
    mutationFn: () => pipelineApi.execute(pipelineId!, {}),
    onSuccess: (data) => {
      if (data.success && data.data) {
        toast.success('Pipeline 已开始执行', {
          description: `执行 ID: ${data.data.executionId}`,
        })
      }
    },
    onError: (error) => {
      toast.error('执行失败: ' + (error as Error).message)
    },
  })

  // 处理 Pipeline 变更
  const handleChange = (updatedPipeline: PipelineDetail) => {
    // 更新本地状态
    queryClient.setQueryData(['pipeline', pipelineId], { success: true, data: updatedPipeline })
  }

  // 保存
  const handleSave = () => {
    if (pipeline?.data) {
      saveMutation.mutate(pipeline.data)
    }
  }

  // 执行
  const handleExecute = () => {
    if (!pipelineId) return
    executeMutation.mutate()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!pipeline?.data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Pipeline 不存在</div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* 提示词面板 */}
      <WorkflowPromptPanel
        isVisible={isPromptPanelVisible}
        onToggleVisibility={() => setIsPromptPanelVisible(!isPromptPanelVisible)}
        dragMode={true}
      />

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部工具栏 */}
        <div className="h-14 border-b border-border/50 flex items-center justify-between px-4 bg-card">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">{pipeline.data.name}</h1>
            <span className={`text-xs px-2 py-1 rounded ${
              pipeline.data.enabled
                ? 'bg-green-500/20 text-green-500'
                : 'bg-gray-500/20 text-gray-500'
            }`}>
              {pipeline.data.enabled ? '已启用' : '已禁用'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? '保存中...' : '保存'}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleExecute}
              disabled={!pipeline.data.enabled || executeMutation.isPending}
            >
              <Play className="h-4 w-4 mr-1" />
              {executeMutation.isPending ? '执行中...' : '执行'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 流程图画布 */}
        <div className="flex-1">
          <PipelineFlowChart
            pipeline={pipeline.data}
            onChange={handleChange}
            availablePrompts={prompts}
          />
        </div>
      </div>

      {/* 设置对话框 */}
      <PipelineSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        pipeline={pipeline.data}
        onSave={(updated) => {
          handleChange(updated)
          setIsSettingsOpen(false)
        }}
      />
    </div>
  )
}

/**
 * Pipeline 设置对话框
 */
interface PipelineSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipeline: PipelineDetail
  onSave: (pipeline: PipelineDetail) => void
}

function PipelineSettingsDialog({
  open,
  onOpenChange,
  pipeline,
  onSave,
}: PipelineSettingsDialogProps) {
  const [name, setName] = useState(pipeline.name)
  const [description, setDescription] = useState(pipeline.description || '')
  const [trigger, setTrigger] = useState(pipeline.trigger)
  const [enabled, setEnabled] = useState(pipeline.enabled)

  const handleSave = () => {
    onSave({
      ...pipeline,
      name,
      description,
      trigger,
      enabled,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pipeline 设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入 Pipeline 名称"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入 Pipeline 描述"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trigger">触发方式</Label>
            <select
              id="trigger"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as any)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background"
            >
              <option value="manual">手动触发</option>
              <option value="note_created">笔记创建时</option>
              <option value="note_updated">笔记更新时</option>
              <option value="scheduled">定时任务</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="enabled">启用此 Pipeline</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
