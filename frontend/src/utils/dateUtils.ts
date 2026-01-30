/**
 * 日期工具函数
 */

/**
 * 检查两个日期是否是同一天
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * 创建指定年月日的Date对象（使用本地时区）
 */
export createDate(year: number, month: number, day: number): Date {
  return new Date(year, month, day)
}

/**
 * 格式化日期为 YYYY-MM-DD 字符串（使用本地时区）
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}