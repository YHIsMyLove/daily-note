'use client'

/**
 * 智能总结下拉菜单组件
 * 支持按日/周/月/年生成分析报告
 */
import { useState } from 'react'
import { Sparkles, Calendar, CalendarDays, CalendarRange } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { SummaryAnalyzerPayload } from '@daily-note/shared'
import { toISOLocalDate } from '@/lib/utils'

interface SummaryMenuProps {
  onAnalyze: (payload: SummaryAnalyzerPayload) => void
  disabled?: boolean
}

export function SummaryMenu({ onAnalyze, disabled = false }: SummaryMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  /**
   * 获取日期范围（根据模式）
   */
  const getDateRange = (mode: 'day' | 'week' | 'month' | 'year'): { startDate: string; endDate: string } => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (mode) {
      case 'day':
        return {
          startDate: toISOLocalDate(today),
          endDate: toISOLocalDate(today),
        }
      case 'week':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay()) // 周日为起点
        return {
          startDate: toISOLocalDate(weekStart),
          endDate: toISOLocalDate(today),
        }
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        return {
          startDate: toISOLocalDate(monthStart),
          endDate: toISOLocalDate(today),
        }
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1)
        return {
          startDate: toISOLocalDate(yearStart),
          endDate: toISOLocalDate(today),
        }
    }
  }

  /**
   * 处理分析请求
   */
  const handleAnalyze = (mode: 'day' | 'week' | 'month' | 'year') => {
    const dateRange = getDateRange(mode)

    const payload: SummaryAnalyzerPayload = {
      timeRange: {
        mode,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
      filters: {}, // 默认无筛选
    }

    onAnalyze(payload)
    setIsOpen(false)
  }

  /**
   * 格式化日期范围显示
   */
  const formatDateRange = (mode: 'day' | 'week' | 'month' | 'year'): string => {
    const { startDate, endDate } = getDateRange(mode)

    if (mode === 'day') {
      return startDate
    }

    if (startDate === endDate) {
      return startDate
    }

    return `${startDate} ~ ${endDate}`
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Sparkles className="mr-2 h-4 w-4" />
          智能总结
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          快速总结
        </div>

        <DropdownMenuItem onClick={() => handleAnalyze('day')}>
          <Calendar className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-medium">今日总结</span>
            <span className="text-xs text-muted-foreground">{formatDateRange('day')}</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAnalyze('week')}>
          <CalendarDays className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-medium">本周总结</span>
            <span className="text-xs text-muted-foreground">{formatDateRange('week')}</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAnalyze('month')}>
          <CalendarRange className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-medium">本月总结</span>
            <span className="text-xs text-muted-foreground">{formatDateRange('month')}</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAnalyze('year')}>
          <Sparkles className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-medium">年度总结</span>
            <span className="text-xs text-muted-foreground">{formatDateRange('year')}</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          基于已有总结生成
        </div>

        <DropdownMenuItem
          onClick={() => handleAnalyze('week')}
          disabled={false}
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-medium">周总结（智能）</span>
            <span className="text-xs text-muted-foreground">优先使用日总结</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleAnalyze('month')}
          disabled={false}
        >
          <CalendarRange className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-medium">月总结（智能）</span>
            <span className="text-xs text-muted-foreground">优先使用周总结</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
