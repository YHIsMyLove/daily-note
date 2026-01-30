/**
 * 数据库种子脚本 - 插入测试数据
 * 用于测试日历功能
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 获取昨天的日期（00:00:00）
function getYesterday(): Date {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  date.setHours(0, 0, 0, 0)
  return date
}

// 获取前天的日期（00:00:00）
function getDayBeforeYesterday(): Date {
  const date = new Date()
  date.setDate(date.getDate() - 2)
  date.setHours(0, 0, 0, 0)
  return date
}

// 测试数据
const testNotes = [
  // 昨天的笔记
  {
    content: '今天学习了 Next.js 14 的 Server Actions，感觉比 API Route 更方便',
    date: getYesterday(),
    category: '学习',
    summary: '学习 Next.js Server Actions',
    sentiment: 'positive',
    importance: 7,
  },
  {
    content: '下午和团队讨论了新项目的架构设计，决定使用 Prisma + SQLite',
    date: getYesterday(),
    category: '工作',
    summary: '项目架构讨论',
    sentiment: 'neutral',
    importance: 8,
  },
  {
    content: '跑步5公里，感觉身体状况不错，继续保持',
    date: getYesterday(),
    category: '健康',
    summary: '运动记录',
    sentiment: 'positive',
    importance: 6,
  },
  // 前天的笔记
  {
    content: '修复了一个前端 bug，是由于状态管理不当导致的',
    date: getDayBeforeYesterday(),
    category: '工作',
    summary: 'Bug 修复',
    sentiment: 'neutral',
    importance: 5,
  },
  {
    content: '阅读了《深入理解计算机系统》第三章，关于程序的机器级表示',
    date: getDayBeforeYesterday(),
    category: '学习',
    summary: '阅读 CSAPP',
    sentiment: 'positive',
    importance: 8,
  },
  {
    content: '今天天气不好，心情有点低落，但通过听音乐调整过来了',
    date: getDayBeforeYesterday(),
    category: '心情',
    summary: '情绪调节',
    sentiment: 'negative',
    importance: 4,
  },
  {
    content: '尝试了新的咖啡店，拿铁味道不错，可以作为新的工作地点',
    date: getDayBeforeYesterday(),
    category: '生活',
    summary: '探店',
    sentiment: 'positive',
    importance: 3,
  },
]

async function main() {
  console.log('🌱 开始插入测试数据...')

  // 清空现有数据（可选，根据需要注释掉）
  // await prisma.note.deleteMany({})
  // console.log('✅ 清空现有数据')

  // 检查是否已有数据
  const existingCount = await prisma.note.count()
  console.log(`📊 当前数据库中有 ${existingCount} 条笔记`)

  // 插入测试数据
  for (const note of testNotes) {
    // 检查是否已存在相同内容、相同日期的笔记
    const existing = await prisma.note.findFirst({
      where: {
        content: note.content,
        date: note.date,
      },
    })

    if (existing) {
      console.log(`⏭️  跳过已存在的笔记: ${note.content.slice(0, 20)}...`)
      continue
    }

    await prisma.note.create({
      data: note,
    })
    console.log(`✅ 创建笔记: ${note.content.slice(0, 30)}...`)
  }

  console.log('🎉 测试数据插入完成！')

  // 显示统计信息
  const totalCount = await prisma.note.count()
  const yesterdayNotes = await prisma.note.count({
    where: { date: getYesterday() },
  })
  const dayBeforeNotes = await prisma.note.count({
    where: { date: getDayBeforeYesterday() },
  })

  console.log('\n📈 数据统计:')
  console.log(`   总笔记数: ${totalCount}`)
  console.log(`   昨天笔记: ${yesterdayNotes}`)
  console.log(`   前天笔记: ${dayBeforeNotes}`)
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
