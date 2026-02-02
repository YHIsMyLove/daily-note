/**
 * 通用模态弹窗选择器
 * 支持分类和标签的选择、搜索、创建、颜色选择和删除
 */
'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Search, Check, MoreVertical, Trash2 } from 'lucide-react'
import { categoriesApi, tagsApi } from '@/lib/api'
import { Category, Tag } from '@daily-note/shared'
import { getColorName, getCategoryColorStyle } from '@/lib/colors'
import { ColorPicker, hexToHsl } from './ui/color-picker'
import { toast } from 'sonner'

type SelectorMode = 'category' | 'tag'

interface ItemSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: SelectorMode
  // 分类模式：单选，返回选中的分类名
  // 标签模式：多选，返回选中的标签名数组
  value?: string | string[]
  onChange: (value: string | string[]) => void
}

export function ItemSelectorDialog({
  open,
  onOpenChange,
  mode,
  value,
  onChange,
}: ItemSelectorDialogProps) {
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

  // 处理颜色变更
  const handleColorChange = async (item: Category | Tag, color: string) => {
    const hslColor = hexToHsl(color)
    try {
      const api = mode === 'category' ? categoriesApi : tagsApi
      const response = await api.update(item.id, { color: hslColor })
      if (response.success) {
        // 重新加载数据
        if (mode === 'category') {
          await loadCategories()
        } else {
          await loadTags()
        }
        toast.success('颜色已更新')
      }
    } catch (error) {
      console.error('Failed to update color:', error)
      toast.error('颜色更新失败')
    }
  }

  // 处理删除
  const handleDelete = async (item: Category | Tag) => {
    const count = item.count ?? 0
    if (count > 0) {
      toast.error(`无法删除：还有 ${count} 个关联的笔记`)
      return
    }

    const confirm = window.confirm(
      `确定要删除"${item.name}"吗？此操作不可撤销。`
    )
    if (!confirm) return

    try {
      const api = mode === 'category' ? categoriesApi : tagsApi
      const response = await api.delete(item.id)
      if (response.success) {
        // 重新加载数据
        if (mode === 'category') {
          await loadCategories()
        } else {
          await loadTags()
        }
        toast.success('删除成功')
      }
    } catch (error: any) {
      console.error('Failed to delete:', error)
      const errorMessage = error?.error || '删除失败'
      toast.error(errorMessage)
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
        // 分类需要创建
        try {
          const response = await categoriesApi.create(trimmed)
          if (response.success && response.data) {
            // 重新加载分类列表
            await loadCategories()
            // 选中新创建的分类
            handleSelect(response.data.name)
          }
        } catch (error: any) {
          console.error('Failed to create category:', error)
          toast.error(error?.error || '创建失败')
        }
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

  // 获取颜色样式
  const getItemStyle = (item: Category | Tag): React.CSSProperties => {
    if (item.color) {
      // 使用自定义颜色
      return {
        backgroundColor: `hsl(${item.color} / 0.15)`,
        color: `hsl(${item.color} / 0.9)`,
        borderColor: `hsl(${item.color} / 0.25)`,
      }
    }
    // 回退到哈希计算的颜色
    return getCategoryColorStyle(item.name)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col max-h-[70vh]">
          {/* 搜索框 */}
          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="搜索或输入新名称..."
                className="pl-9"
              />
            </div>
          </div>

          {/* 列表区域 */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {mode === 'category' && categoriesLoading && (
              <div className="text-center py-8 text-text-muted">加载中...</div>
            )}
            {mode === 'tag' && tagsLoading && (
              <div className="text-center py-8 text-text-muted">加载中...</div>
            )}

            {!categoriesLoading && !tagsLoading && filteredItems.length === 0 && searchQuery && (
              <div
                className="text-center py-4 px-3 rounded-lg border border-dashed border-border bg-card text-text-muted cursor-pointer hover:text-text-primary hover:border-primary/50 transition-colors"
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
                const itemName = item.name
                const count = item.count ?? 0
                const selected = isSelected(itemName)
                const itemId = item.id

                return (
                  <div
                    key={itemId}
                    className={`
                      flex items-center justify-between p-3 rounded-lg border cursor-pointer
                      transition-all hover:bg-background-hover
                      ${selected ? 'border-primary bg-primary/15' : 'border-border'}
                    `}
                  >
                    {/* 左侧：颜色选择器 + 名称 */}
                    <div
                      className="flex items-center gap-2 flex-1 cursor-pointer"
                      onClick={() => handleSelect(itemName)}
                    >
                      {selected && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                      <ColorPicker
                        value={item.color}
                        onChange={(color) => handleColorChange(item, color)}
                        size="sm"
                      />
                      <Badge
                        variant={selected ? 'default' : 'outline'}
                        className="cursor-pointer"
                        style={!selected ? getItemStyle(item) : undefined}
                      >
                        {itemName}
                      </Badge>
                    </div>

                    {/* 右侧：数量 + 操作菜单 */}
                    <div className="flex items-center gap-2">
                      {count > 0 && (
                        <span className="text-xs text-text-muted">
                          {count}
                        </span>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button className="p-1 hover:bg-primary/10 rounded transition-colors">
                            <MoreVertical className="h-4 w-4 text-text-muted" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(item)
                            }}
                            className={count > 0 ? 'text-text-muted cursor-not-allowed' : 'text-destructive focus:text-destructive'}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
