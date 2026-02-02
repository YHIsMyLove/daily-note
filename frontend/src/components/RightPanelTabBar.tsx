'use client'

import { ListChecks, FileText, Link, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 右侧面板视图类型
 * 包含所有可能的右侧面板视图
 */
export type RightPanelView =
  | 'todos'
  | 'tasks'
  | 'summary'
  | 'settings'
  | 'related-notes'
  | 'summary-result'

/**
 * 右侧面板标签页类型（仅供 TabBar 使用）
 * 任务状态、智能总结、历史记录已移至顶部按钮区
 */
export type RightPanelTab =
  | 'todos'
  | 'summary-result'
  | 'related-notes'
  | 'settings'

/**
 * 标签页配置
 */
interface TabConfig {
  key: RightPanelTab
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TABS: TabConfig[] = [
  { key: 'todos', label: '待办事项', icon: ListChecks },
  { key: 'summary-result', label: '总结结果', icon: FileText },
  { key: 'related-notes', label: '关联笔记', icon: Link },
  { key: 'settings', label: '设置', icon: Settings },
]

interface RightPanelTabBarProps {
  activeTab: RightPanelTab
  onTabChange: (tab: RightPanelTab) => void
  summaryResultCount?: number
}

export function RightPanelTabBar({
  activeTab,
  onTabChange,
  summaryResultCount = 0,
}: RightPanelTabBarProps) {
  return (
    <div className="flex items-center border-b border-border bg-background-secondary overflow-x-auto">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.key

        // 总结结果标签显示结果数量角标
        const showSummaryBadge = tab.key === 'summary-result' && summaryResultCount > 0

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap',
              isActive
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
            {showSummaryBadge && (
              <span className="ml-1 min-w-5 h-5 flex items-center justify-center px-1 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                {summaryResultCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
