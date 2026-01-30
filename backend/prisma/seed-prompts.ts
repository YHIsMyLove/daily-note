/**
 * 提示词模板种子数据脚本
 * 用于手动初始化或重置提示词模板
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('[Seed] Starting prompt templates seeding...')

  // 定义默认提示词模板
  const templates = [
    {
      key: 'classify_note',
      name: '笔记分类',
      description: '用于自动分类笔记、生成标签和摘要',
      systemPart: `请严格按照以下 JSON 格式返回，不要包含任何其他文本：
{
  "category": "分类名称",
  "tags": ["标签1", "标签2", "标签3"],
  "summary": "一句话摘要",
  "sentiment": "positive|neutral|negative",
  "importance": 1-10的数字
}`,
      userPart: `你是笔记整理助手，请分析以下笔记内容并返回结构化数据。

笔记内容：
{content}

现有分类（按使用频率排序）：
{existingCategories}

现有标签（按使用频率排序）：
{existingTags}

分类选择规则：
- 优先从现有分类中选择最匹配的分类
- 如果现有分类都不合适，可以创建新的分类
- 参考分类使用频率，常用分类优先级更高

标签生成规则：
- 优先从现有标签中选择 3-5 个最相关的标签
- 如果现有标签都不合适，可以创建新的标签
- 使用简洁的词汇
- 避免重复或过于宽泛的标签
- 参考标签使用频率，常用标签优先级更高

重要性评分标准：
- 1-3：日常琐事，无长期价值
- 4-6：有一定参考价值
- 7-8：重要信息，需要回顾
- 9-10：非常重要，核心内容

情感分析标准：
- positive：积极正面、令人愉悦
- neutral：客观中立、无明显情感倾向
- negative：消极负面、需要关注`,
      variables: JSON.stringify([
        {
          name: 'content',
          description: '笔记内容',
          required: true,
          placeholder: '{content}',
        },
        {
          name: 'existingCategories',
          description: '现有分类列表（按使用频率排序）',
          required: false,
          placeholder: '{existingCategories}',
        },
        {
          name: 'existingTags',
          description: '现有标签列表（按使用频率排序）',
          required: false,
          placeholder: '{existingTags}',
        },
      ]),
    },
    {
      key: 'analyze_trends',
      name: '趋势分析',
      description: '分析笔记数据的趋势和模式',
      systemPart: `请返回以下 JSON 格式分析结果：
{
  "summary": "整体趋势摘要",
  "topCategories": ["最多出现的分类"],
  "emergingTopics": ["新兴话题或趋势"],
  "recommendations": ["基于趋势的建议"]
}`,
      userPart: `分析以下日期范围内的笔记趋势：

日期范围：{dateRange}
笔记数量：{noteCount}

分类分布：
{categoryDistribution}

标签分布：
{tagDistribution}`,
      variables: JSON.stringify([
        {
          name: 'dateRange',
          description: '日期范围',
          required: true,
          placeholder: '{dateRange}',
        },
        {
          name: 'noteCount',
          description: '笔记数量',
          required: true,
          placeholder: '{noteCount}',
        },
        {
          name: 'categoryDistribution',
          description: '分类分布',
          required: true,
          placeholder: '{categoryDistribution}',
        },
        {
          name: 'tagDistribution',
          description: '标签分布',
          required: true,
          placeholder: '{tagDistribution}',
        },
      ]),
    },
    {
      key: 'generate_daily_summary',
      name: '每日总结',
      description: '生成每日笔记总结',
      systemPart: `请返回以下 JSON 格式：
{
  "summary": "今日整体总结（2-3句话）",
  "keyAchievements": ["今日成就"],
  "pendingTasks": ["待完成任务"],
  "insights": ["今日感悟"]
}`,
      userPart: `生成今日笔记总结：

日期：{date}
笔记总数：{noteCount}

按分类汇总：
{categorySummary}

今日重要笔记：
{importantNotes}`,
      variables: JSON.stringify([
        {
          name: 'date',
          description: '日期',
          required: true,
          placeholder: '{date}',
        },
        {
          name: 'noteCount',
          description: '笔记总数',
          required: true,
          placeholder: '{noteCount}',
        },
        {
          name: 'categorySummary',
          description: '按分类汇总',
          required: true,
          placeholder: '{categorySummary}',
        },
        {
          name: 'importantNotes',
          description: '今日重要笔记',
          required: true,
          placeholder: '{importantNotes}',
        },
      ]),
    },
  ]

  // 遍历并创建/更新提示词模板
  for (const template of templates) {
    const existing = await prisma.promptTemplate.findUnique({
      where: { key: template.key },
    })

    if (existing) {
      console.log(`[Seed] Updating template: ${template.key}`)
      await prisma.promptTemplate.update({
        where: { key: template.key },
        data: {
          name: template.name,
          description: template.description,
          systemPart: template.systemPart,
          userPart: template.userPart,
          variables: template.variables,
          isDefault: true,
        },
      })
    } else {
      console.log(`[Seed] Creating template: ${template.key}`)
      await prisma.promptTemplate.create({
        data: {
          ...template,
          isDefault: true,
        },
      })
    }
  }

  console.log('[Seed] Prompt templates seeding completed!')
}

main()
  .catch((e) => {
    console.error('[Seed] Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
