'use client'

/**
 * 工作流节点编辑器组件
 *
 * 用于编辑工作流节点的属性
 */
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { promptsApi } from '@/lib/api'
import type { WorkflowStep, TaskTypeDefinition } from '@daily-note/shared'

interface WorkflowNodeEditorProps {
  step: WorkflowStep | null
  availableTaskTypes: TaskTypeDefinition[]
  isOpen: boolean
  onClose: () => void
  onSave: (step: WorkflowStep) => void
  allSteps: WorkflowStep[]
}

export function WorkflowNodeEditor({
  step,
  availableTaskTypes,
  isOpen,
  onClose,
  onSave,
  allSteps,
}: WorkflowNodeEditorProps) {
  const [formData, setFormData] = useState({
    label: '',
    taskType: '',
    enabled: true,
    priority: 5,
    position: 0,
    dependencies: [] as string[],
    promptKey: '',
  })

  // 加载可用提示词列表
  const { data: promptsData } = useQuery({
    queryKey: ['prompts'],
    queryFn: () => promptsApi.list(),
    enabled: isOpen, // 仅在对话框打开时加载
  })

  const availablePrompts = promptsData?.data || []

  // 初始化表单数据
  useEffect(() => {
    if (step) {
      setFormData({
        label: step.label,
        taskType: step.taskType,
        enabled: step.enabled,
        priority: step.priority,
        position: step.position,
        dependencies: step.dependencies || [],
        promptKey: step.config?.promptKey || '',
      })
    }
  }, [step])

  const handleSave = () => {
    if (!step) return

    const updatedStep: WorkflowStep = {
      ...step,
      label: formData.label,
      taskType: formData.taskType,
      enabled: formData.enabled,
      priority: formData.priority,
      position: formData.position,
      dependencies: formData.dependencies,
      config: {
        ...step.config,
        promptKey: formData.promptKey || undefined,
      },
      updatedAt: new Date(),
    }

    onSave(updatedStep)
  }

  const toggleDependency = (depId: string) => {
    setFormData((prev) => ({
      ...prev,
      dependencies: prev.dependencies.includes(depId)
        ? prev.dependencies.filter((d) => d !== depId)
        : [...prev.dependencies, depId],
    }))
  }

  const getTaskTypeInfo = (taskType: string) => {
    return availableTaskTypes.find((t) => t.type === taskType)
  }

  if (!step) return null

  const taskTypeInfo = getTaskTypeInfo(formData.taskType)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑节点</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 显示名称 */}
          <div className="space-y-2">
            <Label htmlFor="label">显示名称</Label>
            <Input
              id="label"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="例如：笔记分类"
            />
          </div>

          {/* 任务类型 */}
          <div className="space-y-2">
            <Label htmlFor="taskType">任务类型</Label>
            <select
              id="taskType"
              value={formData.taskType}
              onChange={(e) => setFormData({ ...formData, taskType: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              {availableTaskTypes.map((type) => (
                <option key={type.type} value={type.type}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
            {taskTypeInfo && (
              <p className="text-xs text-muted-foreground">{taskTypeInfo.description}</p>
            )}
          </div>

          {/* 启用状态 */}
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">启用此节点</Label>
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </div>

          {/* 优先级 */}
          <div className="space-y-2">
            <Label htmlFor="priority">优先级 ({formData.priority})</Label>
            <input
              id="priority"
              type="range"
              min="0"
              max="10"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>低</span>
              <span>高</span>
            </div>
          </div>

          {/* 执行位置 */}
          <div className="space-y-2">
            <Label htmlFor="position">执行顺序</Label>
            <Input
              id="position"
              type="number"
              min="0"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">
              数值越小越先执行（仅作参考，实际执行依赖优先级和依赖关系）
            </p>
          </div>

          {/* 依赖节点 */}
          <div className="space-y-2">
            <Label>依赖节点（在此节点之前执行）</Label>
            <div className="flex flex-wrap gap-2">
              {allSteps
                .filter((s) => s.id !== step.id)
                .map((s) => (
                  <Badge
                    key={s.id}
                    variant={formData.dependencies.includes(s.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleDependency(s.id)}
                  >
                    {s.label}
                  </Badge>
                ))}
              {allSteps.filter((s) => s.id !== step.id).length === 0 && (
                <p className="text-xs text-muted-foreground">暂无其他节点</p>
              )}
            </div>
          </div>

          {/* 提示词模板选择 */}
          <div className="space-y-2">
            <Label htmlFor="promptKey">提示词模板（可选）</Label>
            <select
              id="promptKey"
              value={formData.promptKey || ''}
              onChange={(e) => setFormData({ ...formData, promptKey: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="">使用默认提示词</option>
              {availablePrompts.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} {p.isDefault ? '(默认)' : ''}
                </option>
              ))}
            </select>
            {formData.promptKey && (
              <p className="text-xs text-muted-foreground">
                已选择: {availablePrompts.find(p => p.key === formData.promptKey)?.name || formData.promptKey}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
