'use client'

/**
 * 知识图谱组件
 * 使用 vis-network 展示笔记关联关系
 */
import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { Network } from 'vis-network/standalone'
import { DataSet } from 'vis-data/peer'
import { useQuery } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Loader2, FileText } from 'lucide-react'
import { graphApi, notesApi } from '@/lib/api'
import { GraphData, GraphNode, GraphEdge, GraphFilters, NoteBlock } from '@daily-note/shared'
import { formatRelativeTime } from '@/lib/utils'

export interface KnowledgeGraphRef {
  exportAsPNG: () => void
  exportAsSVG: () => void
}

interface KnowledgeGraphProps {
  filters?: GraphFilters
  onNodeClick?: (node: GraphNode) => void
  className?: string
}

export const KnowledgeGraph = forwardRef<KnowledgeGraphRef, KnowledgeGraphProps>(
  ({ filters, onNodeClick, className = '' }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  /**
   * 导出为 PNG
   */
  const exportAsPNG = () => {
    if (!networkRef.current) return

    const canvas = networkRef.current.canvas?.body?.container?.querySelector('canvas')
    if (!canvas) return

    try {
      // 创建下载链接
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `knowledge-graph-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('Failed to export graph as PNG:', error)
    }
  }

  /**
   * 导出为 SVG
   * 注意：vis-network 基于 canvas，这里使用 SVG image 包装 PNG 导出
   */
  const exportAsSVG = () => {
    if (!networkRef.current) return

    const canvas = networkRef.current.canvas?.body?.container?.querySelector('canvas')
    if (!canvas) return

    try {
      // 获取 canvas 数据
      const dataUrl = canvas.toDataURL('image/png')
      const width = canvas.width
      const height = canvas.height

      // 创建 SVG 内容
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <image href="${dataUrl}" width="${width}" height="${height}" />
        </svg>
      `

      // 创建 Blob 并下载
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `knowledge-graph-${Date.now()}.svg`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export graph as SVG:', error)
    }
  }

  /**
   * 暴露导出方法给父组件
   */
  useImperativeHandle(ref, () => ({
    exportAsPNG,
    exportAsSVG,
  }))

  /**
   * 获取选中笔记的完整数据
   */
  const { data: noteResponse, isLoading: isNoteLoading } = useQuery({
    queryKey: ['note', selectedNoteId],
    queryFn: () => notesApi.get(selectedNoteId!),
    enabled: isSheetOpen && !!selectedNoteId,
  })

  const selectedNote = noteResponse?.data as NoteBlock

  /**
   * 获取图谱数据
   */
  const { data: graphDataResponse, isLoading, error } = useQuery({
    queryKey: ['graph-data', filters],
    queryFn: () => graphApi.get(filters),
    staleTime: 60000, // 1 minute cache
  })

  const graphData = graphDataResponse?.data as GraphData

  /**
   * 初始化图谱
   */
  useEffect(() => {
    if (!containerRef.current) return

    // 初始化空的 network
    const nodes = new DataSet<any>([])
    const edges = new DataSet<any>([])

    const network = new Network(
      containerRef.current,
      { nodes, edges },
      {
        nodes: {
          shape: 'dot',
          scaling: {
            min: 10,
            max: 30,
            label: {
              enabled: true,
              min: 14,
              max: 24,
            },
          },
          font: {
            size: 12,
            face: 'Arial',
          },
          borderWidth: 2,
          shadow: true,
        },
        edges: {
          width: 0.15,
          color: {
            color: '#6b7280',
            highlight: '#3b82f6',
            hover: '#3b82f6',
          },
          smooth: {
            type: 'continuous',
            roundness: 0.5,
          },
          shadow: false,
        },
        physics: {
          forceAtlas2Based: {
            gravitationalConstant: -50,
            centralGravity: 0.01,
            springLength: 100,
            springConstant: 0.08,
          },
          maxVelocity: 50,
          solver: 'forceAtlas2Based',
          timestep: 0.35,
          stabilization: {
            iterations: 150,
          },
        },
        interaction: {
          hover: true,
          tooltipDelay: 200,
          zoomView: true,
          dragView: true,
        },
      }
    )

    networkRef.current = network

    /**
     * 节点点击事件
     */
    network.on('click', (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0]
        const node = graphData?.nodes.find((n) => n.id === nodeId)
        if (node) {
          setSelectedNode(node)
          if (onNodeClick) {
            onNodeClick(node)
          }
          // 打开笔记预览面板
          setSelectedNoteId(node.id)
          setIsSheetOpen(true)
        }
      }
    })

    /**
     * 节点悬停事件
     */
    network.on('hoverNode', (params: any) => {
      const nodeId = params.node
      const node = graphData?.nodes.find((n) => n.id === nodeId)
      if (node) {
        network.canvas.body.container.style.cursor = 'pointer'
      }
    })

    network.on('blurNode', () => {
      network.canvas.body.container.style.cursor = 'default'
    })

    return () => {
      network.destroy()
      networkRef.current = null
    }
  }, [])

  /**
   * 更新图谱数据
   */
  useEffect(() => {
    if (!networkRef.current || !graphData) return

    const nodes = new DataSet(
      graphData.nodes.map((node) => ({
        id: node.id,
        label: node.label || node.content?.substring(0, 30) + '...',
        title: `
          <div>
            <strong>${node.category || '未分类'}</strong><br/>
            ${node.sentiment ? `情绪: ${node.sentiment}<br/>` : ''}
            ${node.importance ? `重要性: ${node.importance}<br/>` : ''}
            ${node.date ? `日期: ${new Date(node.date).toLocaleDateString()}<br/>` : ''}
            ${node.tags?.length ? `标签: ${node.tags.join(', ')}` : ''}
          </div>
        `,
        color: getNodeColor(node),
        size: getNodeSize(node),
        font: {
          color: '#ffffff',
          size: 12,
        },
      }))
    )

    const edges = new DataSet(
      graphData.edges.map((edge) => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        width: getEdgeWidth(edge),
        title: edge.reason || `相似度: ${(edge.similarity || 0).toFixed(2)}`,
      }))
    )

    networkRef.current.setData({ nodes, edges })

    // 重新适应视图
    setTimeout(() => {
      networkRef.current?.fit({
        animation: {
          duration: 1000,
          easingFunction: 'easeInOutQuad',
        },
      })
    }, 100)
  }, [graphData])

  /**
   * 根据情感和分类获取节点颜色
   */
  const getNodeColor = (node: GraphNode): { background: string; border: string } => {
    // 优先根据情感着色
    if (node.sentiment) {
      switch (node.sentiment) {
        case 'positive':
          return { background: '#22c55e', border: '#16a34a' }
        case 'negative':
          return { background: '#ef4444', border: '#dc2626' }
        case 'neutral':
          return { background: '#6b7280', border: '#4b5563' }
      }
    }

    // 根据分类着色（使用哈希值生成一致的颜色）
    if (node.category) {
      const hash = node.category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const hue = hash % 360
      return {
        background: `hsl(${hue}, 70%, 50%)`,
        border: `hsl(${hue}, 70%, 40%)`,
      }
    }

    // 默认颜色
    return { background: '#3b82f6', border: '#2563eb' }
  }

  /**
   * 根据重要性计算节点大小
   */
  const getNodeSize = (node: GraphNode): number => {
    if (node.importance) {
      // 重要性范围 1-10，映射到大小 15-40
      return 15 + (node.importance / 10) * 25
    }
    return 20 // 默认大小
  }

  /**
   * 根据相似度计算边的宽度
   */
  const getEdgeWidth = (edge: GraphEdge): number => {
    if (edge.similarity) {
      // 相似度范围 0-1，映射到宽度 1-5
      return 1 + edge.similarity * 4
    }
    if (edge.weight) {
      return Math.min(Math.max(edge.weight, 1), 5)
    }
    return 1 // 默认宽度
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">加载图谱中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <p className="text-sm text-red-500">加载图谱失败</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(error as Error).message}
          </p>
        </div>
      </div>
    )
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <p className="text-sm text-muted-foreground">暂无图谱数据</p>
      </div>
    )
  }

  return (
    <>
      <div className={`w-full h-full ${className}`}>
        <div ref={containerRef} className="w-full h-full min-h-[500px]" />
      </div>

      {/* 笔记预览面板 */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-[450px] flex flex-col">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                笔记预览
              </div>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {isNoteLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : selectedNote ? (
              <div className="space-y-4">
                {/* 分类和标签 */}
                <div className="flex flex-wrap items-center gap-2">
                  {selectedNote.category && (
                    <Badge variant="outline" className="text-xs">
                      {selectedNote.category}
                    </Badge>
                  )}
                  {selectedNote.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* 时间信息 */}
                <div className="text-xs text-muted-foreground">
                  {formatRelativeTime(selectedNote.createdAt)}
                  {selectedNote.updatedAt !== selectedNote.createdAt && (
                    <span className="ml-2">
                      (更新于 {formatRelativeTime(selectedNote.updatedAt)})
                    </span>
                  )}
                </div>

                {/* 笔记内容 */}
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{selectedNote.content}</p>
                </div>

                {/* 图谱节点额外信息 */}
                {selectedNode && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <h4 className="text-sm font-medium">图谱信息</h4>
                    {selectedNode.sentiment && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">情绪:</span>
                        <Badge
                          variant="outline"
                          className={
                            selectedNode.sentiment === 'positive'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : selectedNode.sentiment === 'negative'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                          }
                        >
                          {selectedNode.sentiment === 'positive'
                            ? '积极'
                            : selectedNode.sentiment === 'negative'
                            ? '消极'
                            : '中性'}
                        </Badge>
                      </div>
                    )}
                    {selectedNode.importance && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">重要性:</span>
                        <Badge variant="outline">{selectedNode.importance}/10</Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : selectedNode ? (
              // 如果没有完整笔记数据，显示图谱节点信息
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedNode.category && (
                    <Badge variant="outline" className="text-xs">
                      {selectedNode.category}
                    </Badge>
                  )}
                  {selectedNode.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {selectedNode.sentiment && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">情绪:</span>
                    <Badge
                      variant="outline"
                      className={
                        selectedNode.sentiment === 'positive'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : selectedNode.sentiment === 'negative'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-gray-50 text-gray-700 border-gray-200'
                      }
                    >
                      {selectedNode.sentiment === 'positive'
                        ? '积极'
                        : selectedNode.sentiment === 'negative'
                        ? '消极'
                        : '中性'}
                    </Badge>
                  </div>
                )}

                {selectedNode.importance && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">重要性:</span>
                    <Badge variant="outline">{selectedNode.importance}/10</Badge>
                  </div>
                )}

                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{selectedNode.content}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                未找到笔记信息
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
  }
)

KnowledgeGraph.displayName = 'KnowledgeGraph'

