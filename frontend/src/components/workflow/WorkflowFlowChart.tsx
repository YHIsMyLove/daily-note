'use client'

/**
 * 工作流流程图组件
 *
 * 使用 vis-network 渲染可编辑的工作流流程图
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { Network, DataSet } from 'vis-network/standalone'
import type { WorkflowConfigDetail, WorkflowStep, WorkflowConnection, TaskTypeDefinition } from '@daily-note/shared'
import { workflowApi } from '@/lib/workflow-api'
import { WorkflowNodeEditor } from './WorkflowNodeEditor'
import { Plus, Trash2, Edit, Link2, Power, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getNodeStyle,
  getNodeLabel,
  getNodeTitle,
  NETWORK_OPTIONS,
} from './workflow-chart-styles'

/**
 * 右键菜单位置
 */
interface ContextMenuPosition {
  x: number
  y: number
}

interface WorkflowFlowChartProps {
  workflow: WorkflowConfigDetail
  onChange: (workflow: WorkflowConfigDetail) => void
}

export function WorkflowFlowChart({ workflow, onChange }: WorkflowFlowChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const nodesRef = useRef<DataSet<any> | null>(null)
  const edgesRef = useRef<DataSet<any> | null>(null)

  const [selectedNode, setSelectedNode] = useState<WorkflowStep | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [availableTaskTypes, setAvailableTaskTypes] = useState<TaskTypeDefinition[]>([])
  const [isLinkMode, setIsLinkMode] = useState(false)
  const [linkSourceNode, setLinkSourceNode] = useState<WorkflowStep | null>(null)

  // 右键菜单状态
  const [contextMenuNode, setContextMenuNode] = useState<WorkflowStep | null>(null)
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null)

  // 加载可用任务类型
  useEffect(() => {
    workflowApi.getTaskTypes().then(response => {
      if (response.success && response.data) {
        setAvailableTaskTypes(response.data)
      }
    })
  }, [])

  // 初始化网络图
  useEffect(() => {
    if (!containerRef.current) return

    // 创建节点数据集 - 使用新的样式配置
    const nodesData = workflow.steps.map((step) => {
      const nodeStyle = getNodeStyle(step)
      const taskColor = nodeStyle.border // 节点边框色（任务类型颜色）
      return {
        id: step.id,
        label: getNodeLabel(step),
        title: getNodeTitle(step),
        x: step.nodeX,
        y: step.nodeY,
        enabled: step.enabled,
        // 悬停时只改变边框颜色，背景不变
        color: {
          background: nodeStyle.background,
          border: nodeStyle.border,
          hover: {
            background: nodeStyle.background,
            border: 'hsl(142 76% 36%)', // 绿色高亮
          },
          highlight: {
            background: nodeStyle.background,
            border: 'hsl(142 76% 36%)', // 绿色高亮
          },
        },
        font: nodeStyle.font,
        shape: NETWORK_OPTIONS.nodes.shape,
        margin: NETWORK_OPTIONS.nodes.margin,
        borderWidth: nodeStyle.borderWidth,
        shadow: nodeStyle.shadow,
      }
    })

    // 创建边数据集
    const edgesData = workflow.connections.map((conn) => ({
      id: conn.id,
      from: conn.fromStepId,
      to: conn.toStepId,
      label: conn.condition || undefined,
      arrows: NETWORK_OPTIONS.edges.arrows,
      smooth: NETWORK_OPTIONS.edges.smooth,
      color: NETWORK_OPTIONS.edges.color,
      width: NETWORK_OPTIONS.edges.width,
    }))

    nodesRef.current = new DataSet(nodesData)
    edgesRef.current = new DataSet(edgesData)

    const options = NETWORK_OPTIONS

    const network = new Network(
      containerRef.current,
      { nodes: nodesRef.current, edges: edgesRef.current },
      options
    )

    networkRef.current = network

    // 事件处理 - 先处理边点击（删除连线）
    network.on('click', (params) => {
      // 如果点击了边且不在连线模式
      if (params.edges.length > 0 && !isLinkMode) {
        const edgeId = params.edges[0]
        if (confirm('确定要删除这条连线吗？')) {
          const updatedConnections = workflow.connections.filter(c => c.id !== edgeId)
          onChange({ ...workflow, connections: updatedConnections })
        }
        return
      }

      // 处理节点点击
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0]
        const step = workflow.steps.find((s) => s.id === nodeId)
        if (step) {
          if (isLinkMode) {
            // 连线模式
            if (!linkSourceNode) {
              // 选择第一个节点
              setLinkSourceNode(step)
            } else {
              // 选择第二个节点，创建连线
              if (linkSourceNode.id !== step.id) {
                // 检查是否已存在连线
                const existingConnection = workflow.connections.find(
                  c => c.fromStepId === linkSourceNode.id && c.toStepId === step.id
                )
                if (!existingConnection) {
                  const newConnection: WorkflowConnection = {
                    id: `conn-${Date.now()}`,
                    workflowId: workflow.id,
                    fromStepId: linkSourceNode.id,
                    toStepId: step.id,
                    createdAt: new Date(),
                  }
                  onChange({
                    ...workflow,
                    connections: [...workflow.connections, newConnection],
                  })
                }
              }
              setLinkSourceNode(null)
              setIsLinkMode(false)
            }
          } else {
            setSelectedNode(step)
          }
        }
      } else {
        setSelectedNode(null)
        if (isLinkMode) {
          setLinkSourceNode(null)
          setIsLinkMode(false)
        }
      }
    })

    network.on('dragEnd', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0]
        const nodePosition = network.getPosition(nodeId)

        const updatedSteps = workflow.steps.map((step) =>
          step.id === nodeId
            ? { ...step, nodeX: Math.round(nodePosition.x), nodeY: Math.round(nodePosition.y) }
            : step
        )

        onChange({ ...workflow, steps: updatedSteps })
      }
    })

    // 双击打开编辑器
    network.on('doubleClick', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0]
        const step = workflow.steps.find((s) => s.id === nodeId)
        if (step) {
          setSelectedNode(step)
          setIsEditorOpen(true)
        }
      }
    })

    return () => {
      network.destroy()
      networkRef.current = null
    }
  }, [workflow.steps, workflow.connections, isLinkMode, linkSourceNode, onChange])

  // 点击其他区域关闭右键菜单
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuNode(null)
      setContextMenuPosition(null)
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])

  // 连线模式：高亮源节点（仅边框颜色）
  useEffect(() => {
    if (!networkRef.current || !nodesRef.current) return

    // 更新所有节点的样式
    const updatedNodes = workflow.steps.map((step) => {
      const nodeStyle = getNodeStyle(step)
      const isSourceNode = linkSourceNode?.id === step.id

      return {
        id: step.id,
        label: getNodeLabel(step),
        title: getNodeTitle(step),
        color: {
          background: nodeStyle.background,
          border: isSourceNode && isLinkMode
            ? 'hsl(142 76% 36%)' // 绿色边框高亮
            : nodeStyle.border,
        },
        font: nodeStyle.font,
        borderWidth: nodeStyle.borderWidth, // 保持原边框宽度
      }
    })

    nodesRef.current.update(updatedNodes)
  }, [linkSourceNode, isLinkMode, workflow.steps])

  // 添加新节点
  const handleAddNode = useCallback(() => {
    if (availableTaskTypes.length === 0) {
      return
    }

    // 默认添加第一个可用任务类型
    const taskType = availableTaskTypes[0].type
    const maxPosition = workflow.steps.length > 0
      ? Math.max(...workflow.steps.map(s => s.position))
      : -1

    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      workflowId: workflow.id,
      taskType,
      label: availableTaskTypes[0].label,
      enabled: true,
      priority: 5,
      position: maxPosition + 1,
      dependencies: [],
      nodeX: 100 + (workflow.steps.length * 200) % 600,
      nodeY: 100 + Math.floor(workflow.steps.length / 3) * 150,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    onChange({
      ...workflow,
      steps: [...workflow.steps, newStep],
    })
  }, [workflow, availableTaskTypes, onChange])

  // 删除选中节点
  const handleDeleteNode = useCallback(() => {
    if (!selectedNode) return

    if (!confirm(`确定要删除节点 "${selectedNode.label}" 吗？`)) {
      return
    }

    const updatedSteps = workflow.steps.filter((s) => s.id !== selectedNode.id)
    const updatedConnections = workflow.connections.filter(
      (c) => c.fromStepId !== selectedNode.id && c.toStepId !== selectedNode.id
    )

    onChange({
      ...workflow,
      steps: updatedSteps,
      connections: updatedConnections,
    })

    setSelectedNode(null)
  }, [selectedNode, workflow, onChange])

  // 保存节点编辑
  const handleSaveNode = useCallback((updatedStep: WorkflowStep) => {
    const updatedSteps = workflow.steps.map((s) =>
      s.id === updatedStep.id ? updatedStep : s
    )

    onChange({
      ...workflow,
      steps: updatedSteps,
    })

    setIsEditorOpen(false)
  }, [workflow, onChange])

  // 切换连线模式
  const handleToggleLinkMode = useCallback(() => {
    setIsLinkMode(prev => !prev)
    setLinkSourceNode(null)
    setSelectedNode(null)
  }, [])

  // 关闭右键菜单
  const closeContextMenu = useCallback(() => {
    setContextMenuNode(null)
    setContextMenuPosition(null)
  }, [])

  // 右键菜单：切换节点启用/禁用
  const handleToggleNodeEnabled = useCallback(() => {
    if (!contextMenuNode) return

    const updatedSteps = workflow.steps.map((s) =>
      s.id === contextMenuNode.id ? { ...s, enabled: !s.enabled } : s
    )

    onChange({
      ...workflow,
      steps: updatedSteps,
    })

    setContextMenuNode(null)
    setContextMenuPosition(null)
  }, [contextMenuNode, workflow, onChange])

  // 右键菜单：编辑节点
  const handleContextMenuEdit = useCallback(() => {
    if (!contextMenuNode) return
    setSelectedNode(contextMenuNode)
    setIsEditorOpen(true)
    setContextMenuNode(null)
    setContextMenuPosition(null)
  }, [contextMenuNode])

  // 右键菜单：删除节点
  const handleContextMenuDelete = useCallback(() => {
    if (!contextMenuNode) return

    if (!confirm(`确定要删除节点 "${contextMenuNode.label}" 吗？`)) {
      return
    }

    const updatedSteps = workflow.steps.filter((s) => s.id !== contextMenuNode.id)
    const updatedConnections = workflow.connections.filter(
      (c) => c.fromStepId !== contextMenuNode.id && c.toStepId !== contextMenuNode.id
    )

    onChange({
      ...workflow,
      steps: updatedSteps,
      connections: updatedConnections,
    })

    setSelectedNode(null)
    setContextMenuNode(null)
    setContextMenuPosition(null)
  }, [contextMenuNode, workflow, onChange])

  return (
    <div className="relative w-full h-full">
      {/* 网络图容器 */}
      <div
        ref={containerRef}
        className="w-full h-full"
        onContextMenu={(e) => {
          e.preventDefault()

          // 获取点击位置的节点
          if (!networkRef.current) return

          const canvasBox = containerRef.current!.getBoundingClientRect()
          const x = e.clientX - canvasBox.left
          const y = e.clientY - canvasBox.top

          // 使用 vis-network 的 DOM API 获取点击位置的节点
          const nodeId = networkRef.current.getNodeAt({ x, y })

          if (nodeId) {
            const step = workflow.steps.find((s) => s.id === nodeId)
            if (step) {
              setContextMenuNode(step)
              setContextMenuPosition({ x, y })
            }
          } else {
            setContextMenuNode(null)
            setContextMenuPosition(null)
          }
        }}
      />

      {/* 悬浮工具栏 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-lg bg-background/95 backdrop-blur border shadow-lg">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddNode}
          disabled={availableTaskTypes.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          添加节点
        </Button>

        <Button
          variant={isLinkMode ? 'default' : 'outline'}
          size="sm"
          onClick={handleToggleLinkMode}
        >
          <Link2 className="h-4 w-4 mr-1" />
          {isLinkMode ? '取消连线' : '连线'}
        </Button>

        {selectedNode && (
          <>
            <div className="w-px h-6 bg-border" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditorOpen(true)}
            >
              <Edit className="h-4 w-4 mr-1" />
              编辑
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteNode}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除
            </Button>
          </>
        )}
      </div>

      {/* 选中节点信息提示 */}
      {selectedNode && !isLinkMode && (
        <div className="absolute top-4 left-4 px-3 py-2 rounded-lg bg-background/95 backdrop-blur border shadow-sm">
          <div className="text-sm font-medium">{selectedNode.label}</div>
          <div className="text-xs text-muted-foreground">
            {selectedNode.taskType} {selectedNode.enabled ? '' : '(已禁用)'}
          </div>
          {selectedNode.config?.promptKey && (
            <div className="text-xs text-primary mt-1 flex items-center gap-1">
              📝 提示词: {selectedNode.config.promptKey}
            </div>
          )}
        </div>
      )}

      {/* 连线模式提示 */}
      {isLinkMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-primary/95 backdrop-blur border shadow-sm">
          <div className="text-sm font-medium text-primary-foreground">
            {linkSourceNode ? `已选择: ${linkSourceNode.label}，请点击目标节点` : '请点击起始节点'}
          </div>
          <div className="text-xs text-primary-foreground/80">
            点击连线按钮退出连线模式
          </div>
        </div>
      )}

      {/* 边操作提示 */}
      {!isLinkMode && (
        <div className="absolute top-4 right-4 px-3 py-2 rounded-lg bg-background/95 backdrop-blur border shadow-sm">
          <div className="text-xs text-muted-foreground">
            点击连线可删除
          </div>
        </div>
      )}

      {/* 节点编辑器 */}
      <WorkflowNodeEditor
        step={selectedNode}
        availableTaskTypes={availableTaskTypes}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveNode}
        allSteps={workflow.steps}
      />

      {/* 右键菜单 */}
      {contextMenuNode && contextMenuPosition && (
        <div
          className="absolute z-[100] min-w-40 rounded-md border bg-popover p-1 shadow-lg"
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 菜单标题 */}
          <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground border-b mb-1">
            {contextMenuNode.label}
          </div>

          {/* 编辑节点 */}
          <button
            onClick={handleContextMenuEdit}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
          >
            <Edit className="h-4 w-4" />
            编辑节点
          </button>

          {/* 启用/禁用 */}
          <button
            onClick={handleToggleNodeEnabled}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
          >
            {contextMenuNode.enabled ? (
              <>
                <Power className="h-4 w-4" />
                禁用节点
              </>
            ) : (
              <>
                <Check className="h-4 w-4 text-primary" />
                <span className="text-primary">启用节点</span>
              </>
            )}
          </button>

          {/* 删除节点 */}
          <button
            onClick={handleContextMenuDelete}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            删除节点
          </button>
        </div>
      )}
    </div>
  )
}
