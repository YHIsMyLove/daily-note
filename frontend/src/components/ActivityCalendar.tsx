/**
 * 活跃度日历组件
 * 传统月视图日历样式
 */
'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ActivityData } from '@daily-note/shared'
import { statsApi } from '@/lib/api'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { isSameDay, formatLocalDate } from '@/utils/dateUtils'

interface ActivityCalendarProps {
  onDateSelect?: (date: Date | null) => void
  selectedDate?: Date | null
}

export function ActivityCalendar({
  onDateSelect,
  selectedDate,
}: ActivityCalendarProps) {
  // 状态管理
  const [currentDate, setCurrentDate] = useState(new Date())
  const [dailyData, setDailyData] = useState<ActivityData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 获取颜色级别
  const getActivityLevel = (count: number): number => {
    if (count === 0) return 0
    if (count <= 2) return 1
    if (count <= 5) return 2
    if (count <= 9) return 3
    return 4
  }

  // 获取颜色类名
  const getActivityColor = (level: number): string => {
    const colors = [
      'bg-[hsl(var(--activity-0))]',
      'bg-[hsl(var(--activity-1))]',
      'bg-[hsl(var(--activity-2))]',
      'bg-[hsl(var(--activity-3))]',
      'bg-[hsl(var(--activity-4))]',
    ]
    return colors[level]
  }

  // 获取月视图数据
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth() + 1

        const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
        const endDate = new Date(year, month, 0).toISOString().split('T')[0]

        const response = await statsApi.activity({
          mode: 'month',
          startDate,
          endDate,
        })

        if (response.success) {
          setDailyData(response.data ?? [])
        }
      } catch (error) {
        console.error('Failed to fetch activity data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentDate])

  // 导航函数
  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    // 如果当前选中的日期不是今天，则激活今天
    const selectedDateStr = selectedDate ? formatLocalDate(selectedDate) : null
    const todayStr = formatLocalDate(today)
    if (selectedDateStr !== todayStr) {
      onDateSelect?.(today)
    }
  }

  const goPrevMonth = () => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() - 1)
    const minDate = new Date(2020, 0, 1)
    if (newDate >= minDate) {
      setCurrentDate(newDate)
    }
  }

  const goNextMonth = () => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + 1)
    const now = new Date()
    if (newDate <= now) {
      setCurrentDate(newDate)
    }
  }

  const canGoPrevMonth = () => {
    const minDate = new Date(2020, 0, 1)
    return currentDate > minDate
  }

  const canGoNextMonth = () => {
    const nextMonth = new Date(currentDate)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    return nextMonth <= new Date()
  }

  // 通用方块组件
  const ActivitySquare = ({
    value,
    label,
    count,
    onClick,
    disabled = false,
    isActive = false,
  }: {
    value: string | number
    label: string
    count: number
    onClick?: () => void
    disabled?: boolean
    isActive?: boolean
  }) => {
    const level = getActivityLevel(count)

    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'w-7 h-7 rounded-md transition-all duration-150',
          getActivityColor(level),
          count > 0 && !disabled && 'hover:ring-1 hover:ring-white/50 hover:scale-105 cursor-pointer',
          count === 0 && 'opacity-40',
          disabled && 'cursor-not-allowed',
          isActive && 'ring-2 ring-primary ring-offset-2'
        )}
        title={`${label}: ${count} 条笔记`}
        aria-label={`${label}, ${count} 条笔记`}
        aria-pressed={isActive}
      />
    )
  }

  // 判断当前日期是否匹配 selectedDate
  const isDayActive = (dateStr: string): boolean => {
    if (!selectedDate) return false
    const cellDate = new Date(dateStr)
    return isSameDay(cellDate, selectedDate)
  }

  // 获取视图标题
  const getViewTitle = (): string => {
    return `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`
  }

  // 渲染月视图（传统日历样式）
  const renderMonthView = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // 获取该月第一天和最后一天
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // 获取第一天是周几（0-6，0是周日）
    const firstDayOfWeek = firstDay.getDay()

    // 创建日期映射
    const dailyMap = new Map<string, number>()
    dailyData.forEach((item) => {
      dailyMap.set(item.date, item.count)
    })

    // 生成日历格子（6行7列）
    const cells = []
    const totalDays = lastDay.getDate()

    // 填充月初空白
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ type: 'empty' })
    }

    // 填充日期
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day)
      const dateStr = date.toISOString().split('T')[0]
      const count = dailyMap.get(dateStr) || 0
      cells.push({ type: 'day', day, dateStr, count })
    }

    // 分组为周（每7天一行）
    const weeks = []
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7))
    }

    return (
      <div>
        {/* 星期标题 */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
            <div key={day} className="text-xs text-center text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* 日期格子 */}
        <div className="grid grid-rows-6 gap-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((cell, cellIndex) => {
                if (cell.type === 'empty') {
                  return <div key={cellIndex} />
                }

                const { day, dateStr, count } = cell

                return (
                  <ActivitySquare
                    key={dateStr!}
                    value={dateStr!}
                    label={`${day!}`}
                    count={count!}
                    onClick={() => count! > 0 && onDateSelect?.(new Date(dateStr!))}
                    disabled={count! === 0}
                    isActive={isDayActive(dateStr!)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">活跃度</h3>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-muted rounded"></div>
          <div className="h-8 bg-muted rounded"></div>
          <div className="h-8 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 border-b border-border">
      {/* 标题和导航 */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <button
          type="button"
          onClick={goPrevMonth}
          disabled={!canGoPrevMonth()}
          className={cn(
            'p-1 hover:bg-muted rounded transition-colors',
            !canGoPrevMonth() && 'opacity-30 cursor-not-allowed'
          )}
          title="上个月"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-sm font-medium min-w-[120px] text-center">
          {getViewTitle()}
        </span>

        <button
          type="button"
          onClick={goToToday}
          className="px-2 py-1 text-xs hover:bg-muted rounded transition-colors"
          title="回到今天"
        >
          今天
        </button>

        <button
          type="button"
          onClick={goNextMonth}
          disabled={!canGoNextMonth()}
          className={cn(
            'p-1 hover:bg-muted rounded transition-colors',
            !canGoNextMonth() && 'opacity-30 cursor-not-allowed'
          )}
          title="下个月"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 月视图 */}
      {renderMonthView()}
    </div>
  )
}
