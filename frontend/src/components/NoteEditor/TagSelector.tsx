/**
 * 标签选择器组件
 * 显示已选标签列表，点击可移除，支持多选
 */
'use client'

import { useState } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Plus, ChevronRight, X } from 'lucide-react'
import { ItemSelectorSheet } from '../ItemSelectorSheet'

// 预设颜色池（与 ItemSelectorSheet 保持一致）
const COLOR_POOL = [
  'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
  'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30',
  'bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30',
  'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30',
  'bg-pink-500/20 text-pink-400 border-pink-500/30 hover:bg-pink-500/30',
  'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30',
  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30',
  'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30',
]

// 根据名称获取颜色
const getColorForName = (name: string): string => {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLOR_POOL[Math.abs(hash) % COLOR_POOL.length]
}

interface TagSelectorProps {
  value: string[]
  onChange: (value: string[]) => void
  compact?: boolean
  maxDisplay?: number  // 最多显示的标签数量
}

export function TagSelector({
  value,
  onChange,
  compact = false,
  maxDisplay = 3
}: TagSelectorProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleRemoveTag = (tagName: string) => {
    onChange(value.filter((t) => t !== tagName))
  }

  // 需要显示的标签
  const visibleTags = value.slice(0, maxDisplay)
  const remainingCount = Math.max(0, value.length - maxDisplay)

  // 紧凑模式
  if (compact) {
    return (
      <>
        <div className="flex items-center gap-1.5 flex-wrap">
          {visibleTags.map((tag) => {
            const colorClass = getColorForName(tag)

            return (
              <Badge
                key={tag}
                variant="outline"
                className={`${colorClass} group h-7 px-2 text-xs`}
              >
                #{tag}
                <X
                  className="h-3 w-3 ml-1 opacity-60 group-hover:opacity-100 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveTag(tag)
                  }}
                />
              </Badge>
            )
          })}

          {remainingCount > 0 && (
            <Badge
              variant="outline"
              className="h-7 px-2 text-xs bg-text-secondary/10 text-text-secondary cursor-pointer hover:bg-text-secondary/20"
              onClick={() => setSheetOpen(true)}
            >
              +{remainingCount}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSheetOpen(true)}
            className="h-7 px-2 text-xs text-text-muted hover:text-text-primary"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <ItemSelectorSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          mode="tag"
          value={value}
          onChange={(v) => onChange(Array.isArray(v) ? v : [v])}
        />
      </>
    )
  }

  // 原有的完整显示模式
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">标签</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {value.length === 0 ? (
            <span className="text-xs text-text-muted">未选择标签</span>
          ) : (
            value.map((tag) => {
              const colorClass = getColorForName(tag)

              return (
                <Badge
                  key={tag}
                  variant="outline"
                  className={`${colorClass} group cursor-pointer`}
                  onClick={() => handleRemoveTag(tag)}
                >
                  #{tag}
                  <X className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Badge>
              )
            })
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSheetOpen(true)}
            className="h-6 px-2 text-xs text-text-muted hover:text-text-primary"
          >
            <Plus className="h-3 w-3 mr-1" />
            新增
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        </div>
      </div>

      <ItemSelectorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode="tag"
        value={value}
        onChange={(v) => onChange(Array.isArray(v) ? v : [v])}
      />
    </>
  )
}
