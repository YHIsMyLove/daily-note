'use client'

/**
 * Pipeline 编辑覆盖层组件
 *
 * 提供全屏覆盖层来编辑提示词管道配置
 */
import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PipelineFlowChart } from './PipelineFlowChart'
import { WorkflowPromptPanel } from './WorkflowPromptPanel'
import { pipelineApi } from '@/lib/pipeline-api'
import { promptsApi } from '@/lib/api'
import type { PipelineDetail, PromptTemplate } from '@daily-note/shared'
import { toast } from 'sonner'

interface WorkflowOverlayProps {
  onClose: () => void
}

export function WorkflowOverlay({ onClose }: WorkflowOverlayProps) {
  const queryClient = useQueryClient()
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [isPromptPanelVisible, setIsPromptPanelVisible] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newPipelineName, setNewPipelineName] = useState('')
  const [newPipelineDesc, setNewPipelineDesc] = useState('')

  // 获取所有 Pipeline
  const { data: pipelinesResponse, refetch: refetchPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => pipelineApi.list(),
  })

  const pipelines = pipelinesResponse?.data || []

  // 获取选中的 Pipeline 详情
  const { data: pipelineDetailResponse, isLoading } = useQuery({
    queryKey: ['pipeline', selectedPipelineId],
    queryFn: () => selectedPipelineId ? pipelineApi.getById(selectedPipelineId) : null,
    enabled: !!selectedPipelineId,
  })

  const currentPipeline = pipelineDetailResponse?.data || null

  // 获取提示词列表
  const { data: promptsResponse } = useQuery({
    queryKey: ['prompts'],
    queryFn: () => promptsApi.list(),
  })

  const prompts = promptsResponse?.data || []

  // 创建 Pipeline
  const createMutation = useMutation({
    mutationFn: () => pipelineApi.create({
      name: newPipelineName,
      description: newPipelineDesc || undefined,
      trigger: 'manual',
    }),
    onSuccess: (data) => {
      if (data.success && data.data) {
        toast.success('Pipeline 创建成功')
        setSelectedPipelineId(data.data.id)
        refetchPipelines()
        setIsCreateDialogOpen(false)
        setNewPipelineName('')
        setNewPipelineDesc('')
      }
    },
    onError: (error) => {
      toast.error('创建失败: ' + (error as Error).message)
    },
  })

  // 删除 Pipeline
  const deleteMutation = useMutation({
    mutationFn: (id: string) => pipelineApi.delete(id),
    onSuccess: () => {
      toast.success('Pipeline 已删除')
      refetchPipelines()
      if (selectedPipelineId === currentPipeline?.id) {
        setSelectedPipelineId(pipelines.length > 1 ? pipelines[0].id : null)
      }
    },
    onError: (error) => {
      toast.error('删除失败: ' + (error as Error).message)
    },
  })

  // 更新 Pipeline
  const updateMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      pipelineApi.update(id, { enabled }),
    onSuccess: () => {
      refetchPipelines()
      if (selectedPipelineId) {
        queryClient.invalidateQueries({ queryKey: ['pipeline', selectedPipelineId] })
      }
    },
  })

  // 处理 Pipeline 变更
  const handleChange = useCallback((updatedPipeline: PipelineDetail) => {
    queryClient.setQueryData(['pipeline', selectedPipelineId], {
      success: true,
      data: updatedPipeline,
    })
  }, [queryClient, selectedPipelineId])

  // 初始化时选择第一个 Pipeline
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(pipelines[0].id)
    }
  }, [pipelines, selectedPipelineId])

  // 创建新 Pipeline
  const handleCreate = () => {
    if (!newPipelineName.trim()) {
      toast.error('请输入 Pipeline 名称')
      return
    }
    createMutation.mutate()
  }

  // 删除 Pipeline
  const handleDelete = (id: string, name: string) => {
    if (!confirm(`确定要删除 "${name}" 吗？`)) {
      return
    }
    deleteMutation.mutate(id)
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between border-b px-6 py-3 bg-background">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <span className="text-lg">🔧</span>
          </div>
          <h1 className="text-xl font-semibold">提示词管道</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            新建 Pipeline
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex h-[calc(100vh-57px)] relative">
        {/* 左侧 Pipeline 列表 */}
        <div className="w-64 border-r bg-card flex flex-col">
          <div className="px-4 py-3 border-b border-border/50">
            <h2 className="text-sm font-semibold text-muted-foreground">Pipelines</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {pipelines.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                暂无 Pipeline<br />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  创建第一个
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {pipelines.map((pipeline) => (
                  <div
                    key={pipeline.id}
                    className={`group p-3 rounded-lg border transition-all cursor-pointer ${
                      selectedPipelineId === pipeline.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card hover:bg-accent border-border'
                    }`}
                    onClick={() => setSelectedPipelineId(pipeline.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{pipeline.name}</div>
                        {pipeline.description && (
                          <div className={`text-xs mt-1 truncate ${
                            selectedPipelineId === pipeline.id
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground'
                          }`}>
                            {pipeline.description}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(pipeline.id, pipeline.name)
                        }}
                        className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 ${
                          selectedPipelineId === pipeline.id
                            ? 'hover:bg-primary-foreground/20 text-primary-foreground'
                            : 'text-destructive'
                        }`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 提示词管理面板 */}
        <WorkflowPromptPanel
          isVisible={isPromptPanelVisible}
          onToggleVisibility={() => setIsPromptPanelVisible(!isPromptPanelVisible)}
          dragMode={true}
        />

        {/* 右侧流程图 */}
        <div className="flex-1 flex flex-col">
          {/* Pipeline 状态栏 */}
          {currentPipeline && (
            <div className="h-12 border-b border-border/50 flex items-center justify-between px-4 bg-card">
              <div className="flex items-center gap-4">
                <span className="font-medium">{currentPipeline.name}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  currentPipeline.enabled
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-gray-500/20 text-gray-500'
                }`}>
                  {currentPipeline.enabled ? '已启用' : '已禁用'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Label htmlFor="pipeline-enabled" className="text-sm cursor-pointer">
                  启用
                </Label>
                <Switch
                  id="pipeline-enabled"
                  checked={currentPipeline.enabled}
                  onCheckedChange={(enabled) =>
                    updateMutation.mutate({ id: currentPipeline.id, enabled })
                  }
                />
              </div>
            </div>
          )}

          {/* 流程图编辑区 */}
          <div className="flex-1 overflow-hidden bg-muted/20">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">加载中...</div>
              </div>
            ) : currentPipeline ? (
              <PipelineFlowChart
                pipeline={currentPipeline}
                onChange={handleChange}
                availablePrompts={prompts}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-muted-foreground mb-4">
                    {pipelines.length === 0
                      ? '请先创建一个 Pipeline'
                      : '请选择一个 Pipeline 进行编辑'}
                  </div>
                  {pipelines.length === 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      创建 Pipeline
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 创建 Pipeline 对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建新 Pipeline</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pipeline-name">名称 *</Label>
              <Input
                id="pipeline-name"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder="例如：笔记分析流程"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pipeline-desc">描述</Label>
              <Textarea
                id="pipeline-desc"
                value={newPipelineDesc}
                onChange={(e) => setNewPipelineDesc(e.target.value)}
                placeholder="描述这个 Pipeline 的用途"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
