/**
 * 数据迁移脚本：为现有 Summary 记录填充 periodKey
 *
 * periodKey 格式：
 * - day: "2024-01-15"
 * - week: "2024-W03"
 * - month: "2024-01"
 * - year: "2024"
 */

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

// 加载环境变量
config()

const prisma = new PrismaClient()

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 获取 ISO 周数
 */
function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { year: d.getFullYear(), week: weekNo }
}

/**
 * 格式化为周周期 key
 */
function formatWeekKey(date: Date): string {
  const { year, week } = getISOWeek(date)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/**
 * 格式化为月周期 key
 */
function formatMonthKey(date: Date): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * 格式化为年周期 key
 */
function formatYearKey(date: Date): string {
  return String(new Date(date).getFullYear())
}

/**
 * 根据模式生成 periodKey
 */
function generatePeriodKey(mode: string, startDate: Date): string {
  switch (mode) {
    case 'day':
      return formatDate(startDate)
    case 'week':
      return formatWeekKey(startDate)
    case 'month':
      return formatMonthKey(startDate)
    case 'year':
      return formatYearKey(startDate)
    default:
      return formatDate(startDate)
  }
}

async function main() {
  console.log('开始迁移 Summary 记录的 periodKey...')

  // 获取所有记录（因为 periodKey 是新列，所有记录都需要填充）
  const summaries = await prisma.summary.findMany({
    select: {
      id: true,
      mode: true,
      startDate: true,
    },
  })

  console.log(`找到 ${summaries.length} 条需要迁移的记录`)

  // 用于检测潜在的重复
  const periodKeySet = new Set<string>()
  const duplicates: string[] = []

  for (const summary of summaries) {
    const periodKey = generatePeriodKey(summary.mode, summary.startDate)

    // 检查是否有重复
    const key = `${summary.mode}:${periodKey}`
    if (periodKeySet.has(key)) {
      duplicates.push(`重复: ${summary.id.slice(0, 8)} -> ${key}`)
    }
    periodKeySet.add(key)

    await prisma.summary.update({
      where: { id: summary.id },
      data: { periodKey },
    })

    console.log(`✓ ${summary.id.slice(0, 8)}... | ${summary.mode.padEnd(6)} | ${periodKey}`)
  }

  if (duplicates.length > 0) {
    console.log('\n⚠️  发现重复的 periodKey:')
    duplicates.forEach(d => console.log(`  ${d}`))
  }

  console.log('\n迁移完成!')
}

main()
  .catch((e) => {
    console.error('迁移失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
