/**
 * 侧边栏组件
 * 包含日期导航、分类筛选、标签云、搜索框
 */
'use client'

import { useState } from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { ActivityCalendar } from './ActivityCalendar'
import { Search, Tag, Filter, X } from 'lucide-react'
import { Category, Tag as TagType } from '@daily-note/shared'
import { cn } from '@/lib/utils'

interface SidebarProps {
  categories: Category[]
  tags: TagType[]
  selectedCategory?: string
  selectedTags?: string[]  // 改为数组
  selectedDate?: Date | null
  searchQuery?: string
  onCategoryChange?: (category: string | undefined) => void
  onTagsChange?: (tags: string[]) => void  // 更新回调签名
  onDateSelect?: (date: Date | null) => void
  onSearchChange?: (query: string) => void
}

export function Sidebar({
  categories,
  tags,
  selectedCategory,
  selectedTags,  // 解构多选状态
  selectedDate,
  searchQuery = '',
  onCategoryChange,
  onTagsChange,  // 解构新的回调
  onDateSelect,
  onSearchChange,
}: SidebarProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)

  const handleSearch = (value: string) => {
    setLocalSearch(value)
    onSearchChange?.(value)
  }

  const selectTag = (tagName: string) => {
    // 多选逻辑：已选中则移除，未选中则添加
    const isSelected = selectedTags?.includes(tagName)
    if (isSelected) {
      onTagsChange?.(selectedTags!.filter(t => t !== tagName))
    } else {
      onTagsChange?.([...(selectedTags || []), tagName])
    }
  }

  const clearFilters = () => {
    onCategoryChange?.(undefined)
    onTagsChange?.([])  // 清空标签数组
    onDateSelect?.(null)
    setLocalSearch('')
    onSearchChange?.('')
  }

  const hasFilters = selectedCategory || (selectedTags && selectedTags.length > 0) || localSearch || selectedDate

  return (
    <div className="h-full flex flex-col bg-background-secondary border-r border-border">
      {/* 搜索框 */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            value={localSearch}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索笔记..."
            className="pl-10 pr-10 bg-background border-border"
          />
          {localSearch && (
            <button
              onClick={clearFilters}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-sm text-text-muted hover:text-text-primary hover:bg-background-secondary transition-colors duration-150 flex items-center justify-center"
              aria-label="清除搜索"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* 活跃度日历 */}
      <ActivityCalendar onDateSelect={onDateSelect} selectedDate={selectedDate} />

      <ScrollArea className="flex-1">
        {/* 分类筛选 */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-text-muted" />
              <h3 className="font-medium text-sm">分类</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className={cn(
                "h-7 text-xs",
                hasFilters ? "visible" : "invisible"
              )}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => onCategoryChange?.(undefined)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between',
                !selectedCategory
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-secondary hover:bg-background-elevated'
              )}
            >
              <span>全部</span>
              <span className="text-xs text-text-muted">
                {categories.reduce((sum, c) => sum + c.count, 0)}
              </span>
            </button>
            {categories.slice(0, 5).map((category) => (
              <button
                key={category.name}
                onClick={() => onCategoryChange?.(category.name)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between',
                  selectedCategory === category.name
                    ? 'bg-primary/20 text-primary'
                    : 'text-text-secondary hover:bg-background-elevated'
                )}
              >
                <span>{category.name}</span>
                <span className="text-xs text-text-muted">{category.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 标签云 */}
        {tags.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-text-muted" />
                <h3 className="font-medium text-sm">标签</h3>
              </div>
              {selectedTags && selectedTags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onTagsChange?.([])}
                  className="h-7 text-xs"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 10).map((tag) => {
                const isSelected = selectedTags?.includes(tag.name)
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? 'default' : 'secondary'}
                    className={cn(
                      'cursor-pointer hover:opacity-80 transition-opacity relative pr-8',
                      isSelected && 'ring-2 ring-primary ring-offset-2'
                    )}
                    onClick={() => selectTag(tag.name)}
                  >
                    {tag.name}
                    {tag.count !== undefined && (
                      <span className="ml-1 opacity-70">{tag.count}</span>
                    )}
                    {/* 选中时显示的 X 按钮 */}
                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onTagsChange?.(selectedTags!.filter(t => t !== tag.name))
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 rounded-sm flex items-center justify-center hover:bg-primary/80 transition-colors"
                        aria-label={`取消选择 ${tag.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                )
              })}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
