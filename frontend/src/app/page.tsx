/**
 * Daily Note 主页面
 */
'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { NoteEditor } from '@/components/NoteEditor'
import { NoteList } from '@/components/NoteList'
import { Sidebar } from '@/components/Sidebar'
import { ConfirmDialogProvider, confirmDialog } from '@/components/ConfirmDialog'
import { FilterActiveIndicator } from '@/components/FilterActiveIndicator'
import { RightPanelView } from '@/components/RightPanelTabBar'
import { RightPanelContent } from '@/components/RightPanelContent'
import { NoteBlock, Category, Tag, SummaryAnalyzerPayload, DateRangeInput } from '@daily-note/shared'
import { notesApi, categoriesApi, tagsApi, tasksApi, summariesApi } from '@/lib/api'
import { RefreshCw, Wifi, WifiOff, Activity, Sparkles, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSSE } from '@/hooks/useSSE'
import { toISOLocalDate } from '@/lib/utils'

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

  // 计算是否有激活的过滤器
  const hasFilters = Boolean(
    selectedCategory ||
    selectedTags.length > 0 ||
    selectedDate ||
    searchQuery
  )

  // 清除所有过滤器
  const handleClearFilters = () => {
    setSelectedCategory(undefined)
    setSelectedTags([])
    setSelectedDate(null)
    setSearchQuery('')
  }

  // 右侧面板视图状态
  const [rightPanelView, setRightPanelView] = useState<RightPanelView>('todos')
  const [selectedNoteId, setSelectedNoteId] = useState<string>()
  const [selectedSummaryTaskId, setSelectedSummaryTaskId] = useState<string | null>(null)

  // 处理打开关联笔记（从笔记卡片点击关联图标）
  const handleOpenRelatedNotes = (noteId: string) => {
    setSelectedNoteId(noteId)
    setRightPanelView('related-notes')
  }

  // 处理总结分析，返回 taskId 用于切换到总结结果视图
  const handleSummaryAnalyze = async (
    payload: SummaryAnalyzerPayload
  ): Promise<{ taskId: string } | null> => {
    try {
      const response = await summariesApi.create(payload)
      if (response.data?.taskId) {
        return response.data
      }
      return null
    } catch (error) {
      console.error('Failed to create summary:', error)
      alert('创建总结失败，请稍后重试')
      return null
    }
  }

  // 切换到总结结果视图
  const handleSwitchToSummaryResult = (taskId: string) => {
    setSelectedSummaryTaskId(taskId)
    setRightPanelView('summary-result')
  }

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

  /**
   * 加载数据 - 使用统一的筛选 API
   */
  const loadData = async () => {
    try {
      setLoading(true)

      // 构建时间范围参数
      let dateRange: DateRangeInput | undefined
      if (selectedDate) {
        dateRange = {
          mode: 'day',
          value: toISOLocalDate(selectedDate),
        }
      }

      // 加载笔记列表 - 使用 searchWithFilters 统一处理
      const notesResponse = await notesApi.searchWithFilters(
        '', // 无搜索关键字
        {
          dateRange,
          category: selectedCategory,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
        }
      )

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

  /**
   * 搜索笔记 - 使用统一的筛选 API
   * @param query 搜索关键字（非空）
   */
  const searchNotes = async (query: string) => {
    try {
      setLoading(true)

      // 构建时间范围参数
      let dateRange: DateRangeInput | undefined
      if (selectedDate) {
        dateRange = {
          mode: 'day',
          value: toISOLocalDate(selectedDate),
        }
      }

      // 使用 searchWithFilters 进行搜索 + 筛选
      const response = await notesApi.searchWithFilters(query, {
        dateRange,
        category: selectedCategory,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      })

      setNotes(response.data?.notes || [])
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

  // 监听筛选条件变化（分类、标签、日期）
  useEffect(() => {
    // 如果有搜索词，由搜索的 useEffect 处理
    if (searchQuery) return
    loadData()
  }, [selectedCategory, selectedTags, selectedDate])

  // 监听搜索查询变化
  useEffect(() => {
    // 如果没有搜索词，由上面的 useEffect 处理
    if (!searchQuery.trim()) {
      loadData()
      return
    }

    const timer = setTimeout(() => {
      searchNotes(searchQuery)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery, selectedCategory, selectedTags, selectedDate])

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
          {/* 过滤器激活指示器 */}
          <FilterActiveIndicator
            hasFilters={hasFilters}
            onClear={handleClearFilters}
          />
        </div>
        <div className="flex items-center gap-2">
          {/* 任务状态按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRightPanelView('tasks')}
            className="gap-2"
          >
            <Activity className="h-4 w-4" />
            任务状态
            {badgeCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
                {badgeCount > 99 ? '99+' : badgeCount}
              </Badge>
            )}
          </Button>

          {/* 智能分析按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRightPanelView('summary')}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            智能分析
          </Button>

          {/* 设置按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRightPanelView('settings')}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            设置
          </Button>

          {/* 刷新按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
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
            onCategoryChange={setSelectedCategory}
            onTagsChange={setSelectedTags}
            onDateSelect={setSelectedDate}
            onSearchChange={setSearchQuery}
          />
        </aside>

        {/* 右侧主内容区 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧内容区：输入框 + 笔记列表 */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-border">
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

            {/* 笔记列表 */}
            <div className="flex-1 overflow-hidden p-4">
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
                  handleOpenRelatedNotes(note.id)
                }}
              />
            </div>
          </div>

          {/* 右侧标签页面板 */}
          <aside className="w-[28rem] min-w-0 bg-background-secondary overflow-hidden flex flex-col border-l border-border">
            <RightPanelContent
              activeView={rightPanelView}
              selectedNoteId={selectedNoteId}
              selectedSummaryTaskId={selectedSummaryTaskId}
              onOpenRelatedNotes={handleOpenRelatedNotes}
              onBack={() => setRightPanelView('todos')}
              onSummaryAnalyze={handleSummaryAnalyze}
              onSwitchToSummaryResult={handleSwitchToSummaryResult}
            />
          </aside>
        </div>
      </div>

      {/* 确认对话框提供者 */}
      <ConfirmDialogProvider />
    </div>
  )
}
