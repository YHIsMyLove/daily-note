/**
 * 提示词模板服务
 * 负责管理提示词模板的 CRUD 和变量替换
 */
import { prisma } from '../database/prisma'
import { CLASSIFY_NOTE_PROMPT, ANALYZE_TRENDS_PROMPT, GENERATE_DAILY_SUMMARY_PROMPT } from '../llm/prompts'
import { PromptTemplate, PromptTemplateDetail, PromptVariable } from '@daily-note/shared'

/**
 * 默认提示词模板定义
 */
const DEFAULT_TEMPLATES: Array<{
  key: string
  name: string
  description?: string
  systemPart: string
  userPart: string
  variables: PromptVariable[]
}> = [
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
    variables: [
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
    ],
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
    variables: [
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
    ],
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
    variables: [
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
    ],
  },
  {
    key: 'summary_analysis',
    name: '总结分析',
    description: '分析笔记并生成综合总结',
    systemPart: `请返回以下 JSON 格式：
{
  "overview": "整体总结（3-5句话，概括这个时间段的主要活动和变化）",
  "keyAchievements": ["关键成就列表，每个1-2句话"],
  "pendingTasks": ["待完成任务列表，简短描述"],
  "insights": ["感悟和洞察列表，每个1-2句话"]
}`,
    userPart: `分析以下时间范围内的笔记，生成综合总结：

时间范围：{timeRange}
笔记总数：{noteCount}

情绪分布：
{sentimentSummary}

笔记内容摘要：
{notesSummary}

高重要性笔记：
{importantNotes}

请基于以上信息生成一份综合总结，要求：
1. overview：整体概括这个时间段的主要活动、进展和变化
2. keyAchievements：提取已完成的重要事项和成就
3. pendingTasks：识别还未完成的任务或待办事项
4. insights：基于笔记内容提炼有价值的感悟和洞察`,
    variables: [
      {
        name: 'timeRange',
        description: '时间范围',
        required: true,
        placeholder: '{timeRange}',
      },
      {
        name: 'noteCount',
        description: '笔记总数',
        required: true,
        placeholder: '{noteCount}',
      },
      {
        name: 'notesSummary',
        description: '笔记内容摘要',
        required: true,
        placeholder: '{notesSummary}',
      },
      {
        name: 'sentimentSummary',
        description: '情绪分布统计',
        required: false,
        placeholder: '{sentimentSummary}',
      },
      {
        name: 'importantNotes',
        description: '高重要性笔记',
        required: false,
        placeholder: '{importantNotes}',
      },
    ],
  },
  {
    key: 'hierarchical_summary',
    name: '分层总结',
    description: '基于子总结生成更高级别的总结',
    systemPart: `请返回以下 JSON 格式：
{
  "overview": "整体总结（4-6句话，综合多个时间段的信息）",
  "keyAchievements": ["关键成就列表，每个1-2句话"],
  "pendingTasks": ["待完成任务列表，简短描述"],
  "insights": ["感悟和洞察列表，每个1-2句话"]
}`,
    userPart: `基于以下{level}总结，生成{level}级别的综合总结：

时间范围：{timeRange}
包含的子总结数量：{subSummariesCount}

子总结详情：
{subSummaries}

请基于以上子总结生成一份更高级别的综合总结，要求：
1. overview：综合概括整个{level}的主要趋势和变化
2. keyAchievements：汇总所有重要成就，突出关键进展
3. pendingTasks：整理跨时间段的待办事项
4. insights：提炼更深层次的模式和洞察`,
    variables: [
      {
        name: 'level',
        description: '总结级别（week/month/year）',
        required: true,
        placeholder: '{level}',
      },
      {
        name: 'timeRange',
        description: '时间范围',
        required: true,
        placeholder: '{timeRange}',
      },
      {
        name: 'subSummariesCount',
        description: '子总结数量',
        required: true,
        placeholder: '{subSummariesCount}',
      },
      {
        name: 'subSummaries',
        description: '子总结详情',
        required: true,
        placeholder: '{subSummaries}',
      },
    ],
  },
]

export class PromptService {
  /**
   * 初始化默认提示词模板
   */
  async initializeDefaults(): Promise<void> {
    for (const template of DEFAULT_TEMPLATES) {
      const existing = await prisma.promptTemplate.findUnique({
        where: { key: template.key },
      })

      if (!existing) {
        await prisma.promptTemplate.create({
          data: {
            ...template,
            variables: JSON.stringify(template.variables),
            isDefault: true,
          },
        })
        console.log(`[PromptService] Initialized default template: ${template.key}`)
      }
    }
  }

  /**
   * 获取提示词模板（合并限定区和提示词区，替换变量）
   */
  async getPrompt(key: string, variables: Record<string, any> = {}): Promise<string> {
    try {
      const template = await prisma.promptTemplate.findUnique({
        where: { key, isActive: true },
      })

      if (!template) {
        console.warn(`[PromptService] Template not found: ${key}, using fallback`)
        return this.getFallbackPrompt(key, variables)
      }

      // 合并限定区和提示词区
      const fullPrompt = `${template.systemPart}\n\n${template.userPart}`

      // 替换变量
      return this.replaceVariables(fullPrompt, variables)
    } catch (error) {
      console.error(`[PromptService] Error getting prompt ${key}:`, error)
      return this.getFallbackPrompt(key, variables)
    }
  }

