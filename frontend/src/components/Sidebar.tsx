/**
 * 侧边栏组件
 * 包含日期导航、分类筛选、标签云、搜索框
 * 支持作为抽屉在移动端显示
 */
'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet'
import { ActivityCalendar } from './ActivityCalendar'
import { Search, Calendar, Tag, Filter, X, History, ChevronRight } from 'lucide-react'
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
  onShowSummaryHistory?: () => void
  // 移动端抽屉模式
  open?: boolean
  onOpenChange?: (open: boolean) => void
  // 桌面端折叠状态
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
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
  onShowSummaryHistory,
  collapsed,
  onCollapsedChange,
  open,
  onOpenChange,
}: SidebarProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 当侧边栏打开时，自动聚焦到搜索框（仅在移动端）
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [open])

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

  // 侧边栏内容组件
  const sidebarContent = (
    <div className="h-full flex flex-col bg-background-secondary border-r border-border">
      {/* 搜索框 */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <label htmlFor="sidebar-search" className="sr-only">搜索笔记</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" aria-hidden="true" />
          <Input
            ref={searchInputRef}
            id="sidebar-search"
            value={localSearch}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索笔记..."
            className="pl-10 pr-10 bg-background border-border transition-all duration-200 focus:ring-2 focus:ring-ring"
            aria-label="搜索笔记"
            aria-describedby="search-description"
          />
          <span id="search-description" className="sr-only">
            输入关键词搜索笔记内容
          </span>
          {localSearch && (
            <button
              onClick={clearFilters}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-sm text-text-muted hover:text-text-primary hover:bg-background-secondary transition-all duration-200 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="清除搜索"
              tabIndex={0}
              type="button"
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
          className="w-full justify-start transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={onShowSummaryHistory}
          aria-label="查看总结历史"
        >
          <History className="h-4 w-4 mr-2" aria-hidden="true" />
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
          <div className="space-y-1" role="radiogroup" aria-label="分类筛选">
            <button
              onClick={() => onCategoryChange?.(undefined)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200 flex items-center justify-between focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:shadow-sm',
                !selectedCategory
                  ? 'bg-primary/20 text-primary shadow-sm'
                  : 'text-text-secondary hover:bg-background-elevated'
              )}
              aria-pressed={!selectedCategory}
              aria-label="全部分类"
              tabIndex={0}
              type="button"
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
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200 flex items-center justify-between focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:shadow-sm',
                  selectedCategory === category.name
                    ? 'bg-primary/20 text-primary shadow-sm'
                    : 'text-text-secondary hover:bg-background-elevated'
                )}
                aria-pressed={selectedCategory === category.name}
                aria-label={`分类: ${category.name} (${category.count})`}
                tabIndex={0}
                type="button"
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
            <div className="flex flex-wrap gap-2" role="list" aria-label="标签列表">
              {tags.slice(0, 10).map((tag) => {
                const isSelected = selectedTags?.includes(tag.name)
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? 'default' : 'secondary'}
                    className={cn(
                      'cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 relative pr-8 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isSelected && 'ring-2 ring-primary ring-offset-2 shadow-sm'
                    )}
                    onClick={() => selectTag(tag.name)}
                    role="listitem"
                    aria-pressed={isSelected}
                    aria-label={`标签: ${tag.name}${tag.count !== undefined ? ` (${tag.count})` : ''}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        selectTag(tag.name)
                      }
                    }}
                  >
                    {tag.name}
                    {tag.count !== undefined && (
                      <span className="ml-1 opacity-70" aria-label={`${tag.count} 个笔记`}>{tag.count}</span>
                    )}
                    {/* 选中时显示的 X 按钮 */}
                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onTagsChange?.(selectedTags!.filter(t => t !== tag.name))
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 rounded-sm flex items-center justify-center hover:bg-primary/80 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:scale-110"
                        aria-label={`取消选择 ${tag.name}`}
                        tabIndex={-1}
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

  // 如果提供了 open 和 onOpenChange，则使用 Sheet 包装（移动端抽屉模式）
  if (open !== undefined && onOpenChange) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle>筛选和导航</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-73px)] overflow-hidden">
            {sidebarContent}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // 桌面端折叠模式
  if (collapsed && onCollapsedChange) {
    return (
      <div
        className="h-full flex flex-col bg-background-secondary border-r border-border items-center py-4 transition-all duration-300 ease-in-out"
        role="region"
        aria-label="折叠的侧边栏"
      >
        <button
          onClick={() => onCollapsedChange(false)}
          className="p-2 rounded-md hover:bg-background-elevated transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:scale-110 active:scale-95"
          aria-label="展开侧边栏"
          aria-expanded="false"
          tabIndex={0}
          type="button"
        >
          <ChevronRight className="h-5 w-5 text-text-muted transition-transform duration-200 hover:scale-110" />
        </button>
      </div>
    )
  }

  // 否则直接渲染（桌面侧边栏展开模式）
  return sidebarContent
}
