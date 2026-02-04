'use client'

/**
 * Pipeline 流程图组件
 *
 * 使用 vis-network 渲染可编辑的提示词管道流程图
 * 支持从提示词面板拖拽创建节点
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { Network, DataSet } from 'vis-network/standalone'
import type { PipelineDetail, PipelineNode, PipelineEdge } from '@daily-note/shared'
import { pipelineApi } from '@/lib/pipeline-api'
import { PromptTemplate } from '@daily-note/shared'
import { Plus, Trash2, Edit, Link2, Power, Check, Play, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  getPipelineNodeStyle,
  getPipelineNodeLabel,
  getPipelineNodeTitle,
  NETWORK_OPTIONS,
} from './workflow-chart-styles'

/**
 * 右键菜单位置
 */
interface ContextMenuPosition {
  x: number
  y: number
}

interface PipelineFlowChartProps {
  pipeline: PipelineDetail
  onChange: (pipeline: PipelineDetail) => void
  /** 可用的提示词模板（用于创建节点） */
  availablePrompts?: PromptTemplate[]
}

export function PipelineFlowChart({
  pipeline,
  onChange,
  availablePrompts = [],
}: PipelineFlowChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const nodesRef = useRef<DataSet<any> | null>(null)
  const edgesRef = useRef<DataSet<any> | null>(null)

  const [selectedNode, setSelectedNode] = useState<PipelineNode | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isLinkMode, setIsLinkMode] = useState(false)
  const [linkSourceNode, setLinkSourceNode] = useState<PipelineNode | null>(null)

  // 右键菜单状态
  const [contextMenuNode, setContextMenuNode] = useState<PipelineNode | null>(null)
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null)

  // 初始化网络图
  useEffect(() => {
    if (!containerRef.current) return

    // 创建节点数据集
    const nodesData = pipeline.nodes.map((node) => {
      const nodeStyle = getPipelineNodeStyle(node)
      return {
        id: node.id,
        label: getPipelineNodeLabel(node),
        title: getPipelineNodeTitle(node),
        x: node.nodeX,
        y: node.nodeY,
        enabled: node.enabled,
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
    const edgesData = pipeline.edges.map((edge) => ({
      id: edge.id,
      from: edge.fromNodeId,
      to: edge.toNodeId,
      label: edge.condition || undefined,
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
          const updatedEdges = pipeline.edges.filter(e => e.id !== edgeId)
          onChange({ ...pipeline, edges: updatedEdges })
        }
        return
      }

      // 处理节点点击
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0]
        const node = pipeline.nodes.find((n) => n.id === nodeId)
        if (node) {
          if (isLinkMode) {
            // 连线模式
            if (!linkSourceNode) {
              // 选择第一个节点
              setLinkSourceNode(node)
            } else {
              // 选择第二个节点，创建连线
              if (linkSourceNode.id !== node.id) {
                // 检查是否已存在连线
                const existingEdge = pipeline.edges.find(
                  e => e.fromNodeId === linkSourceNode.id && e.toNodeId === node.id
                )
                if (!existingEdge) {
                  const newEdge: PipelineEdge = {
                    id: `edge-${Date.now()}`,
                    pipelineId: pipeline.id,
                    fromNodeId: linkSourceNode.id,
                    toNodeId: node.id,
                    outputKey: 'output',
                    inputKey: 'input',
                    createdAt: new Date(),
                  }
                  onChange({
                    ...pipeline,
                    edges: [...pipeline.edges, newEdge],
                  })
                }
              }
              setLinkSourceNode(null)
              setIsLinkMode(false)
            }
          } else {
            setSelectedNode(node)
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

        const updatedNodes = pipeline.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, nodeX: Math.round(nodePosition.x), nodeY: Math.round(nodePosition.y) }
            : node
        )

        onChange({ ...pipeline, nodes: updatedNodes })
      }
    })

    // 双击打开编辑器
    network.on('doubleClick', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0]
        const node = pipeline.nodes.find((n) => n.id === nodeId)
        if (node) {
          setSelectedNode(node)
          setIsEditorOpen(true)
        }
      }
    })

    return () => {
      network.destroy()
      networkRef.current = null
    }
  }, [pipeline.nodes, pipeline.edges, isLinkMode, linkSourceNode, onChange])

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

  // 连线模式：高亮源节点
  useEffect(() => {
    if (!networkRef.current || !nodesRef.current) return

    const updatedNodes = pipeline.nodes.map((node) => {
      const nodeStyle = getPipelineNodeStyle(node)
      const isSourceNode = linkSourceNode?.id === node.id

      return {
        id: node.id,
        label: getPipelineNodeLabel(node),
        title: getPipelineNodeTitle(node),
        color: {
          background: nodeStyle.background,
          border: isSourceNode && isLinkMode
            ? 'hsl(142 76% 36%)' // 绿色边框高亮
            : nodeStyle.border,
        },
        font: nodeStyle.font,
        borderWidth: nodeStyle.borderWidth,
      }
    })

    nodesRef.current.update(updatedNodes)
  }, [linkSourceNode, isLinkMode, pipeline.nodes])

  /**
   * 处理拖放（从提示词面板）
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()

    const data = JSON.parse(e.dataTransfer.getData('application/json'))
    if (data.type !== 'prompt') return

    // 计算节点位置
    const network = networkRef.current
    if (!network || !containerRef.current) return

    const canvasBox = containerRef.current.getBoundingClientRect()
    const pointerPos = {
      x: e.clientX - canvasBox.left,
      y: e.clientY - canvasBox.top,
    }

    // 转换为网络坐标
    const networkPos = network.canvasToDOM(pointerPos)

    // 创建新节点
    const newNode: PipelineNode = {
      id: `node-${Date.now()}`,
      pipelineId: pipeline.id,
      promptKey: data.key,
      promptName: data.name,
      enabled: true,
      nodeX: Math.round(pointerPos.x - canvasBox.width / 2),
      nodeY: Math.round(pointerPos.y - canvasBox.height / 2),
      incomingEdges: [],
      outgoingEdges: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // 保存到后端
    try {
      await pipelineApi.addNode(pipeline.id, {
        promptKey: newNode.promptKey,
        promptName: newNode.promptName,
        nodeX: newNode.nodeX,
        nodeY: newNode.nodeY,
      })
    } catch (error) {
      console.error('Failed to create node:', error)
    }

    // 更新本地状态
    onChange({
      ...pipeline,
      nodes: [...pipeline.nodes, newNode],
    })
  }

  // 添加新节点
  const handleAddNode = useCallback(() => {
    if (availablePrompts.length === 0) {
      return
    }

    // 使用第一个可用提示词
    const prompt = availablePrompts[0]

    const newNode: PipelineNode = {
      id: `node-${Date.now()}`,
      pipelineId: pipeline.id,
      promptKey: prompt.key,
      promptName: prompt.name,
      enabled: true,
      nodeX: 100 + (pipeline.nodes.length * 200) % 600,
      nodeY: 100 + Math.floor(pipeline.nodes.length / 3) * 150,
      incomingEdges: [],
      outgoingEdges: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    onChange({
      ...pipeline,
      nodes: [...pipeline.nodes, newNode],
    })
  }, [pipeline, availablePrompts, onChange])

  // 删除选中节点
  const handleDeleteNode = useCallback(() => {
    if (!selectedNode) return

    if (!confirm(`确定要删除节点 "${selectedNode.promptName}" 吗？`)) {
      return
    }

    const updatedNodes = pipeline.nodes.filter((n) => n.id !== selectedNode.id)
    const updatedEdges = pipeline.edges.filter(
      (e) => e.fromNodeId !== selectedNode.id && e.toNodeId !== selectedNode.id
    )

    onChange({
      ...pipeline,
      nodes: updatedNodes,
      edges: updatedEdges,
    })

    setSelectedNode(null)
  }, [selectedNode, pipeline, onChange])

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

    const updatedNodes = pipeline.nodes.map((n) =>
      n.id === contextMenuNode.id ? { ...n, enabled: !n.enabled } : n
    )

    onChange({
      ...pipeline,
      nodes: updatedNodes,
    })

    setContextMenuNode(null)
    setContextMenuPosition(null)
  }, [contextMenuNode, pipeline, onChange])

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

    if (!confirm(`确定要删除节点 "${contextMenuNode.promptName}" 吗？`)) {
      return
    }

    const updatedNodes = pipeline.nodes.filter((n) => n.id !== contextMenuNode.id)
    const updatedEdges = pipeline.edges.filter(
      (e) => e.fromNodeId !== contextMenuNode.id && e.toNodeId !== contextMenuNode.id
    )

    onChange({
      ...pipeline,
      nodes: updatedNodes,
      edges: updatedEdges,
    })

    setSelectedNode(null)
    setContextMenuNode(null)
    setContextMenuPosition(null)
  }, [contextMenuNode, pipeline, onChange])

  return (
    <div className="relative w-full h-full">
      {/* 网络图容器 */}
      <div
        ref={containerRef}
        className="w-full h-full"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onContextMenu={(e) => {
          e.preventDefault()

          if (!networkRef.current) return

          const canvasBox = containerRef.current!.getBoundingClientRect()
          const x = e.clientX - canvasBox.left
          const y = e.clientY - canvasBox.top

          const nodeId = networkRef.current.getNodeAt({ x, y })

          if (nodeId) {
            const node = pipeline.nodes.find((n) => n.id === nodeId)
            if (node) {
              setContextMenuNode(node)
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
          disabled={availablePrompts.length === 0}
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
          <div className="text-sm font-medium">{selectedNode.promptName}</div>
          <div className="text-xs text-muted-foreground">
            📝 {selectedNode.promptKey} {selectedNode.enabled ? '' : '(已禁用)'}
          </div>
        </div>
      )}

      {/* 连线模式提示 */}
      {isLinkMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-primary/95 backdrop-blur border shadow-sm">
          <div className="text-sm font-medium text-primary-foreground">
            {linkSourceNode ? `已选择: ${linkSourceNode.promptName}，请点击目标节点` : '请点击起始节点'}
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
            从左侧提示词面板拖拽提示词到画布创建节点
          </div>
          <div className="text-xs text-muted-foreground">
            点击连线可删除
          </div>
        </div>
      )}

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
            {contextMenuNode.promptName}
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

      {/* 节点编辑对话框 */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑节点</DialogTitle>
          </DialogHeader>

          {selectedNode && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>提示词</Label>
                <div className="text-sm font-medium">{selectedNode.promptName}</div>
                <div className="text-xs text-muted-foreground">{selectedNode.promptKey}</div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="node-enabled">启用此节点</Label>
                <Switch
                  id="node-enabled"
                  checked={selectedNode.enabled}
                  onCheckedChange={(enabled) => {
                    const updatedNodes = pipeline.nodes.map((n) =>
                      n.id === selectedNode.id ? { ...n, enabled } : n
                    )
                    onChange({ ...pipeline, nodes: updatedNodes })
                    setSelectedNode({ ...selectedNode, enabled })
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="node-x">X 坐标</Label>
                  <Input
                    id="node-x"
                    type="number"
                    value={selectedNode.nodeX}
                    onChange={(e) => {
                      const nodeX = parseInt(e.target.value) || 0
                      const updatedNodes = pipeline.nodes.map((n) =>
                        n.id === selectedNode.id ? { ...n, nodeX } : n
                      )
                      onChange({ ...pipeline, nodes: updatedNodes })
                      setSelectedNode({ ...selectedNode, nodeX })
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="node-y">Y 坐标</Label>
                  <Input
                    id="node-y"
                    type="number"
                    value={selectedNode.nodeY}
                    onChange={(e) => {
                      const nodeY = parseInt(e.target.value) || 0
                      const updatedNodes = pipeline.nodes.map((n) =>
                        n.id === selectedNode.id ? { ...n, nodeY } : n
                      )
                      onChange({ ...pipeline, nodes: updatedNodes })
                      setSelectedNode({ ...selectedNode, nodeY })
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