  /**
   * 获取原始模板对象
   */
  async getTemplate(key: string): Promise<PromptTemplateDetail | null> {
    try {
      const template = await prisma.promptTemplate.findUnique({
        where: { key },
      })

      if (!template) {
        return null
      }

      return {
        id: template.id,
        key: template.key,
        name: template.name,
        description: template.description ?? undefined,
        isActive: template.isActive,
        isDefault: template.isDefault,
        updatedAt: template.updatedAt,
        systemPart: template.systemPart,
        userPart: template.userPart,
        variables: JSON.parse(template.variables) as PromptVariable[],
      }
    } catch (error) {
      console.error(`[PromptService] Error getting template ${key}:`, error)
      return null
    }
  }

  /**
   * 获取所有提示词列表
   */
  async listTemplates(): Promise<PromptTemplate[]> {
    try {
      const templates = await prisma.promptTemplate.findMany({
        orderBy: { updatedAt: 'desc' },
      })

      return templates.map((t) => ({
        id: t.id,
        key: t.key,
        name: t.name,
        description: t.description ?? undefined,
        isActive: t.isActive,
        isDefault: t.isDefault,
        updatedAt: t.updatedAt,
      }))
    } catch (error) {
      console.error('[PromptService] Error listing templates:', error)
      return []
    }
  }

  /**
   * 创建新提示词模板
   */
  async createTemplate(data: {
    key: string
    name: string
    description?: string
    systemPart: string
    userPart: string
    variables: PromptVariable[]
  }): Promise<PromptTemplate> {
    try {
      const template = await prisma.promptTemplate.create({
        data: {
          key: data.key,
          name: data.name,
          description: data.description,
          systemPart: data.systemPart,
          userPart: data.userPart,
          variables: JSON.stringify(data.variables),
          isDefault: false,
        },
      })

      return {
        id: template.id,
        key: template.key,
        name: template.name,
        description: template.description ?? undefined,
        isActive: template.isActive,
        isDefault: template.isDefault,
        updatedAt: template.updatedAt,
      }
    } catch (error) {
      console.error('[PromptService] Error creating template:', error)
      throw error
    }
  }

  /**
   * 更新提示词（只更新用户可编辑部分）
   */
  async updateTemplate(key: string, userPart: string): Promise<void> {
    try {
      await prisma.promptTemplate.update({
        where: { key },
        data: { userPart },
      })
    } catch (error) {
      console.error(`[PromptService] Error updating template ${key}:`, error)
      throw error
    }
  }

  /**
   * 删除提示词
   */
  async deleteTemplate(key: string): Promise<void> {
    try {
      await prisma.promptTemplate.delete({
        where: { key },
      })
    } catch (error) {
      console.error(`[PromptService] Error deleting template ${key}:`, error)
      throw error
    }
  }

  /**
   * 恢复默认提示词
   */
  async resetToDefault(key: string): Promise<PromptTemplateDetail> {
    try {
      const defaultTemplate = DEFAULT_TEMPLATES.find((t) => t.key === key)

      if (!defaultTemplate) {
        throw new Error(`No default template found for key: ${key}`)
      }

      // 先删除现有模板（如果存在）
      await prisma.promptTemplate.deleteMany({
        where: { key },
      })

      // 创建新的默认模板
      const template = await prisma.promptTemplate.create({
        data: {
          ...defaultTemplate,
          variables: JSON.stringify(defaultTemplate.variables),
          isDefault: true,
        },
      })

      return {
        id: template.id,
        key: template.key,
        name: template.name,
        description: template.description ?? undefined,
        isActive: template.isActive,
        isDefault: template.isDefault,
        updatedAt: template.updatedAt,
        systemPart: template.systemPart,
        userPart: template.userPart,
        variables: JSON.parse(template.variables) as PromptVariable[],
      }
    } catch (error) {
      console.error(`[PromptService] Error resetting template ${key}:`, error)
      throw error
    }
  }

  /**
   * 预览提示词（使用示例数据）
   */
  async previewTemplate(
    key: string,
    sampleData: Record<string, any> = {}
  ): Promise<string> {
    try {
      const template = await this.getTemplate(key)

      if (!template) {
        throw new Error(`Template not found: ${key}`)
      }

      // 合并限定区和提示词区
      const fullPrompt = `${template.systemPart}\n\n${template.userPart}`

      // 替换变量
      return this.replaceVariables(fullPrompt, sampleData)
    } catch (error) {
      console.error(`[PromptService] Error previewing template ${key}:`, error)
      throw error
    }
  }

  /**
   * 替换变量占位符（私有方法）
   */
  private replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`
      result = result.replaceAll(placeholder, String(value ?? ''))
    }

    return result
  }

  /**
   * 获取降级提示词（从硬编码的 prompts.ts 获取）
   */
  private getFallbackPrompt(key: string, variables: Record<string, any> = {}): string {
    let prompt: string

    switch (key) {
      case 'classify_note':
        prompt = CLASSIFY_NOTE_PROMPT
        break
      case 'analyze_trends':
        prompt = ANALYZE_TRENDS_PROMPT
        break
      case 'generate_daily_summary':
        prompt = GENERATE_DAILY_SUMMARY_PROMPT
        break
      default:
        prompt = CLASSIFY_NOTE_PROMPT
    }

    return this.replaceVariables(prompt, variables)
  }
}

export const promptService = new PromptService()
