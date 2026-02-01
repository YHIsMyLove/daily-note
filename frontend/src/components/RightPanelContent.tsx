'use client'

import { ArrowLeft } from 'lucide-react'
import { RightPanelView, RightPanelTab } from './RightPanelTabBar'
import { TodoList } from './TodoList'
import { TasksTabContent } from './TasksTabContent'
import { SummaryTabContent } from './SummaryTabContent'
import { SummaryResultTabContent } from './SummaryResultTabContent'
import { RelatedNotesTabContent } from './RelatedNotesTabContent'
import { SettingsTabContent } from './SettingsTabContent'
import { Button } from '@/components/ui/button'
import { SummaryAnalyzerPayload } from '@daily-note/shared'

interface RightPanelContentProps {
  activeView: RightPanelView
  selectedNoteId?: string
  selectedSummaryTaskId?: string | null
  onOpenRelatedNotes: (noteId: string) => void
  onBack?: () => void
  onSummaryAnalyze?: (payload: SummaryAnalyzerPayload) => Promise<{ taskId: string } | null>
  onSwitchToSummaryResult?: (taskId: string) => void
}

export function RightPanelContent({
  activeView,
  selectedNoteId,
  selectedSummaryTaskId,
  onOpenRelatedNotes,
  onBack,
  onSummaryAnalyze,
  onSwitchToSummaryResult,
}: RightPanelContentProps) {
  const renderContent = () => {
    switch (activeView) {
      case 'todos':
        return <TodoList />

      case 'tasks':
        return <TasksTabContent />

      case 'summary':
        return onSummaryAnalyze && onSwitchToSummaryResult ? (
          <SummaryTabContent
            onAnalyze={onSummaryAnalyze}
            onSwitchToResult={onSwitchToSummaryResult}
          />
        ) : null

      case 'summary-result':
        return <SummaryResultTabContent taskId={selectedSummaryTaskId} />

      case 'related-notes':
        return (
          <RelatedNotesTabContent
            selectedNoteId={selectedNoteId}
            onOpenRelatedNotes={onOpenRelatedNotes}
          />
        )

      case 'settings':
        return <SettingsTabContent />

      default:
        return <TodoList />
    }
  }

  // 是否显示返回按钮（非 todos 视图）
  const showBackButton = activeView !== 'todos' && onBack

  return (
    <div className="flex-1 overflow-hidden bg-background-secondary flex flex-col">
      {/* 返回按钮区域 */}
      {showBackButton && (
        <div className="flex items-center px-4 py-2 border-b border-border bg-background">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-7 gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </Button>
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  )
}
