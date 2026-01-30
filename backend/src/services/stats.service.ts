/**
 * 统计服务层
 * 负责处理活跃度数据的查询和聚合
 */
import { prisma } from '../database/prisma'
import { ActivityData, ActivityMode, MonthlyActivityData, HourlyActivityData } from '@daily-note/shared'

/**
 * 获取日期范围
 */
function getDateRange(mode: ActivityMode): { startDate: Date; endDate: Date } {
  const now = new Date()
  const endDate = new Date(now)
  endDate.setHours(23, 59, 59, 999)

  let startDate: Date

  switch (mode) {
    case 'year':
      // 最近 365 天
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 364)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'month':
      // 当月第一天
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'week':
      // 最近 7 天
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 6)
      startDate.setHours(0, 0, 0, 0)
      break
    default:
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 364)
      startDate.setHours(0, 0, 0, 0)
  }

  return { startDate, endDate }
}

/**
 * 获取活跃度数据
 */
export async function getActivityData(
  mode: ActivityMode = 'year',
  startDate?: string,
  endDate?: string
): Promise<ActivityData[]> {
  let dateRange: { startDate: Date; endDate: Date }

  // 如果提供了自定义日期范围,使用自定义范围
  if (startDate && endDate) {
    dateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    }
    // 确保结束日期包含当天的完整时间
    dateRange.endDate.setHours(23, 59, 59, 999)
  } else {
    dateRange = getDateRange(mode)
  }

  // 查询指定日期范围内的笔记，同时获取 id、createdAt 和 updatedAt
  const notes = await prisma.note.findMany({
    where: {
      OR: [
        { createdAt: { gte: dateRange.startDate, lte: dateRange.endDate } },
        { updatedAt: { gte: dateRange.startDate, lte: dateRange.endDate } }
      ],
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  // 使用 Map<dateString, Set<noteId>> 确保去重
  const dailyNoteIds = new Map<string, Set<string>>()

  notes.forEach((note) => {
    const createdDate = note.createdAt.toISOString().split('T')[0]
    const updatedDate = note.updatedAt.toISOString().split('T')[0]

    // 在创建日期添加笔记ID
    if (!dailyNoteIds.has(createdDate)) {
      dailyNoteIds.set(createdDate, new Set())
    }
    dailyNoteIds.get(createdDate)!.add(note.id)

    // 在更新日期添加笔记ID（如果不同）
    if (updatedDate !== createdDate) {
      if (!dailyNoteIds.has(updatedDate)) {
        dailyNoteIds.set(updatedDate, new Set())
      }
      dailyNoteIds.get(updatedDate)!.add(note.id)
    }
  })

  // 填充所有日期并返回结果
  const result: ActivityData[] = []
  const currentDate = new Date(dateRange.startDate)
  while (currentDate <= dateRange.endDate) {
    const dateKey = currentDate.toISOString().split('T')[0]
    const count = dailyNoteIds.get(dateKey)?.size || 0
    result.push({ date: dateKey, count })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return result
}

/**
 * 获取统计数据摘要
 */
export async function getStatsSummary() {
  const totalNotes = await prisma.note.count()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayNotes = await prisma.note.count({
    where: {
      date: {
        gte: today,
        lt: tomorrow,
      },
    },
  })

  const categories = await prisma.note.groupBy({
    by: ['category'],
    where: { category: { not: null } },
    _count: {
      category: true,
    },
  })

  const tags = await prisma.tag.findMany({
    include: {
      _count: {
        select: { noteTags: true },
      },
    },
    orderBy: {
      noteTags: {
        _count: 'desc',
      },
    },
    take: 20,
  })

  return {
    totalNotes,
    todayNotes,
    categories: categories.map((c) => ({
      name: c.category,
      count: c._count.category,
    })),
    topTags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      count: t._count.noteTags,
    })),
  }
}

/**
 * 获取年度月度统计数据（12个月）
 */
export async function getMonthlyActivityData(year: number): Promise<MonthlyActivityData[]> {
  // 查询指定年份的所有笔记
  const startDate = new Date(year, 0, 1)
  const endDate = new Date(year, 11, 31, 23, 59, 59, 999)

  const notes = await prisma.note.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      date: true,
    },
  })

  // 按月统计
  const monthlyMap = new Map<number, number>()

  // 初始化12个月为0
  for (let month = 1; month <= 12; month++) {
    monthlyMap.set(month, 0)
  }

  // 统计每月笔记数量
  notes.forEach((note) => {
    const month = note.date.getMonth() + 1 // 1-12
    const currentCount = monthlyMap.get(month) || 0
    monthlyMap.set(month, currentCount + 1)
  })

  // 转换为数组
  return Array.from(monthlyMap.entries()).map(([month, count]) => ({
    month,
    year,
    count,
  }))
}

/**
 * 获取小时级统计数据（24小时）
 */
export async function getHourlyActivityData(date: Date): Promise<HourlyActivityData[]> {
  // 查询指定日期的所有笔记
  const startDate = new Date(date)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(date)
  endDate.setHours(23, 59, 59, 999)

  const notes = await prisma.note.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      date: true,
    },
  })

  // 初始化24小时为0
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
  }))

  // 统计每小时笔记数量
  notes.forEach((note) => {
    const hour = note.date.getHours()
    hourlyData[hour].count++
  })

  return hourlyData
}
