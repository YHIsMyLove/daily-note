/**
 * 标签选择器组件
 * 显示已选标签列表，点击可移除，支持多选
 */
'use client'

import { useState } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Plus, ChevronRight, X } from 'lucide-react'
import { ItemSelectorDialog } from '../ItemSelectorDialog'
import { getColorName, getCategoryColorStyle } from '@/lib/colors'

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
            const categoryStyle = getCategoryColorStyle(tag)

            return (
              <Badge
                key={tag}
                variant="outline"
                className="group h-7 px-2 text-xs"
                style={categoryStyle}
                onMouseEnter={(e) => {
                  const colorName = getColorName(tag)
                  e.currentTarget.style.backgroundColor = `hsl(var(--category-${colorName}) / 0.3)`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = `hsl(var(--category-${getColorName(tag)}) / 0.15)`
                }}
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

        <ItemSelectorDialog
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
              const categoryStyle = getCategoryColorStyle(tag)

              return (
                <Badge
                  key={tag}
                  variant="outline"
                  className="group cursor-pointer"
                  style={categoryStyle}
                  onMouseEnter={(e) => {
                    const colorName = getColorName(tag)
                    e.currentTarget.style.backgroundColor = `hsl(var(--category-${colorName}) / 0.3)`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = `hsl(var(--category-${getColorName(tag)}) / 0.15)`
                  }}
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

      <ItemSelectorDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode="tag"
        value={value}
        onChange={(v) => onChange(Array.isArray(v) ? v : [v])}
      />
    </>
  )
}
