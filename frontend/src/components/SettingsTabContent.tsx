'use client'

import { useState } from 'react'
import { FileText, Sliders } from 'lucide-react'
import { PromptListPanel } from './prompts/PromptListPanel'

/**
 * 设置标签页内容
 * 复用 SettingsSidebar 的逻辑，移除 Sheet 包装
 */
export function SettingsTabContent() {
  const [promptListKey, setPromptListKey] = useState(0)

  const handleClose = () => {
    // 重新加载提示词列表
    setPromptListKey((prev) => prev + 1)
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">设置</h2>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 提示词管理 */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            提示词管理
          </h3>
          <PromptListPanel key={promptListKey} onClose={handleClose} />
        </div>

        {/* 其他设置项（预留） */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium flex items-center gap-2">
            <Sliders className="h-3.5 w-3.5" />
            其他设置
          </h3>
          <div className="text-xs text-text-muted p-3 bg-background-secondary rounded-lg">
            敬请期待...
          </div>
        </div>
      </div>
    </div>
  )
}
