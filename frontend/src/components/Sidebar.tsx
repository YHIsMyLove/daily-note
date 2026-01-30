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
import { Search, Calendar, Tag, Filter, X, History, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Category, Tag as TagType, SortField, SortOrder } from '@daily-note/shared'
import { cn } from '@/lib/utils'

interface SidebarProps {
  categories: Category[]
  tags: TagType[]
  selectedCategory?: string
  selectedTags?: string[]  // 改为数组
  selectedDate?: Date | null
  searchQuery?: string
  orderBy?: SortField
  order?: SortOrder
  onCategoryChange?: (category: string | undefined) => void
  onTagsChange?: (tags: string[]) => void  // 更新回调签名
  onDateSelect?: (date: Date | null) => void
  onSearchChange?: (query: string) => void
  onOrderByChange?: (field: SortField) => void
  onOrderChange?: (order: SortOrder) => void
  onShowSummaryHistory?: () => void
}

export function Sidebar({
  categories,
  tags,
  selectedCategory,
  selectedTags,  // 解构多选状态
  selectedDate,
  searchQuery = '',
  orderBy = 'updatedAt',
  order = 'desc',
  onCategoryChange,
  onTagsChange,  // 解构新的回调
  onDateSelect,
  onSearchChange,
  onOrderByChange,
  onOrderChange,
  onShowSummaryHistory,
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

      {/* 总结历史按钮 */}
      <div className="p-4 border-b border-border">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onShowSummaryHistory}
        >
          <History className="h-4 w-4 mr-2" />
          总结历史
        </Button>
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

        {/* 排序选项 */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpDown className="h-4 w-4 text-text-muted" />
            <h3 className="font-medium text-sm">排序</h3>
          </div>

          {/* 排序字段选择 */}
          <div className="space-y-2">
            <p className="text-xs text-text-muted mb-2">按字段排序</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={orderBy === 'date' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onOrderByChange?.('date')}
                className="text-xs"
              >
                日期
              </Button>
              <Button
                variant={orderBy === 'createdAt' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onOrderByChange?.('createdAt')}
                className="text-xs"
              >
                创建时间
              </Button>
              <Button
                variant={orderBy === 'updatedAt' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onOrderByChange?.('updatedAt')}
                className="text-xs"
              >
                更新时间
              </Button>
              <Button
                variant={orderBy === 'importance' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onOrderByChange?.('importance')}
                className="text-xs"
              >
                重要性
              </Button>
              <Button
                variant={orderBy === 'category' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onOrderByChange?.('category')}
                className="text-xs"
              >
                分类
              </Button>
              <Button
                variant={orderBy === 'sentiment' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onOrderByChange?.('sentiment')}
                className="text-xs"
              >
                情感
              </Button>
            </div>

            {/* 排序方向切换 */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <span className="text-xs text-text-muted">排序方向</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOrderChange?.(order === 'asc' ? 'desc' : 'asc')}
                className="text-xs"
              >
                {order === 'asc' ? (
                  <>
                    <ArrowUp className="h-3 w-3 mr-1" />
                    升序
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-3 w-3 mr-1" />
                    降序
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
