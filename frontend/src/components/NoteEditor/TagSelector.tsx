/**
 * 标签选择器组件
 * 显示已选标签列表，点击可移除，支持多选
 * 支持标签重命名和合并操作
 */
'use client'

import { useState, useEffect } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Plus, ChevronRight, X, Edit3, Merge } from 'lucide-react'
import { ItemSelectorSheet } from '../ItemSelectorSheet'
import { RenameTagDialog } from '../tag-management/RenameTagDialog'
import { MergeTagDialog } from '../tag-management/MergeTagDialog'
import { getColorName, getCategoryColorStyle } from '@/lib/colors'
import { tagsApi } from '@/lib/api'
import { Tag } from '@daily-note/shared'

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
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)

  // 重命名对话框状态
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [selectedTagForRename, setSelectedTagForRename] = useState<Tag | null>(null)

  // 合并对话框状态
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [selectedTagForMerge, setSelectedTagForMerge] = useState<Tag | null>(null)

  // 加载所有标签以获取 ID
  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    setTagsLoading(true)
    try {
      const response = await tagsApi.list()
      if (response.success && response.data) {
        setAllTags(response.data)
      }
    } catch (err) {
      console.error('Failed to load tags:', err)
    } finally {
      setTagsLoading(false)
    }
  }

  // 根据标签名称获取标签对象
  const getTagByName = (tagName: string): Tag | undefined => {
    return allTags.find((tag) => tag.name === tagName)
  }

  const handleRemoveTag = (tagName: string) => {
    onChange(value.filter((t) => t !== tagName))
  }

  // 处理重命名操作
  const handleRenameClick = (tagName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const tag = getTagByName(tagName)
    if (tag) {
      setSelectedTagForRename(tag)
      setRenameDialogOpen(true)
    }
  }

  const handleRenameSuccess = () => {
    // 重新加载标签列表
    loadTags()
    // 对话框会自动关闭
  }

  // 处理合并操作
  const handleMergeClick = (tagName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const tag = getTagByName(tagName)
    if (tag) {
      setSelectedTagForMerge(tag)
      setMergeDialogOpen(true)
    }
  }

  const handleMergeSuccess = () => {
    // 重新加载标签列表
    loadTags()
    // 更新当前选中的标签列表（如果源标签被删除了）
    const updatedValue = value.filter((tagName) => {
      const tag = getTagByName(tagName)
      // 保留仍然存在的标签
      return tag !== undefined
    })
    if (updatedValue.length !== value.length) {
      onChange(updatedValue)
    }
  }

  // 需要显示的标签
  const visibleTags = value.slice(0, maxDisplay)
  const remainingCount = Math.max(0, value.length - maxDisplay)

  // 渲染标签徽章（包含重命名和合并按钮）
  const renderTagBadge = (tagName: string, isCompact: boolean) => {
    const categoryStyle = getCategoryColorStyle(tagName)
    const badgeClassName = isCompact
      ? 'group h-7 px-2 text-xs'
      : 'group cursor-pointer'

    return (
      <Badge
        key={tagName}
        variant="outline"
        className={badgeClassName}
        style={categoryStyle}
        onMouseEnter={(e) => {
          const colorName = getColorName(tagName)
          e.currentTarget.style.backgroundColor = `hsl(var(--category-${colorName}) / 0.3)`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = `hsl(var(--category-${getColorName(tagName)}) / 0.15)`
        }}
        onClick={() => handleRemoveTag(tagName)}
      >
        <span className="flex items-center gap-1">
          #{tagName}
        </span>

        {/* 操作按钮组 - 仅在悬停时显示 */}
        <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* 重命名按钮 */}
          <Edit3
            className="h-3 w-3 cursor-pointer hover:text-primary"
            onClick={(e) => handleRenameClick(tagName, e)}
            title="重命名标签"
          />

          {/* 合并按钮 */}
          <Merge
            className="h-3 w-3 cursor-pointer hover:text-primary"
            onClick={(e) => handleMergeClick(tagName, e)}
            title="合并标签"
          />

          {/* 删除按钮 */}
          <X
            className="h-3 w-3 cursor-pointer hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              handleRemoveTag(tagName)
            }}
            title="移除标签"
          />
        </div>
      </Badge>
    )
  }

  // 紧凑模式
  if (compact) {
    return (
      <>
        <div className="flex items-center gap-1.5 flex-wrap">
          {visibleTags.map((tag) => renderTagBadge(tag, true))}

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

        {/* 重命名对话框 */}
        {selectedTagForRename && (
          <RenameTagDialog
            open={renameDialogOpen}
            onOpenChange={setRenameDialogOpen}
            tagId={selectedTagForRename.id}
            currentName={selectedTagForRename.name}
            onRenameSuccess={handleRenameSuccess}
          />
        )}

        {/* 合并对话框 */}
        {selectedTagForMerge && (
          <MergeTagDialog
            open={mergeDialogOpen}
            onOpenChange={setMergeDialogOpen}
            sourceTagId={selectedTagForMerge.id}
            sourceTagName={selectedTagForMerge.name}
            onMergeSuccess={handleMergeSuccess}
          />
        )}
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
            value.map((tag) => renderTagBadge(tag, false))
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

      {/* 重命名对话框 */}
      {selectedTagForRename && (
        <RenameTagDialog
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
          tagId={selectedTagForRename.id}
          currentName={selectedTagForRename.name}
          onRenameSuccess={handleRenameSuccess}
        />
      )}

      {/* 合并对话框 */}
      {selectedTagForMerge && (
        <MergeTagDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          sourceTagId={selectedTagForMerge.id}
          sourceTagName={selectedTagForMerge.name}
          onMergeSuccess={handleMergeSuccess}
        />
      )}
    </>
  )
}
