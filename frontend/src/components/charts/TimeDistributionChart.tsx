'use client'

/**
 * 时间分布图表组件
 * 使用 recharts 展示小时级和星期分布
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { TimeDistribution } from '@daily-note/shared'

interface TimeDistributionChartProps {
  data: TimeDistribution
}

export function TimeDistributionChart({ data }: TimeDistributionChartProps) {
  /**
   * 获取最活跃时段的颜色
   */
  const getBarColor = (hour: number) => {
    if (data.mostActiveHours.includes(hour)) {
      return '#3b82f6' // 蓝色高亮
    }
    return '#e5e7eb' // 灰色默认
  }

  /**
   * 格式化小时显示
   */
  const formatHour = (hour: number) => {
    return `${hour}:00`
  }

  /**
   * 格式化星期显示
   */
  const formatWeekday = (weekday: number) => {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekdays[weekday]
  }

  /**
   * 自定义小时分布 Tooltip
   */
  const HourlyTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-popover border rounded-md shadow-lg p-3">
          <p className="text-sm font-medium">{formatHour(data.hour)}</p>
          <p className="text-sm">笔记数: <span className="font-medium">{data.count}</span></p>
          {data.mostActive && (
            <p className="text-xs text-blue-500 mt-1">最活跃时段</p>
          )}
        </div>
      )
    }
    return null
  }

  /**
   * 自定义星期分布 Tooltip
   */
  const WeekdayTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-popover border rounded-md shadow-lg p-3">
          <p className="text-sm font-medium">{formatWeekday(data.weekday)}</p>
          <p className="text-sm">笔记数: <span className="font-medium">{data.count}</span></p>
        </div>
      )
    }
    return null
  }

  /**
   * 为小时数据添加 mostActive 标记
   */
  const hourlyDataWithMarker = data.hourly.map((item) => ({
    ...item,
    mostActive: data.mostActiveHours.includes(item.hour),
  }))

  return (
    <div className="space-y-6">
      {/* 小时分布 */}
      <div>
        <h4 className="text-sm font-semibold mb-3">小时分布</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourlyDataWithMarker} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="hour"
              tickFormatter={formatHour}
              stroke="#6b7280"
              fontSize={11}
              interval={0}
            />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip content={<HourlyTooltip />} />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {data.hourly.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.hour)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {data.mostActiveHours.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            最活跃时段: {data.mostActiveHours.sort((a, b) => a - b).map(h => `${h}:00`).join(', ')}
          </p>
        )}
      </div>

      {/* 星期分布 */}
      <div>
        <h4 className="text-sm font-semibold mb-3">星期分布</h4>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.weekdayDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="weekday"
              tickFormatter={formatWeekday}
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip content={<WeekdayTooltip />} />
            <Bar dataKey="count" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
