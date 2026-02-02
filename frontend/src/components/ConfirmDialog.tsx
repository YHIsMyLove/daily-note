/**
 * 确认对话框组件
 * 可复用的确认对话框，支持自定义标题、描述和按钮文字
 */
'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'

interface ConfirmDialogOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

const resolveRef = { current: null as ((value: boolean) => void) | null }

/**
 * 触发确认对话框
 * @returns Promise<boolean> - 用户选择结果
 */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    resolveRef.current = resolve
    // 触发自定义事件
    window.dispatchEvent(
      new CustomEvent('open-confirm-dialog', {
        detail: options,
      })
    )
  })
}

/**
 * 确认对话框提供者组件
 * 应在应用的根组件中渲染
 */
export function ConfirmDialogProvider() {
  const [open, setOpen] = React.useState(false)
  const [options, setOptions] = React.useState<ConfirmDialogOptions>({
    title: '确认',
    description: '',
    confirmText: '确认',
    cancelText: '取消',
    variant: 'default',
  })

  React.useEffect(() => {
    const handleOpenDialog = (e: CustomEvent<ConfirmDialogOptions>) => {
      setOptions({
        title: e.detail.title,
        description: e.detail.description,
        confirmText: e.detail.confirmText || '确认',
        cancelText: e.detail.cancelText || '取消',
        variant: e.detail.variant || 'default',
      })
      setOpen(true)
    }

    // 添加事件监听
    window.addEventListener('open-confirm-dialog', handleOpenDialog as EventListener)

    return () => {
      window.removeEventListener('open-confirm-dialog', handleOpenDialog as EventListener)
    }
  }, [])

  const handleConfirm = () => {
    setOpen(false)
    resolveRef.current?.(true)
  }

  const handleCancel = () => {
    setOpen(false)
    resolveRef.current?.(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resolveRef.current?.(false)
    }
    setOpen(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          <DialogDescription>{options.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {options.cancelText}
          </Button>
          <Button variant={options.variant} onClick={handleConfirm}>
            {options.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
