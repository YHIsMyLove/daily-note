/**
 * 重命名标签对话框
 * 用于重命名现有标签
 */
'use client'

import { useState } from 'react'
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
import { Loader2 } from 'lucide-react'
import { tagsApi } from '@/lib/api'
import { getCategoryColorStyle } from '@/lib/colors'

interface RenameTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tagId: string
  currentName: string
  onRenameSuccess: () => void
}

export function RenameTagDialog({
  open,
  onOpenChange,
  tagId,
  currentName,
  onRenameSuccess,
}: RenameTagDialogProps) {
  const [newName, setNewName] = useState(currentName)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 重置状态当对话框打开时
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setNewName(currentName)
      setError(null)
    }
    onOpenChange(newOpen)
  }

  // 处理重命名操作
  const handleRename = async () => {
    const trimmedName = newName.trim()

    // 验证输入
    if (!trimmedName) {
      setError('标签名称不能为空')
      return
    }

    if (trimmedName === currentName) {
      // 名称未改变，直接关闭
      onOpenChange(false)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await tagsApi.rename(tagId, trimmedName)

      if (response.success && response.data) {
        // 重命名成功
        onRenameSuccess()
        onOpenChange(false)
      } else {
        // API 返回错误
        setError(response.message || '重命名失败，请稍后重试')
      }
    } catch (err) {
      // 网络或其他错误
      setError(err instanceof Error ? err.message : '重命名失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRename()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>重命名标签</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 当前标签显示 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted">当前标签：</span>
            <Badge
              variant="outline"
              style={getCategoryColorStyle(currentName)}
            >
              #{currentName}
            </Badge>
          </div>

          {/* 新名称输入 */}
          <div className="space-y-2">
            <label htmlFor="new-tag-name" className="text-sm font-medium">
              新标签名称
            </label>
            <Input
              id="new-tag-name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                // 清除错误提示
                if (error) setError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder="输入新的标签名称..."
              disabled={isSubmitting}
              autoFocus
              className="w-full"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
              {error}
            </div>
          )}

          {/* 提示信息 */}
          <div className="text-xs text-text-muted bg-muted rounded-md p-3">
            重命名标签将更新所有使用此标签的笔记。此操作可以撤销。
          </div>
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
            onClick={handleRename}
            disabled={isSubmitting || !newName.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                重命名中...
              </>
            ) : (
              '确认重命名'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
