/**
 * 通用侧边弹窗选择器
 * 支持分类和标签的选择、搜索和创建
 */
'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './ui/sheet'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Search, Check } from 'lucide-react'
import { categoriesApi, tagsApi } from '@/lib/api'
import { Category, Tag } from '@daily-note/shared'
import { getColorName, getCategoryColorStyle } from '@/lib/colors'

type SelectorMode = 'category' | 'tag'

interface ItemSelectorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: SelectorMode
  // 分类模式：单选，返回选中的分类名
  // 标签模式：多选，返回选中的标签名数组
  value?: string | string[]
  onChange: (value: string | string[]) => void
}

export function ItemSelectorSheet({
  open,
  onOpenChange,
  mode,
  value,
  onChange,
}: ItemSelectorSheetProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // 分类数据
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)

  // 标签数据
  const [tags, setTags] = useState<Tag[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)

  // 加载数据
  useEffect(() => {
    if (open) {
      if (mode === 'category') {
        loadCategories()
      } else {
        loadTags()
      }
    }
  }, [open, mode])

  const loadCategories = async () => {
    setCategoriesLoading(true)
    try {
      const response = await categoriesApi.list()
      if (response.success && response.data) {
        setCategories(response.data)
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    } finally {
      setCategoriesLoading(false)
    }
  }

  const loadTags = async () => {
    setTagsLoading(true)
    try {
      const response = await tagsApi.list()
      if (response.success && response.data) {
        setTags(response.data)
      }
    } catch (error) {
      console.error('Failed to load tags:', error)
    } finally {
      setTagsLoading(false)
    }
  }

  // 过滤项
  const filteredItems = (mode === 'category'
    ? categories.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : tags.filter((t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase())
    )) as Array<Category | Tag>

  // 处理选择
  const handleSelect = (itemName: string) => {
    if (mode === 'category') {
      // 单选模式
      onChange(itemName)
      onOpenChange(false)
    } else {
      // 多选模式（标签）
      const currentTags = Array.isArray(value) ? value : []
      if (currentTags.includes(itemName)) {
        // 取消选中
        onChange(currentTags.filter((t) => t !== itemName))
      } else {
        // 添加选中
        onChange([...currentTags, itemName])
      }
    }
  }

  // 检查是否选中
  const isSelected = (itemName: string): boolean => {
    if (mode === 'category') {
      return value === itemName
    } else {
      return Array.isArray(value) && value.includes(itemName)
    }
  }

  // 处理创建新项
  const handleCreate = async (name?: string) => {
    const trimmed = (name || searchQuery).trim()
    if (!trimmed) return

    // 检查是否已存在
    const exists = mode === 'category'
      ? categories.some((c) => c.name === trimmed)
      : tags.some((t) => t.name === trimmed)

    if (exists) {
      // 已存在则直接选中
      handleSelect(trimmed)
    } else {
      if (mode === 'tag') {
        // 标签需要创建
        try {
          const response = await tagsApi.create(trimmed)
          if (response.success && response.data) {
            // 重新加载标签列表
            await loadTags()
            // 选中新创建的标签
            handleSelect(response.data.name)
          }
        } catch (error) {
          console.error('Failed to create tag:', error)
        }
      } else {
        // 分类是字符串字段，直接选中
        handleSelect(trimmed)
      }
    }

    setSearchQuery('')
  }

  // 获取标题
  const getTitle = () => {
    return mode === 'category' ? '选择分类' : '选择标签'
  }

  // 处理搜索框按键，支持直接创建
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const trimmed = searchQuery.trim()

      // 检查是否有精确匹配
      const exactMatch = filteredItems.some(
        item => item.name.toLowerCase() === trimmed.toLowerCase()
      )

      if (exactMatch) {
        // 有匹配则选中
        handleSelect(trimmed)
      } else {
        // 无匹配则创建
        handleCreate()
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{getTitle()}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full py-4">
          {/* 搜索框 */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="搜索或输入新名称..."
              className="pl-9"
            />
          </div>

          {/* 列表区域 */}
          <div className="flex-1 overflow-y-auto">
            {mode === 'category' && categoriesLoading && (
              <div className="text-center py-8 text-text-muted">加载中...</div>
            )}
            {mode === 'tag' && tagsLoading && (
              <div className="text-center py-8 text-text-muted">加载中...</div>
            )}

            {!categoriesLoading && !tagsLoading && filteredItems.length === 0 && searchQuery && (
              <div
                className="text-center py-4 px-3 mx-2 rounded-lg border border-dashed border-border text-text-muted cursor-pointer hover:text-text-primary hover:border-primary/50 transition-colors"
                onClick={() => handleCreate()}
              >
                "{searchQuery}" 不存在，按 Enter 或点击创建
              </div>
            )}

            {!categoriesLoading && !tagsLoading && filteredItems.length === 0 && !searchQuery && (
              <div className="text-center py-8 text-text-muted">
                暂无{mode === 'category' ? '分类' : '标签'}
              </div>
            )}

            <div className="space-y-2">
              {filteredItems.map((item) => {
                const itemName = (item as Category | Tag).name
                const count = (item as Category | Tag).count ?? 0
                const selected = isSelected(itemName)
                const categoryStyle = getCategoryColorStyle(itemName)

                return (
                  <div
                    key={itemName}
                    onClick={() => handleSelect(itemName)}
                    className={`
                      flex items-center justify-between p-3 rounded-lg border cursor-pointer
                      transition-all hover:bg-primary/5
                      ${selected ? 'border-primary bg-primary/10' : 'border-border'}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      {selected && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                      <Badge
                        variant={selected ? 'default' : 'outline'}
                        className="cursor-pointer"
                        style={!selected ? categoryStyle : undefined}
                        onMouseEnter={(e) => {
                          if (!selected) {
                            const colorName = getColorName(itemName)
                            e.currentTarget.style.backgroundColor = `hsl(var(--category-${colorName}) / 0.3)`
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!selected) {
                            e.currentTarget.style.backgroundColor = `hsl(var(--category-${getColorName(itemName)}) / 0.15)`
                          }
                        }}
                      >
                        {itemName}
                      </Badge>
                    </div>
                    {count > 0 && (
                      <span className="text-xs text-text-muted">
                        {count}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
