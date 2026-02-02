/**
 * 时间范围计算工具
 * 支持日/周/月/年/自定义五种模式
 */

/**
 * 日期范围接口
 */
export interface DateRange {
  startDate: Date
  endDate: Date
}

/**
 * 时间范围输入模式
 */
export type DateRangeMode = 'day' | 'week' | 'month' | 'year' | 'custom'

/**
 * 时间范围输入参数
 */
export interface DateRangeInput {
  mode: DateRangeMode
  value?: string        // YYYY-MM-DD 或 YYYY-MM 或 YYYY
  startDate?: string    // custom 模式下的起始日期 YYYY-MM-DD
  endDate?: string      // custom 模式下的结束日期 YYYY-MM-DD
}

/**
 * 解析日期字符串为 Date 对象
 * @param dateStr 日期字符串 (YYYY-MM-DD 或 YYYY-MM 或 YYYY)
 * @returns Date 对象
 */
function parseDateStr(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number)

  if (parts.length === 3) {
    // YYYY-MM-DD
    return new Date(parts[0], parts[1] - 1, parts[2])
  } else if (parts.length === 2) {
    // YYYY-MM
    return new Date(parts[0], parts[1] - 1, 1)
  } else if (parts.length === 1) {
    // YYYY
    return new Date(parts[0], 0, 1)
  }

  throw new Error(`Invalid date format: ${dateStr}`)
}

/**
 * 获取某日期所在周的开始和结束日期（ISO 8601 标准：周一到周日）
 * @param date 基准日期
 * @returns 日期范围
 */
function getWeekRange(date: Date): DateRange {
  const d = new Date(date)

  // 获取今天是周几 (0=周日, 1=周一, ..., 6=周六)
  const day = d.getDay()

  // 计算到周一的天数差（周一为 0）
  const diff = day === 0 ? 6 : day - 1

  // 获取周一
  const monday = new Date(d)
  monday.setDate(d.getDate() - diff)
  monday.setHours(0, 0, 0, 0)

  // 获取周日
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return { startDate: monday, endDate: sunday }
}

/**
 * 获取某日期所在月的开始和结束日期
 * @param date 基准日期
 * @returns 日期范围
 */
function getMonthRange(date: Date): DateRange {
  const year = date.getFullYear()
  const month = date.getMonth()

  // 月初
  const firstDay = new Date(year, month, 1, 0, 0, 0, 0)

  // 月末
  const lastDay = new Date(year, month + 1, 0, 23, 59, 59, 999)

  return { startDate: firstDay, endDate: lastDay }
}

/**
 * 获取某日期所在年的开始和结束日期
 * @param date 基准日期
 * @returns 日期范围
 */
function getYearRange(date: Date): DateRange {
  const year = date.getFullYear()

  // 年初
  const firstDay = new Date(year, 0, 1, 0, 0, 0, 0)

  // 年末
  const lastDay = new Date(year, 11, 31, 23, 59, 59, 999)

  return { startDate: firstDay, endDate: lastDay }
}

/**
 * 获取单日的开始和结束时间
 * @param date 基准日期
 * @returns 日期范围
 */
function getDayRange(date: Date): DateRange {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  return { startDate: startOfDay, endDate: endOfDay }
}

/**
 * 计算时间范围
 * @param input 时间范围输入参数
 * @returns 日期范围
 */
export function calculateDateRange(input: DateRangeInput): DateRange {
  const { mode, value, startDate, endDate } = input

  switch (mode) {
    case 'day': {
      if (!value) {
        // 默认今天
        return getDayRange(new Date())
      }
      const date = parseDateStr(value)
      return getDayRange(date)
    }

    case 'week': {
      if (!value) {
        // 默认本周
        return getWeekRange(new Date())
      }
      const date = parseDateStr(value)
      return getWeekRange(date)
    }

    case 'month': {
      if (!value) {
        // 默认本月
        return getMonthRange(new Date())
      }
      const date = parseDateStr(value)
      return getMonthRange(date)
    }

    case 'year': {
      if (!value) {
        // 默认本年
        return getYearRange(new Date())
      }
      const date = parseDateStr(value)
      return getYearRange(date)
    }

    case 'custom': {
      if (!startDate || !endDate) {
        throw new Error('Custom mode requires both startDate and endDate')
      }
      const start = parseDateStr(startDate)
      const end = parseDateStr(endDate)

      // 设置开始时间为 00:00:00
      start.setHours(0, 0, 0, 0)
      // 设置结束时间为 23:59:59
      end.setHours(23, 59, 59, 999)

      return { startDate: start, endDate: end }
    }

    default:
      throw new Error(`Invalid date range mode: ${mode}`)
  }
}
