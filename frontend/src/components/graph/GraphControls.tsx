/**
 * 图谱控制组件
 * 包含分类筛选、标签筛选、日期范围、布局选项
 */
'use client'

import { useState } from 'react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Filter, Calendar, Tag, X, LayoutGrid, RefreshCw, Download } from 'lucide-react'
import { Category, Tag as TagType, GraphFilters } from '@daily-note/shared'
import { cn } from '@/lib/utils'

type GraphLayout = 'force' | 'circular' | 'hierarchical'

interface GraphControlsProps {
  categories: Category[]
  tags: TagType[]
  filters: GraphFilters
  onFiltersChange: (filters: GraphFilters) => void
  onLayoutChange: (layout: GraphLayout) => void
  onRefresh?: () => void
  onExport?: (format: 'png' | 'svg') => void
  isLoading?: boolean
}

export function GraphControls({
  categories,
  tags,
  filters,
  onFiltersChange,
  onLayoutChange,
  onRefresh,
  onExport,
  isLoading = false,
}: GraphControlsProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(filters.categories || [])
  const [selectedTags, setSelectedTags] = useState<string[]>(filters.tags || [])
  const [dateFrom, setDateFrom] = useState(filters.dateFrom || '')
  const [dateTo, setDateTo] = useState(filters.dateTo || '')
  const [layout, setLayout] = useState<GraphLayout>('force')

  /**
   * 切换分类选择
   */
  const toggleCategory = (categoryName: string) => {
    const isSelected = selectedCategories.includes(categoryName)
    const newCategories = isSelected
      ? selectedCategories.filter(c => c !== categoryName)
      : [...selectedCategories, categoryName]

    setSelectedCategories(newCategories)
    onFiltersChange({ ...filters, categories: newCategories.length > 0 ? newCategories : undefined })
  }

  /**
   * 切换标签选择
   */
  const toggleTag = (tagName: string) => {
    const isSelected = selectedTags.includes(tagName)
    const newTags = isSelected
      ? selectedTags.filter(t => t !== tagName)
      : [...selectedTags, tagName]

    setSelectedTags(newTags)
    onFiltersChange({ ...filters, tags: newTags.length > 0 ? newTags : undefined })
  }

  /**
   * 清空所有筛选
   */
  const clearFilters = () => {
    setSelectedCategories([])
    setSelectedTags([])
    setDateFrom('')
    setDateTo('')
    onFiltersChange({})
  }

  /**
   * 更新日期范围
   */
  const updateDateFrom = (value: string) => {
    setDateFrom(value)
    onFiltersChange({
      ...filters,
      dateFrom: value || undefined,
    })
  }

  const updateDateTo = (value: string) => {
    setDateTo(value)
    onFiltersChange({
      ...filters,
      dateTo: value || undefined,
    })
  }

  /**
   * 切换布局
   */
  const handleLayoutChange = (newLayout: GraphLayout) => {
    setLayout(newLayout)
    onLayoutChange(newLayout)
  }

  /**
   * 导出图谱
   */
  const handleExport = (format: 'png' | 'svg') => {
    if (onExport) {
      onExport(format)
    }
  }

  /**
   * 检查是否有激活的筛选
   */
  const hasFilters = selectedCategories.length > 0 || selectedTags.length > 0 || dateFrom || dateTo

  /**
   * 获取布局选项配置
   */
  const layoutOptions: { value: GraphLayout; label: string; icon: string }[] = [
    { value: 'force', label: '力导向', icon: '⚡' },
    { value: 'circular', label: '环形', icon: '⭕' },
    { value: 'hierarchical', label: '层次', icon: '📊' },
  ]

  return (
    <div className="bg-background-secondary border-b border-border p-4 space-y-4">
      {/* 顶部：布局切换和刷新 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-medium">布局</span>
          <div className="flex gap-1 ml-2">
            {layoutOptions.map((option) => (
              <Button
                key={option.value}
                variant={layout === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleLayoutChange(option.value)}
                className="h-8 px-3 text-xs"
              >
                <span className="mr-1">{option.icon}</span>
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
              <X className="h-3 w-3 mr-1" />
              清除筛选
            </Button>
          )}
          {onExport && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('png')}
                disabled={isLoading}
                className="h-8"
                title="导出为 PNG 图片"
              >
                <Download className="h-3 w-3 mr-1" />
                PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('svg')}
                disabled={isLoading}
                className="h-8"
                title="导出为 SVG 矢量图"
              >
                <Download className="h-3 w-3 mr-1" />
                SVG
              </Button>
            </>
          )}
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8"
            >
              <RefreshCw className={cn('h-3 w-3 mr-1', isLoading && 'animate-spin')} />
              刷新
            </Button>
          )}
        </div>
      </div>

      {/* 分类筛选 */}
      {categories.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-4 w-4 text-text-muted" />
            <span className="text-sm font-medium">分类</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 8).map((category) => {
              const isSelected = selectedCategories.includes(category.name)
              return (
                <Badge
                  key={category.name}
                  variant={isSelected ? 'default' : 'secondary'}
                  className={cn(
                    'cursor-pointer hover:opacity-80 transition-opacity',
                    isSelected && 'ring-2 ring-primary ring-offset-2'
                  )}
                  onClick={() => toggleCategory(category.name)}
                >
                  {category.name}
                  <span className="ml-1 opacity-70">({category.count})</span>
                </Badge>
              )
            })}
          </div>
        </div>
      )}

      {/* 标签筛选 */}
      {tags.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Tag className="h-4 w-4 text-text-muted" />
            <span className="text-sm font-medium">标签</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 12).map((tag) => {
              const isSelected = selectedTags.includes(tag.name)
              return (
                <Badge
                  key={tag.id}
                  variant={isSelected ? 'default' : 'secondary'}
                  className={cn(
                    'cursor-pointer hover:opacity-80 transition-opacity',
                    isSelected && 'ring-2 ring-primary ring-offset-2'
                  )}
                  onClick={() => toggleTag(tag.name)}
                >
                  {tag.name}
                  {tag.count !== undefined && (
                    <span className="ml-1 opacity-70">({tag.count})</span>
                  )}
                </Badge>
              )
            })}
          </div>
        </div>
      )}

      {/* 日期范围筛选 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-medium">日期范围</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => updateDateFrom(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <span className="text-text-muted text-sm">至</span>
          <div className="flex-1">
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => updateDateTo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 筛选状态提示 */}
      {hasFilters && (
        <div className="flex items-center gap-2 text-xs text-text-muted bg-background-elevated p-2 rounded-md">
          <Filter className="h-3 w-3" />
          <span>
            已应用 {selectedCategories.length + selectedTags.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)} 个筛选条件
          </span>
        </div>
      )}
    </div>
  )
}
