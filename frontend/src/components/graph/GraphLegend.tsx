/**
 * 图谱图例组件
 * 说明节点颜色、大小和边的粗细含义
 */
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Circle, Minus, Info } from 'lucide-react'

interface GraphLegendProps {
  className?: string
}

export function GraphLegend({ className = '' }: GraphLegendProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="h-4 w-4" />
          图谱说明
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 节点颜色 */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-text-primary">节点颜色</h4>
          <div className="space-y-2">
            {/* 按情感着色 */}
            <div>
              <p className="text-xs text-text-muted mb-1.5">按情感着色</p>
              <div className="flex flex-wrap gap-2">
                <LegendItem
                  color="bg-green-500"
                  label="积极"
                  description="正面情绪"
                />
                <LegendItem
                  color="bg-red-500"
                  label="消极"
                  description="负面情绪"
                />
                <LegendItem
                  color="bg-gray-500"
                  label="中性"
                  description="中立情绪"
                />
              </div>
            </div>

            {/* 按分类着色 */}
            <div>
              <p className="text-xs text-text-muted mb-1.5">按分类着色</p>
              <div className="flex flex-wrap gap-2">
                <LegendItem
                  color="bg-blue-500"
                  label="分类"
                  description="不同分类不同颜色"
                />
                <Badge variant="outline" className="text-xs">
                  默认
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* 节点大小 */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-text-primary">节点大小</h4>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Circle className="h-3 w-3 fill-current text-primary" />
              <span className="text-xs text-text-muted">小</span>
            </div>
            <Minus className="h-4 w-4 text-text-muted rotate-0" />
            <div className="flex items-center gap-1">
              <Circle className="h-5 w-5 fill-current text-primary" />
              <span className="text-xs text-text-muted">大</span>
            </div>
            <span className="text-xs text-text-muted ml-2">
              表示重要性 (1-10)
            </span>
          </div>
        </div>

        {/* 边的粗细 */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-text-primary">连线粗细</h4>
          <div className="flex items-center gap-3">
            <div className="h-0.5 w-8 bg-gray-400" />
            <span className="text-xs text-text-muted">弱关联</span>
            <Minus className="h-4 w-4 text-text-muted rotate-0" />
            <div className="h-1 w-8 bg-gray-400" />
            <span className="text-xs text-text-muted">强关联</span>
          </div>
          <p className="text-xs text-text-muted mt-2">
            基于相似度分数 (0-1)
          </p>
        </div>

        {/* 交互提示 */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-text-muted">
            💡 点击节点查看笔记详情，拖拽节点调整布局
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

interface LegendItemProps {
  color: string
  label: string
  description: string
}

function LegendItem({ color, label, description }: LegendItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-3 w-3 rounded-full ${color}`} />
      <span className="text-xs text-text-primary">{label}</span>
    </div>
  )
}
