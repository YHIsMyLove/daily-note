'use client'

/**
 * 心情曲线图表组件
 * 使用 recharts 展示情绪变化趋势
 */
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { SentimentDataPoint } from '@daily-note/shared'

interface SentimentCurveChartProps {
  data: SentimentDataPoint[]
}

export function SentimentCurveChart({ data }: SentimentCurveChartProps) {
  /**
   * 格式化日期显示
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  /**
   * 自定义 Tooltip
   */
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-popover border rounded-md shadow-lg p-3">
          <p className="text-sm font-medium">{formatDate(data.date)}</p>
          <div className="space-y-1 mt-2">
            <p className="text-sm text-green-500">
              积极: {data.positive}
            </p>
            <p className="text-sm text-gray-500">
              中性: {data.neutral}
            </p>
            <p className="text-sm text-red-500">
              消极: {data.negative}
            </p>
            <p className="text-sm font-medium border-t pt-1 mt-1">
              平均: {data.average.toFixed(2)}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        暂无数据
      </div>
    )
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Area
            type="monotone"
            dataKey="positive"
            stackId="1"
            stroke="#22c55e"
            fillOpacity={1}
            fill="url(#colorPositive)"
            name="积极"
          />
          <Area
            type="monotone"
            dataKey="neutral"
            stackId="1"
            stroke="#6b7280"
            fill="#6b7280"
            fillOpacity={0.3}
            name="中性"
          />
          <Area
            type="monotone"
            dataKey="negative"
            stackId="1"
            stroke="#ef4444"
            fillOpacity={1}
            fill="url(#colorNegative)"
            name="消极"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* 平均情绪曲线 */}
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis stroke="#6b7280" fontSize={12} domain={[-1, 1]} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="average"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 3 }}
              name="平均情绪"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
