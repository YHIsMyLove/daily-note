/**
 * 回滚脚本 - 将所有笔记时间重置为今天
 * 用于撤销 migrate-distribute-notes.ts 的更改
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 开始回滚：将所有笔记时间重置为今天...\n')

  const now = new Date()

  // 统计当前笔记数量
  const count = await prisma.note.count()
  console.log(`📊 找到 ${count} 条笔记\n`)

  // 更新所有笔记
  console.log('⏳ 开始重置笔记时间...')
  const result = await prisma.note.updateMany({
    data: {
      date: now,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log(`\n✅ 回滚完成！共重置 ${result.count} 条笔记的时间为今天 (${now.toLocaleString('zh-CN')})`)
}

main()
  .catch((e) => {
    console.error('❌ 回滚失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
