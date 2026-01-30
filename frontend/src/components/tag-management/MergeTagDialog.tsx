/**
 * 合并标签对话框
 * 用于将一个标签合并到另一个标签
 */
'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Loader2, AlertTriangle, Search, Check } from 'lucide-react'
import { tagsApi } from '@/lib/api'
import { getCategoryColorStyle } from '@/lib/colors'
import { Tag } from '@daily-note/shared'

interface MergeTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceTagId: string
  sourceTagName: string
  onMergeSuccess: () => void
}

export function MergeTagDialog({
  open,
  onOpenChange,
  sourceTagId,
  sourceTagName,
  onMergeSuccess,
}: MergeTagDialogProps) {
  const [selectedTargetTag, setSelectedTargetTag] = useState<Tag | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载标签列表
  useEffect(() => {
    if (open) {
      loadTags()
    }
  }, [open])

  const loadTags = async () => {
    setTagsLoading(true)
    try {
      const response = await tagsApi.list()
      if (response.success && response.data) {
        // 过滤掉源标签
        setTags(response.data.filter((tag) => tag.id !== sourceTagId))
      }
    } catch (err) {
      console.error('Failed to load tags:', err)
    } finally {
      setTagsLoading(false)
    }
  }

  // 重置状态当对话框打开时
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSelectedTargetTag(null)
      setSearchQuery('')
      setError(null)
    }
    onOpenChange(newOpen)
  }

  // 处理合并操作
  const handleMerge = async () => {
    if (!selectedTargetTag) {
      setError('请选择目标标签')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await tagsApi.merge(sourceTagId, selectedTargetTag.id)

      if (response.success && response.data) {
        // 合并成功
        onMergeSuccess()
        onOpenChange(false)
      } else {
        // API 返回错误
        setError(response.message || '合并失败，请稍后重试')
      }
    } catch (err) {
      // 网络或其他错误
      setError(err instanceof Error ? err.message : '合并失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理搜索框按键
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredTags.length === 1) {
      // 如果只有一个匹配，自动选中
      setSelectedTargetTag(filteredTags[0])
      setSearchQuery('')
    }
  }

  // 过滤标签
  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>合并标签</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 源标签显示 */}
          <div className="space-y-2">
            <span className="text-sm font-medium">要合并的标签</span>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Badge
                variant="outline"
                style={getCategoryColorStyle(sourceTagName)}
              >
                #{sourceTagName}
              </Badge>
              <span className="text-sm text-text-muted">将被合并到下方选择的标签</span>
            </div>
          </div>

          {/* 目标标签选择 */}
          <div className="space-y-2">
            <label htmlFor="target-tag-search" className="text-sm font-medium">
              目标标签
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                id="target-tag-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="搜索目标标签..."
                className="pl-9"
                disabled={isSubmitting}
              />
            </div>

            {/* 已选中的目标标签 */}
            {selectedTargetTag && (
              <div className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/30 rounded-md">
                <Check className="h-4 w-4 text-primary" />
                <Badge
                  variant="default"
                  style={getCategoryColorStyle(selectedTargetTag.name)}
                >
                  #{selectedTargetTag.name}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 px-2 text-xs"
                  onClick={() => {
                    setSelectedTargetTag(null)
                    setSearchQuery('')
                  }}
                  disabled={isSubmitting}
                >
                  更改
                </Button>
              </div>
            )}

            {/* 标签列表 */}
            {!selectedTargetTag && (
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-md">
                {tagsLoading ? (
                  <div className="text-center py-8 text-text-muted text-sm">
                    加载中...
                  </div>
                ) : filteredTags.length === 0 ? (
                  <div className="text-center py-8 text-text-muted text-sm">
                    {searchQuery ? '没有找到匹配的标签' : '没有可用的标签'}
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredTags.map((tag) => (
                      <div
                        key={tag.id}
                        onClick={() => {
                          setSelectedTargetTag(tag)
                          setSearchQuery('')
                        }}
                        className="flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-primary/5 transition-colors"
                      >
                        <Badge
                          variant="outline"
                          className="cursor-pointer"
                          style={getCategoryColorStyle(tag.name)}
                        >
                          #{tag.name}
                        </Badge>
                        {tag.count !== undefined && tag.count > 0 && (
                          <span className="text-xs text-text-muted">
                            {tag.count} 个笔记
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 警告信息 */}
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1">此操作不可撤销</p>
              <p>合并后，源标签将被删除，所有使用源标签的笔记将自动更新为目标标签。</p>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleMerge}
            disabled={isSubmitting || !selectedTargetTag}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                合并中...
              </>
            ) : (
              '确认合并'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
