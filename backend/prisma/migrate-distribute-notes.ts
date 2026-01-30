/**
 * 数据迁移脚本 - 将笔记时间分散到最近一周
 * 用于测试日历和活跃度功能
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * 获取最近 N 天的随机日期
 * @param daysAgo 往前推的天数（0=今天，1=昨天，...）
 * @param randomHour 是否随机小时（默认 false，设置为 0 点）
 */
function getRandomDate(daysAgo: number, randomHour = true): Date {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)

  if (randomHour) {
    // 随机时间：8:00 - 23:59
    const hour = Math.floor(Math.random() * 16) + 8  // 8-23
    const minute = Math.floor(Math.random() * 60)
    const second = Math.floor(Math.random() * 60)
    date.setHours(hour, minute, second, 0)
  } else {
    date.setHours(0, 0, 0, 0)
  }

  return date
}

/**
 * 为笔记分配随机日期（最近 7 天）
 * 使用加权随机，让近几天的笔记稍多一些
 */
function assignRandomDay(): number {
  // 加权：今天权重高，越往前权重越低
  const weights = [15, 14, 13, 12, 11, 10, 9]  // 今天到 6 天前
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  let random = Math.random() * totalWeight
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i]
    if (random <= 0) {
      return i  // 返回天数偏移
    }
  }
  return 0  // 默认今天
}

/**
 * 生成模拟的创建时间（更早，用于模拟编辑场景）
 * @param updatedAt 当前更新时间
 * @param daysBefore 往前推多少天（默认 1-3 天）
 */
function generateEarlierTime(updatedAt: Date, daysBefore?: number): Date {
  const days = daysBefore ?? Math.floor(Math.random() * 3) + 1
  const created = new Date(updatedAt)
  created.setDate(created.getDate() - days)

  // 随机时间：8:00 - 18:00
  const hour = Math.floor(Math.random() * 11) + 8
  const minute = Math.floor(Math.random() * 60)
  created.setHours(hour, minute, 0, 0)

  return created
}

async function main() {
  console.log('🔄 开始数据迁移：分散笔记时间到最近一周...\n')

  // 1. 读取所有笔记
  const allNotes = await prisma.note.findMany({
    select: {
      id: true,
      content: true,
    },
  })

  console.log(`📊 找到 ${allNotes.length} 条现有笔记\n`)

  if (allNotes.length === 0) {
    console.log('⚠️  数据库中没有笔记，请先运行 pnpm db:seed 创建测试数据')
    return
  }

  // 2. 为每条笔记分配新时间
  const updates = allNotes.map((note) => {
    const dayOffset = assignRandomDay()
    const updatedAt = getRandomDate(dayOffset, true)  // 随机小时

    // 30% 的笔记模拟"编辑过"的场景
    const isEdited = Math.random() < 0.3
    const createdAt = isEdited
      ? generateEarlierTime(updatedAt)
      : new Date(updatedAt)  // 创建时间 = 更新时间

    // date 字段也使用随机时间（与 updatedAt 相同或稍早）
    const date = new Date(updatedAt)

    return {
      id: note.id,
      date: date,
      createdAt,
      updatedAt,
    }
  })

  // 3. 按日期分组统计
  const dailyCount = new Map<number, number>()
  updates.forEach((u) => {
    const dayKey = Math.floor((new Date().getTime() - u.updatedAt.getTime()) / (1000 * 60 * 60 * 24))
    dailyCount.set(dayKey, (dailyCount.get(dayKey) || 0) + 1)
  })

  console.log('📅 计划分布：')
  const dayNames = ['今天', '昨天', '前天', '3天前', '4天前', '5天前', '6天前']
  for (let i = 0; i < 7; i++) {
    const count = dailyCount.get(i) || 0
    console.log(`   ${dayNames[i].padEnd(8)} ${count} 条笔记`)
  }

  console.log(`\n   其中 ${updates.filter(u => u.createdAt.getTime() !== u.updatedAt.getTime()).length} 条笔记有编辑历史（createdAt ≠ updatedAt）\n`)

  // 4. 批量更新
  console.log('⏳ 开始更新数据库...')
  let updatedCount = 0

  for (const update of updates) {
    await prisma.note.update({
      where: { id: update.id },
      data: {
        date: update.date,
        createdAt: update.createdAt,
        updatedAt: update.updatedAt,
      },
    })
    updatedCount++

    if (updatedCount % 10 === 0) {
      console.log(`   已更新 ${updatedCount}/${updates.length} 条笔记...`)
    }
  }

  console.log(`\n✅ 数据迁移完成！共更新 ${updatedCount} 条笔记\n`)

  // 5. 验证结果
  console.log('📈 验证结果：')
  const finalNotes = await prisma.note.findMany({
    select: {
      date: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  const dateRange = {
    earliest: finalNotes[finalNotes.length - 1].updatedAt,
    latest: finalNotes[0].updatedAt,
  }

  console.log(`   时间范围：${dateRange.earliest.toLocaleDateString('zh-CN')} ~ ${dateRange.latest.toLocaleDateString('zh-CN')}`)
  console.log(`   最早笔记：${finalNotes[finalNotes.length - 1].updatedAt.toLocaleString('zh-CN')}`)
  console.log(`   最新笔记：${finalNotes[0].updatedAt.toLocaleString('zh-CN')}`)
}

main()
  .catch((e) => {
    console.error('❌ 迁移失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
