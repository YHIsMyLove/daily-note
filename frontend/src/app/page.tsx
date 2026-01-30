/**
 * Daily Note 主页面
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { NoteEditor } from '@/components/NoteEditor'
import { NoteList } from '@/components/NoteList'
import { Sidebar } from '@/components/Sidebar'
import { ConfirmDialogProvider, confirmDialog } from '@/components/ConfirmDialog'
import { SettingsSidebar } from '@/components/SettingsSidebar'
import { SummaryMenu } from '@/components/SummaryMenu'
import { SummaryResultSheet } from '@/components/SummaryResultSheet'
import { SummaryHistory } from '@/components/SummaryHistory'
import { KnowledgeGraph } from '@/components/KnowledgeGraph'
import { NoteBlock, Category, Tag, ClaudeTask, SummaryAnalyzerPayload, SortField, SortOrder } from '@daily-note/shared'
import { notesApi, categoriesApi, tagsApi, statsApi, tasksApi, summariesApi } from '@/lib/api'
import { RefreshCw, ListChecks, Wifi, WifiOff, Settings, History, Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TaskStatusSheet } from '@/components/TaskStatusSheet'
import { RelatedNotesSheet } from '@/components/RelatedNotesSheet'
import { useSSE } from '@/hooks/useSSE'

export default function HomePage() {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState<NoteBlock[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // 筛选状态
  const [selectedCategory, setSelectedCategory] = useState<string>()
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // 排序状态
  const [orderBy, setOrderBy] = useState<SortField>(() => {
    // 从 localStorage 读取保存的排序字段
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('daily-note-order-by')
      return (saved === 'date' || saved === 'createdAt' || saved === 'updatedAt' || saved === 'importance' || saved === 'category' || saved === 'sentiment') ? saved : 'updatedAt'
    }
    return 'updatedAt'
  })
  const [order, setOrder] = useState<SortOrder>(() => {
    // 从 localStorage 读取保存的排序方向
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('daily-note-order')
      return (saved === 'asc' || saved === 'desc') ? saved : 'desc'
    }
    return 'desc'
  })

  // 保存排序状态到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('daily-note-order-by', orderBy)
    }
  }, [orderBy])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('daily-note-order', order)
    }
  }, [order])

  // 任务状态面板
  const [taskSheetOpen, setTaskSheetOpen] = useState(false)

  // 关联笔记面板
  const [relatedNotesSheetOpen, setRelatedNotesSheetOpen] = useState(false)
  const [selectedNoteId, setSelectedNoteId] = useState<string>()

  // 设置侧边栏
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 总结分析面板
  const [summarySheetOpen, setSummarySheetOpen] = useState(false)
  const [currentSummaryTaskId, setCurrentSummaryTaskId] = useState<string | null>(null)

  // 总结历史面板
  const [summaryHistorySheetOpen, setSummaryHistorySheetOpen] = useState(false)

  // 视图模式：list 或 graph
  const [viewMode, setViewMode] = useState<'list' | 'graph'>(() => {
    // 从 localStorage 读取保存的视图模式
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('daily-note-view-mode')
      return (saved === 'graph' || saved === 'list') ? saved : 'list'
    }
    return 'list'
  })

  // 保存视图模式到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('daily-note-view-mode', viewMode)
    }
  }, [viewMode])

  // SSE 连接
  const { connectionState, isConnected } = useSSE('http://localhost:3001/api/sse', {
    onTaskCompleted: () => {
      // 任务完成时刷新笔记列表
      loadData()
    },
  })

  // 获取任务统计（通过 SSE 实时更新，无需轮询）
  const { data: statsResponse } = useQuery({
    queryKey: ['tasks-stats'],
    queryFn: () => tasksApi.stats(),
    // 移除 refetchInterval，由 SSE 驱动更新
    refetchOnWindowFocus: false,
  })

  // 计算角标数量（运行中 + 待处理）
  const badgeCount = (statsResponse?.data?.running || 0) + (statsResponse?.data?.pending || 0)

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true)

      // 准备查询参数
      const params: {
        category?: string
        tags?: string[]  // 改为数组
        date?: Date
        pageSize: number
        dateFilterMode?: 'createdAt' | 'updatedAt' | 'both'
        orderBy?: SortField
        order?: SortOrder
      } = {
        pageSize: 100,
        dateFilterMode: 'both',  // 默认匹配创建和更新时间
        orderBy,
        order,
      }

      if (selectedCategory) {
        params.category = selectedCategory
      }

      if (selectedTags.length > 0) {
        params.tags = selectedTags
      }

      if (selectedDate) {
        params.date = selectedDate
      }

      // 加载笔记列表
      const notesResponse = await notesApi.list(params)

      setNotes(notesResponse.data?.notes || [])

      // 加载分类和标签
      const [categoriesResponse, tagsResponse] = await Promise.all([
        categoriesApi.list(),
        tagsApi.list(),
      ])

      setCategories(categoriesResponse.data ?? [])
      setTags(tagsResponse.data ?? [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 搜索笔记
  const searchNotes = async (query: string) => {
    if (!query.trim()) {
      loadData()
      return
    }

    try {
      setLoading(true)
      const response = await notesApi.search(query)
      setNotes(response.data ?? [])
    } catch (error) {
      console.error('Failed to search notes:', error)
    } finally {
      setLoading(false)
    }
  }

  // 创建笔记
  const handleCreateNote = async (data: { content: string; category?: string; tags?: string[]; importance?: number }) => {
    try {
      setSubmitting(true)
      await notesApi.create(data.content, undefined, {
        category: data.category,
        tags: data.tags,
        importance: data.importance,
      })

      // 立即刷新任务统计
      queryClient.invalidateQueries({ queryKey: ['tasks-stats'] })
      await loadData()
    } catch (error) {
      console.error('Failed to create note:', error)
      // 显示详细错误信息
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.error || error.message
        : error instanceof Error
          ? error.message
          : '未知错误'
      alert(`创建笔记失败: ${errorMessage}`)
    } finally {
      setSubmitting(false)
    }
  }

  // 分析笔记
  const handleAnalyzeNote = async (noteId: string) => {
    try {
      await notesApi.analyze(noteId)

      // 立即刷新任务统计
      queryClient.invalidateQueries({ queryKey: ['tasks-stats'] })
      await loadData()
    } catch (error) {
      console.error('Failed to analyze note:', error)
      alert('分析失败，请稍后重试')
    }
  }

  // 任务刷新回调
  const handleRefreshTasks = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks-stats'] })
  }

  // 处理总结分析
  const handleSummaryAnalyze = async (payload: SummaryAnalyzerPayload) => {
    try {
      const response = await summariesApi.create(payload)
      if (response.data?.taskId) {
        setCurrentSummaryTaskId(response.data.taskId)
        setSummarySheetOpen(true)
      }
    } catch (error) {
      console.error('Failed to create summary:', error)
      alert('创建总结失败，请稍后重试')
    }
  }

  // 删除笔记
  const handleDeleteNote = async (note: NoteBlock) => {
    const confirmed = await confirmDialog({
      title: '确认删除',
      description: '将笔记移至回收站，可在回收站中恢复。',
      confirmText: '删除',
      cancelText: '取消',
      variant: 'destructive',
    })

    if (confirmed) {
      try {
        await notesApi.delete(note.id)
        await loadData()
      } catch (error) {
        console.error('Failed to delete note:', error)
        alert('删除失败，请稍后重试')
      }
    }
  }

  // 初始加载
  useEffect(() => {
    loadData()
  }, [])

  // 监听筛选条件变化
  useEffect(() => {
    if (searchQuery) {
      searchNotes(searchQuery)
    } else {
      loadData()
    }
  }, [selectedCategory, selectedTags, selectedDate, orderBy, order])

  // 监听搜索查询变化
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchNotes(searchQuery)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 顶部标题栏 */}
      <header className="h-14 border-b border-border bg-background-secondary flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-primary">Daily Note</h1>
          <span className="text-sm text-text-muted">零碎笔记自动整理系统</span>
          {/* SSE 连接状态指示器 */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
              isConnected
                ? 'bg-green-500/10 text-green-600'
                : 'bg-red-500/10 text-red-600'
            }`}
            title={`SSE 连接状态: ${connectionState}`}
          >
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span>{isConnected ? '实时同步' : '已断开'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SummaryMenu
            onAnalyze={handleSummaryAnalyze}
            disabled={loading}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'list' ? 'graph' : 'list')}
            disabled={loading}
          >
            {viewMode === 'list' ? (
              <>
                <Network className="h-4 w-4 mr-2" />
                图谱视图
              </>
            ) : (
              <>
                <ListChecks className="h-4 w-4 mr-2" />
                列表视图
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSummaryHistorySheetOpen(true)}
            disabled={loading}
          >
            <History className="h-4 w-4 mr-2" />
            历史记录
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTaskSheetOpen(true)}
            className="relative"
          >
            <ListChecks className="h-4 w-4 mr-2" />
            任务状态
            {badgeCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-red-500 hover:bg-red-600">
                {badgeCount > 99 ? '99+' : badgeCount}
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            设置
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside className="w-64 flex-shrink-0">
          <Sidebar
            categories={categories}
            tags={tags}
            selectedCategory={selectedCategory}
            selectedTags={selectedTags}
            selectedDate={selectedDate}
            searchQuery={searchQuery}
            orderBy={orderBy}
            order={order}
            onCategoryChange={setSelectedCategory}
            onTagsChange={setSelectedTags}
            onDateSelect={setSelectedDate}
            onSearchChange={setSearchQuery}
            onOrderByChange={setOrderBy}
            onOrderChange={setOrder}
            onShowSummaryHistory={() => setSummaryHistorySheetOpen(true)}
          />
        </aside>

        {/* 笔记列表区 */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* 快速输入区 */}
          <div className="p-4 border-b border-border">
            <NoteEditor
              mode="create"
              onSubmit={handleCreateNote}
              disabled={submitting}
              loading={submitting}
              placeholder="今天有什么想记录的？..."
              showCategory={true}
              showTags={true}
              showImportance={true}
            />
          </div>

          {/* 笔记列表 / 图谱视图 */}
          <div className="flex-1 overflow-hidden p-4">
            {viewMode === 'list' ? (
              <NoteList
                notes={notes}
                loading={loading}
                emptyMessage={searchQuery ? '未找到匹配的笔记' : '暂无笔记，开始记录吧！'}
                onNoteClick={(note) => {
                  // 点击卡片不做任何操作，可以在此添加其他行为
                }}
                onNoteAnalyze={handleAnalyzeNote}
                onNoteDelete={handleDeleteNote}
                onUpdateSuccess={loadData}
                onTaskRefresh={handleRefreshTasks}
                onRelatedNotesClick={(note) => {
                  // 点击关联图标时打开关联笔记面板
                  setSelectedNoteId(note.id)
                  setRelatedNotesSheetOpen(true)
                }}
              />
            ) : (
              <KnowledgeGraph
                filters={{
                  categories: selectedCategory ? [selectedCategory] : undefined,
                  tags: selectedTags.length > 0 ? selectedTags : undefined,
                  dateFrom: selectedDate ? selectedDate.toISOString().split('T')[0] : undefined,
                  dateTo: selectedDate ? selectedDate.toISOString().split('T')[0] : undefined,
                }}
                className="h-full"
              />
            )}
          </div>
        </main>
      </div>

      {/* 任务状态面板 */}
      <TaskStatusSheet open={taskSheetOpen} onOpenChange={setTaskSheetOpen} />

      {/* 关联笔记面板 */}
      {selectedNoteId && (
        <RelatedNotesSheet
          open={relatedNotesSheetOpen}
          onOpenChange={setRelatedNotesSheetOpen}
          noteId={selectedNoteId}
        />
      )}

      {/* 总结分析结果面板 */}
      <SummaryResultSheet
        open={summarySheetOpen}
        onOpenChange={setSummarySheetOpen}
        taskId={currentSummaryTaskId}
      />

      {/* 总结历史面板 */}
      <SummaryHistory
        open={summaryHistorySheetOpen}
        onOpenChange={setSummaryHistorySheetOpen}
      />

      {/* 确认对话框提供者 */}
      <ConfirmDialogProvider />

      {/* 设置侧边栏 */}
      <SettingsSidebar open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
