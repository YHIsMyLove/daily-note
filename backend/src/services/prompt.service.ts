/**
 * 提示词模板服务
 * 负责管理提示词模板的 CRUD 和变量替换
 */
import { prisma } from '../database/prisma'
import { CLASSIFY_NOTE_PROMPT, ANALYZE_TRENDS_PROMPT, GENERATE_DAILY_SUMMARY_PROMPT, EXTRACT_TASKS_PROMPT, AUTO_COMPLETION_ANALYSIS_PROMPT } from '../llm/prompts'
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
  {
    key: 'extract_tasks',
    name: '任务提取',
    description: '从笔记内容中提取可执行的任务',
    systemPart: `请严格按照以下 JSON 格式返回，不要包含任何其他文本：
{
  "tasks": [
    {
      "title": "任务标题（简短明确）",
      "description": "任务详细描述（可选）",
      "priority": "high|medium|low",
      "dueDate": "ISO日期字符串或null（如：2024-01-15）",
      "actionable": true
    }
  ]
}`,
    userPart: `你是任务提取助手，请从以下笔记内容中提取可执行的任务。

笔记内容：
{content}

任务提取规则：
- 只提取明确的可执行任务（如："完成报告"、"联系客户"、"购买物品"）
- 忽略纯描述性内容、感受、想法记录
- 任务标题应简短明确，使用动词开头
- 优先级判断：
  * high：有明确截止日期、重要紧急、影响重大
  * medium：需要完成但不紧急、常规任务
  * low：可选事项、参考性任务
- 截止日期：从笔记内容中提取明确的时间信息（如"明天"、"下周"、"12月15日"），如无明确时间则返回null
- 如果笔记中没有可执行任务，返回空数组：{"tasks": []}

示例：
笔记："明天下午3点前完成周报，记得包含本周的项目进度和下周计划。"
提取结果：
{
  "tasks": [
    {
      "title": "完成周报",
      "description": "包含本周的项目进度和下周计划",
      "priority": "high",
      "dueDate": "2024-01-16",
      "actionable": true
    }
  ]
}`,
    variables: [
      {
        name: 'content',
        description: '笔记内容',
        required: true,
        placeholder: '{content}',
      },
    ],
  },
  {
    key: 'auto_completion_analysis',
    name: '自动补全分析',
    description: '分析任务是否可以由 AI 自动完成',
    systemPart: `请严格按照以下 JSON 格式返回，不要包含任何其他文本：
{
  "canAutoComplete": true/false,
  "confidence": 0-100的数字,
  "approach": "完成任务的详细方法描述",
  "estimatedSteps": ["步骤1", "步骤2", "步骤3"],
  "estimatedTime": "预计耗时（如：5-10分钟）",
  "requirements": ["需求1", "需求2"],
  "risks": ["风险1", "风险2"]
}`,
    userPart: `你是任务自动补全分析助手，请分析以下任务是否可以由 AI 自动完成。

任务信息：
{task}

自动补全可行性判断标准：
- 可以自动完成的任务类型：
  * 信息查询（如：查询天气、搜索资料、查找数据）
  * 数据处理（如：整理数据、格式转换、统计分析）
  * 内容生成（如：撰写文档、生成报告、创作内容）
  * 通知发送（如：发送提醒、邮件通知、消息推送）
  * 简单决策（如：优先级排序、分类整理）

- 不能自动完成的任务类型：
  * 需要物理操作的任务（如：购买物品、移动文件、打印文档）
  * 涉及敏感信息的操作（如：访问密码、私人数据、支付操作）
  * 需要人工判断的复杂决策（如：创意设计、策略制定）
  * 需要外部系统访问的任务（如：调用第三方 API、访问外部服务）

置信度评分标准：
- 90-100：非常确定可以自动完成，任务明确且无风险
- 70-89：较确定可以自动完成，有轻微不确定性
- 50-69：可能可以自动完成，需要更多信息验证
- 30-49：不太建议自动完成，风险较高或不确定性大
- 10-29：不建议自动完成，很可能失败或出错
- 0-9：完全不能自动完成，必须人工处理

分析方法：
1. 仔细分析任务标题和描述
2. 识别任务类型和核心需求
3. 评估是否可以通过纯信息处理完成
4. 识别潜在风险和需要的资源
5. 给出置信度评分和详细执行方案`,
    variables: [
      {
        name: 'task',
        description: '任务信息（标题、描述、优先级、截止日期等）',
        required: true,
        placeholder: '{task}',
      },
    ],
  },
  {
    key: 'analyze_relations',
    name: '关联分析',
    description: '分析笔记之间的关联性，计算相似度',
    systemPart: `请严格按照以下 JSON 格式返回，不要包含任何其他文本：
{
  "relations": [
    {
      "noteId": "笔记ID",
      "similarity": 0.0-1.0的数字,
      "reason": "关联原因（简短描述，1-2句话）"
    }
  ]
}`,
    userPart: `你是笔记关联分析助手，请分析当前笔记与候选笔记之间的关联性。

当前笔记：
标题：{currentNoteTitle}
内容：{currentNoteContent}
分类：{currentNoteCategory}
标签：{currentNoteTags}

候选笔记列表：
{candidateNotesList}

请严格按照以下 JSON 格式返回，不要包含任何其他文本：
{
  "relations": [
    {
      "noteId": "笔记ID（从候选笔记列表中复制）",
      "similarity": 0.0-1.0的数字,
      "reason": "关联原因（简短描述，1-2句话）"
    }
  ]
}

相似度评分标准：
- 0.8-1.0：强关联（相同主题、延续性、因果关系、直接引用）
- 0.5-0.7：中等关联（相关领域、引用关系、共同背景）
- 0.2-0.4：弱关联（间接相关、时间相近、可能有关）
- 0.0-0.1：无关联（基本无关，不建议创建关联）

关联类型参考：
- 主题延续：同一主题的不同阶段或进展
- 因果关系：一个笔记是另一个的结果或原因
- 引用关系：明确提及另一个笔记的内容
- 相关领域：同一大主题下的不同方面
- 时间相近：同一天或连续几天的相关活动
- 共同背景：同一项目、同一会议、同一次出行等

关联原因要求：
- 简洁明了，1-2句话
- 说明为什么这两个笔记相关
- 帮助用户快速理解关联意义

注意事项：
- 只返回相似度 >= 0.2 的关联
- 按相似度从高到低排序
- 最多返回 5 个关联
- 如果没有足够相关的笔记，返回空数组 {"relations": []}
- noteId 必须从候选笔记列表中复制，不要自己编造`,
    variables: [
      {
        name: 'currentNoteTitle',
        description: '当前笔记标题',
        required: true,
        placeholder: '{currentNoteTitle}',
      },
      {
        name: 'currentNoteContent',
        description: '当前笔记内容',
        required: true,
        placeholder: '{currentNoteContent}',
      },
      {
        name: 'currentNoteCategory',
        description: '当前笔记分类',
        required: false,
        placeholder: '{currentNoteCategory}',
      },
      {
        name: 'currentNoteTags',
        description: '当前笔记标签',
        required: false,
        placeholder: '{currentNoteTags}',
      },
      {
        name: 'candidateNotesList',
        description: '候选笔记列表',
        required: true,
        placeholder: '{candidateNotesList}',
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
      case 'extract_tasks':
        prompt = EXTRACT_TASKS_PROMPT
        break
      case 'auto_completion_analysis':
        prompt = AUTO_COMPLETION_ANALYSIS_PROMPT
        break
      default:
        prompt = CLASSIFY_NOTE_PROMPT
    }

    return this.replaceVariables(prompt, variables)
  }
}

export const promptService = new PromptService()
