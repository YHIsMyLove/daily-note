/**
 * 分类选择器组件
 * 简化版：显示当前选中 + 部分列表，点击打开侧边弹窗
 */
'use client'

import { useState, useEffect } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Plus, ChevronRight } from 'lucide-react'
import { ItemSelectorDialog } from '../ItemSelectorDialog'
import { categoriesApi } from '@/lib/api'
import { Category } from '@daily-note/shared'
import { getColorName, getCategoryColorStyle } from '@/lib/colors'

interface CategorySelectorProps {
  value: string
  onChange: (value: string) => void
  compact?: boolean  // 新增：紧凑模式
}

export function CategorySelector({ value, onChange, compact = false }: CategorySelectorProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  // 加载分类列表
  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const response = await categoriesApi.list()
      if (response.success && response.data) {
        setCategories(response.data)
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  // 紧凑模式：只显示当前选中或"选择分类"
  if (compact) {
    const categoryStyle = value ? getCategoryColorStyle(value) : undefined

    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSheetOpen(true)}
          className="h-7 px-2 text-xs"
          style={categoryStyle || {
            color: 'hsl(var(--text-muted))',
          }}
          onMouseEnter={(e) => {
            if (value) {
              const colorName = getColorName(value)
              e.currentTarget.style.backgroundColor = `hsl(var(--category-${colorName}) / 0.3)`
            } else {
              e.currentTarget.style.color = 'hsl(var(--text-primary))'
            }
          }}
          onMouseLeave={(e) => {
            if (value) {
              e.currentTarget.style.backgroundColor = `hsl(var(--category-${getColorName(value)}) / 0.15)`
            } else {
              e.currentTarget.style.color = 'hsl(var(--text-muted))'
            }
          }}
        >
          {value || '选择分类'}
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>

        <ItemSelectorDialog
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          mode="category"
          value={value}
          onChange={(v) => onChange(typeof v === 'string' ? v : v[0] || '')}
        />
      </>
    )
  }

  // 原有的完整显示模式
  // 获取要显示的分类列表
  // 优先显示当前选中的分类，然后显示其他分类（最多显示 5 个）
  const displayCategories = (() => {
    const otherCategories = categories.filter((c) => c.name !== value)
    const result = value ? [{ name: value, count: 0 }, ...otherCategories] : otherCategories
    return result.slice(0, 6)
  })()

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">分类</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {displayCategories.map((category) => {
            const isSelected = value === category.name
            const categoryStyle = getCategoryColorStyle(category.name)

            return (
              <Badge
                key={category.name}
                variant={isSelected ? 'default' : 'outline'}
                className="cursor-pointer transition-all"
                style={!isSelected ? categoryStyle : undefined}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    const colorName = getColorName(category.name)
                    e.currentTarget.style.backgroundColor = `hsl(var(--category-${colorName}) / 0.3)`
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = `hsl(var(--category-${getColorName(category.name)}) / 0.15)`
                  }
                }}
                onClick={() => {
                  if (isSelected) {
                    // 点击已选中的则取消选中
                    onChange('')
                  } else {
                    onChange(category.name)
                  }
                }}
              >
                {category.name}
              </Badge>
            )
          })}
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
        mode="category"
        value={value}
        onChange={(v) => onChange(typeof v === 'string' ? v : v[0] || '')}
      />
    </>
  )
}
