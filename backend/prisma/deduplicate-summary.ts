/**
 * Summary 记录去重脚本
 * 每个 (mode, periodKey) 组合只保留最新的一条记录
 */

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config()
const prisma = new PrismaClient()

async function main() {
  console.log('开始去重 Summary 记录...\n')

  // 获取所有记录，按 generatedAt 排序
  const allSummaries = await prisma.summary.findMany({
    orderBy: { generatedAt: 'desc' },
  })

  // 按 mode + periodKey 分组
  const groups = new Map<string, typeof allSummaries>()
  for (const summary of allSummaries) {
    const key = `${summary.mode}:${summary.periodKey || ''}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(summary)
  }

  // 找出需要删除的记录（每组中不是第一条的）
  const toDelete: string[] = []
  let keptCount = 0
  let duplicateGroups = 0

  for (const [key, records] of groups) {
    if (records.length > 1) {
      duplicateGroups++
      console.log(`\n📅 ${key}`)
      console.log(`  保留: ${records[0].id.slice(0, 8)}... (${records[0].generatedAt.toISOString()})`)
      for (let i = 1; i < records.length; i++) {
        toDelete.push(records[i].id)
        console.log(`  删除: ${records[i].id.slice(0, 8)}... (${records[i].generatedAt.toISOString()})`)
      }
    } else {
      keptCount++
    }
  }

  console.log(`\n统计:`)
  console.log(`  唯一记录: ${keptCount} 条`)
  console.log(`  重复组数: ${duplicateGroups} 组`)
  console.log(`  待删除: ${toDelete.length} 条`)

  if (toDelete.length === 0) {
    console.log('\n无需删除，所有记录都是唯一的。')
    return
  }

  // 确认删除
  console.log('\n开始删除重复记录...')

  for (const id of toDelete) {
    await prisma.summary.delete({ where: { id } })
    console.log(`✓ 已删除 ${id.slice(0, 8)}...`)
  }

  console.log(`\n✅ 去重完成！删除了 ${toDelete.length} 条重复记录。`)
}

main()
  .catch((e) => {
    console.error('去重失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
