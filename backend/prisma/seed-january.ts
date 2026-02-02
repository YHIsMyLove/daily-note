/**
 * 生成1月份示例数据
 * 每天生成 3-5 条笔记
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 示例分类
const categories = [
  { name: '工作', color: '217 91% 60%' },
  { name: '学习', color: '142 76% 36%' },
  { name: '生活', color: '346 77% 60%' },
  { name: '健康', color: '120 57% 40%' },
  { name: '财务', color: '45 93% 47%' },
]

// 示例标签
const tags = [
  { name: '重要', color: '0 84% 60%' },
  { name: '紧急', color: '0 72% 51%' },
  { name: '想法', color: '262 83% 58%' },
  { name: '待办', color: '199 89% 48%' },
  { name: '完成', color: '142 76% 36%' },
]

// 笔记内容模板 - 按分类组织
const noteTemplates = {
  工作: [
    '今天完成了项目的需求分析文档，和产品团队确认了核心功能点。',
    '修复了几个关键 bug，性能优化后接口响应时间减少了 30%。',
    '参加了团队周会，讨论了下个月的迭代计划。',
    '代码评审中发现了一些可以改进的地方，已经记录下来待处理。',
    '下午和客户进行了沟通，了解了他们对新功能的期望。',
    '完成了 API 接口的设计文档，准备开始开发。',
    '研究了新的技术方案，可能会应用到下个版本中。',
    '处理了一个紧急的生产问题，原因是数据库连接池配置不当。'
  ],
  学习: [
    '今天学习了 TypeScript 的高级类型，泛型真的很强大。',
    '阅读了《代码整洁之道》第三章，对函数设计有了新的认识。',
    '完成了在线课程的一章内容，做了详细的笔记。',
    '练习了几个算法题，加深了对动态规划的理解。',
    '学习 Prisma ORM 的使用，感觉比直接写 SQL 方便很多。',
    '看了技术分享视频，了解到最新的前端架构趋势。',
    '复习了设计模式，单例模式和工厂模式的适用场景更清晰了。',
    '学习了一些 CSS 高级技巧，Flexbox 和 Grid 布局更熟练了。'
  ],
  生活: [
    '今天天气不错，下班后去公园散步了。',
    '尝试做了一道新菜，味道还不错，下次可以继续改良。',
    '整理了房间，扔掉了一些不需要的东西，感觉清爽多了。',
    '和朋友通了电话，聊了近期的打算。',
    '看了部电影，剧情很反转，值得推荐。',
    '周末计划了一下，准备去爬山放松一下。',
    '整理了书架，翻到了几本好久没看的书。',
    '帮朋友解决了电脑问题，顺便学习了些新知识。'
  ],
  健康: [
    '今天跑步 5 公里，配速比上周有进步。',
    '最近睡眠质量不太好，需要调整作息时间。',
    '坚持做眼保健操，眼睛疲劳有所缓解。',
    '今天喝了足够的水，保持这个好习惯。',
    '去健身房做了力量训练，深蹲突破了新纪录。',
    '感觉有点累，早点休息明天会更好。',
    '坚持每天冥想 10 分钟，心态平静了很多。',
    '体检报告出来了，各项指标都正常，继续保持。'
  ],
  财务: [
    '今天记账了，这个月支出比预期多了点，需要控制。',
    '研究了理财产品的收益，决定调整投资组合。',
    '收到工资了，把一部分存起来作为应急资金。',
    '整理了去年的账单，分析了消费习惯。',
    '今天没有冲动消费，值得表扬。',
    '买了一些必需品，用了优惠券省了不少钱。',
    '计划今年的财务目标，先存下一笔旅行基金。',
    '取消了一些不必要的订阅服务，每月可以省下一些钱。'
  ]
}

// 情感分布
const sentiments: ('positive' | 'neutral' | 'negative')[] = [
  'positive', 'positive', 'positive', 'positive',
  'neutral', 'neutral', 'neutral', 'neutral',
  'negative'
]

// 生成 1 月份的日期数组
function getJanuaryDates(): Date[] {
  const dates: Date[] = []
  const year = new Date().getFullYear()

  for (let day = 1; day <= 31; day++) {
    const date = new Date(year, 0, day)
    dates.push(date)
  }

  return dates
}

// 随机选择数组元素
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// 随机范围内的整数
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 生成笔记内容
function generateNoteContent(categoryName: string): string {
  const templates = noteTemplates[categoryName as keyof typeof noteTemplates] || noteTemplates.工作
  return randomChoice(templates)
}

// 生成摘要
function generateSummary(content: string): string {
  const summaries = [
    `今日重点：${content.slice(0, 10)}...`,
    `记录：完成了相关任务`,
    `小结：收获颇丰`,
    `备注：需要跟进`,
    `总结：进展顺利`
  ]
  return randomChoice(summaries)
}

async function main() {
  console.log('🌱 开始生成 1 月份示例数据...\n')

  // 清空现有数据
  console.log('🗑️  清空现有数据...')
  await prisma.noteTag.deleteMany()
  await prisma.noteRelation.deleteMany()
  await prisma.claudeTask.deleteMany()
  await prisma.note.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.category.deleteMany()

  // 创建分类
  console.log('\n📁 创建分类...')
  const createdCategories = await Promise.all(
    categories.map(cat => prisma.category.create({ data: cat }))
  )
  console.log(`   已创建 ${createdCategories.length} 个分类`)

  // 创建标签
  console.log('\n🏷️  创建标签...')
  const createdTags = await Promise.all(
    tags.map(tag => prisma.tag.create({ data: tag }))
  )
  console.log(`   已创建 ${createdTags.length} 个标签`)

  // 为 1 月份每天生成笔记
  const januaryDates = getJanuaryDates()
  let totalNotes = 0
  let totalTasks = 0

  console.log('\n📝 生成笔记...')

  for (const date of januaryDates) {
    // 每天生成 3-5 条笔记
    const noteCount = randomInt(3, 5)
    const dateStr = date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })

    for (let i = 0; i < noteCount; i++) {
      const category = randomChoice(createdCategories)
      const sentiment = randomChoice(sentiments)
      const importance = randomInt(3, 10)
      const content = generateNoteContent(category.name)

      // 设置时间为当天的不同时段
      const hour = randomInt(8, 22)
      const noteDate = new Date(date)
      noteDate.setHours(hour, randomInt(0, 59) * 10, 0, 0)

      const note = await prisma.note.create({
        data: {
          content,
          date: noteDate,
          summary: generateSummary(content),
          sentiment,
          importance,
          // categoryId 有 @unique 约束，不能多个笔记共享同一个分类
          // 暂时不设置 categoryId
          categoryId: null,
        }
      })

      totalNotes++

      // 随机添加标签
      const tagCount = randomInt(0, 2)
      if (tagCount > 0) {
        const selectedTags = []
        for (let j = 0; j < tagCount; j++) {
          const tag = randomChoice(createdTags)
          if (!selectedTags.includes(tag.id)) {
            selectedTags.push(tag.id)
          }
        }

        await Promise.all(
          selectedTags.map(tagId =>
            prisma.noteTag.create({
              data: { noteId: note.id, tagId }
            })
          )
        )
      }

      // 随机生成一些待办任务
      if (Math.random() > 0.5) {
        const taskCount = randomInt(1, 3)
        for (let k = 0; k < taskCount; k++) {
          const isCompleted = Math.random() > 0.4
          const dueDate = new Date(noteDate)
          dueDate.setDate(dueDate.getDate() + randomInt(1, 7))

          await prisma.claudeTask.create({
            data: {
              type: 'extract_todo_tasks',
              noteId: note.id,
              payload: JSON.stringify({ source: 'seed_data' }),
              status: isCompleted ? 'COMPLETED' : 'PENDING',
              priority: randomInt(0, 3),
              result: isCompleted ? JSON.stringify({ completed: true }) : null,
              completedAt: isCompleted ? new Date(noteDate.getTime() + 3600000) : null,
              // Todo 字段
              title: `${category.name}相关任务 ${k + 1}`,
              description: `来自 ${dateStr} 的笔记`,
              dueDate: Math.random() > 0.5 ? dueDate : null,
              todoCompletedAt: isCompleted ? new Date(noteDate.getTime() + 3600000) : null,
              isAiGenerated: true,
            }
          })
          totalTasks++
        }
      }
    }

    // 显示进度
    if (date.getDate() % 5 === 0) {
      console.log(`   ${date.getDate()}日: ${noteCount} 条笔记`)
    }
  }

  // 生成一些周总结
  console.log('\n📊 生成周总结...')
  for (let week = 1; week <= 4; week++) {
    const startDate = new Date(new Date().getFullYear(), 0, (week - 1) * 7 + 1)
    const endDate = new Date(new Date().getFullYear(), 0, week * 7)

    await prisma.summary.create({
      data: {
        mode: 'week',
        periodKey: `${new Date().getFullYear()}-W${String(week).padStart(2, '0')}`,
        startDate,
        endDate,
        overview: `第${week}周总结：整体表现良好，完成了多个重要任务。`,
        achievements: JSON.stringify([
          '完成了阶段性工作目标',
          '保持了良好的学习习惯',
          '健康状况稳定'
        ]),
        pendingTasks: JSON.stringify([
          '跟进项目进度',
          '继续学习新技术'
        ]),
        insights: JSON.stringify([
          '时间管理需要进一步优化',
          '保持专注可以提高效率'
        ]),
        noteCount: randomInt(15, 25),
        sentimentData: JSON.stringify({
          positive: randomInt(10, 20),
          neutral: randomInt(5, 10),
          negative: randomInt(0, 3)
        }),
        categoryStats: JSON.stringify({
          工作: randomInt(8, 15),
          学习: randomInt(5, 10),
          生活: randomInt(3, 8)
        }),
        tagStats: JSON.stringify({
          重要: randomInt(5, 10),
          待办: randomInt(3, 8),
          完成: randomInt(8, 15)
        }),
        importanceStats: JSON.stringify({
          high: randomInt(5, 10),
          medium: randomInt(10, 20),
          low: randomInt(3, 8)
        }),
        taskStats: JSON.stringify({
          total: randomInt(20, 40),
          completed: randomInt(15, 35),
          pending: randomInt(5, 15)
        }),
        timeStats: JSON.stringify({
          morning: randomInt(5, 12),
          afternoon: randomInt(10, 20),
          evening: randomInt(3, 10)
        })
      }
    })
  }

  console.log('\n✅ 数据生成完成！')
  console.log(`📊 统计：`)
  console.log(`   - 分类: ${createdCategories.length} 个`)
  console.log(`   - 标签: ${createdTags.length} 个`)
  console.log(`   - 笔记: ${totalNotes} 条`)
  console.log(`   - 任务: ${totalTasks} 个`)
  console.log(`   - 总结: 4 条`)
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
