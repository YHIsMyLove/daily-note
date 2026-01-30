'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FileText, Sliders } from 'lucide-react'
import { PromptListPanel } from './prompts/PromptListPanel'

interface SettingsSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsSidebar({ open, onOpenChange }: SettingsSidebarProps) {
  const [promptListKey, setPromptListKey] = useState(0)

  const handleClose = () => {
    onOpenChange(false)
    // 重新加载提示词列表
    setPromptListKey((prev) => prev + 1)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-96 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>设置</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* 提示词管理 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              提示词管理
            </h3>
            <PromptListPanel key={promptListKey} onClose={handleClose} />
          </div>

          {/* 其他设置项（预留） */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              其他设置
            </h3>
            <div className="text-sm text-text-muted p-4 bg-background-secondary rounded-lg">
              敬请期待...
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
