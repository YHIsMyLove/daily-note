/**
 * 分类选择器组件
 * 简化版：显示当前选中 + 部分列表，点击打开侧边弹窗
 */
'use client'

import { useState, useEffect } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Plus, ChevronRight } from 'lucide-react'
import { ItemSelectorSheet } from '../ItemSelectorSheet'
import { categoriesApi } from '@/lib/api'
import { Category } from '@daily-note/shared'

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
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSheetOpen(true)}
          className={`h-7 px-2 text-xs ${
            value
              ? getColorForName(value)
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          {value || '选择分类'}
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>

        <ItemSelectorSheet
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
            const colorClass = getColorForName(category.name)

            return (
              <Badge
                key={category.name}
                variant={isSelected ? 'default' : 'outline'}
                className={`cursor-pointer transition-all ${!isSelected ? colorClass : ''}`}
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

      <ItemSelectorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode="category"
        value={value}
        onChange={(v) => onChange(typeof v === 'string' ? v : v[0] || '')}
      />
    </>
  )
}
