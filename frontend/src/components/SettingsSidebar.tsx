'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { FileText, Sliders, Sparkles } from 'lucide-react'
import { PromptListPanel } from './prompts/PromptListPanel'

interface SettingsSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsSidebar({ open, onOpenChange }: SettingsSidebarProps) {
  const [promptListKey, setPromptListKey] = useState(0)

  // AI 自动完成设置
  const [aiAutoCompletionEnabled, setAiAutoCompletionEnabled] = useState(true)
  const [aiAutoCompletionByDefault, setAiAutoCompletionByDefault] = useState(false)

  // 从 localStorage 加载设置
  useEffect(() => {
    const savedEnabled = localStorage.getItem('aiAutoCompletionEnabled')
    const savedByDefault = localStorage.getItem('aiAutoCompletionByDefault')

    if (savedEnabled !== null) {
      setAiAutoCompletionEnabled(JSON.parse(savedEnabled))
    }
    if (savedByDefault !== null) {
      setAiAutoCompletionByDefault(JSON.parse(savedByDefault))
    }
  }, [])

  const handleClose = () => {
    onOpenChange(false)
    // 重新加载提示词列表
    setPromptListKey((prev) => prev + 1)
  }

  // 保存 AI 自动完成总开关
  const handleAiAutoCompletionChange = (checked: boolean) => {
    setAiAutoCompletionEnabled(checked)
    localStorage.setItem('aiAutoCompletionEnabled', JSON.stringify(checked))
  }

  // 保存新任务默认启用 AI 自动完成
  const handleAiAutoCompletionByDefaultChange = (checked: boolean) => {
    setAiAutoCompletionByDefault(checked)
    localStorage.setItem('aiAutoCompletionByDefault', JSON.stringify(checked))
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

          {/* AI 自动化设置 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI 自动化设置
            </h3>
            <div className="space-y-4 p-4 bg-background-secondary rounded-lg">
              {/* AI 自动完成总开关 */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="ai-auto-completion-enabled" className="text-sm font-medium">
                    启用 AI 自动完成
                  </Label>
                  <p className="text-xs text-text-muted mt-1">
                    允许 AI 分析并自动完成符合条件的任务
                  </p>
                </div>
                <Switch
                  id="ai-auto-completion-enabled"
                  checked={aiAutoCompletionEnabled}
                  onCheckedChange={handleAiAutoCompletionChange}
                />
              </div>

              {/* 新任务默认启用 AI 自动完成 */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="ai-auto-completion-default" className="text-sm font-medium">
                    新任务默认启用
                  </Label>
                  <p className="text-xs text-text-muted mt-1">
                    新创建的任务默认开启 AI 自动完成功能
                  </p>
                </div>
                <Switch
                  id="ai-auto-completion-default"
                  checked={aiAutoCompletionByDefault}
                  onCheckedChange={handleAiAutoCompletionByDefaultChange}
                  disabled={!aiAutoCompletionEnabled}
                />
              </div>
            </div>
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
