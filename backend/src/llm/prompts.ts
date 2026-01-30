/**
 * Prompt 模板
 * 用于 Claude API 调用
 */

export const CLASSIFY_NOTE_PROMPT = `
你是笔记整理助手，请分析以下笔记内容并返回结构化数据。

笔记内容：
{content}

现有分类（按使用频率排序）：
{existingCategories}

现有标签（按使用频率排序）：
{existingTags}

请严格按照以下 JSON 格式返回，不要包含任何其他文本：
{
  "category": "分类名称",
  "tags": ["标签1", "标签2", "标签3"],
  "summary": "一句话摘要",
  "sentiment": "positive|neutral|negative",
  "importance": 1-10的数字
}

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
- negative：消极负面、需要关注
`

export const ANALYZE_TRENDS_PROMPT = `
分析以下日期范围内的笔记趋势：

日期范围：{dateRange}
笔记数量：{noteCount}

分类分布：
{categoryDistribution}

标签分布：
{tagDistribution}

请返回以下 JSON 格式分析结果：
{
  "summary": "整体趋势摘要",
  "topCategories": ["最多出现的分类"],
  "emergingTopics": ["新兴话题或趋势"],
  "recommendations": ["基于趋势的建议"]
}
`

export const GENERATE_DAILY_SUMMARY_PROMPT = `
生成今日笔记总结：

日期：{date}
笔记总数：{noteCount}

按分类汇总：
{categorySummary}

今日重要笔记：
{importantNotes}

请返回以下 JSON 格式：
{
  "summary": "今日整体总结（2-3句话）",
  "keyAchievements": ["今日成就"],
  "pendingTasks": ["待完成任务"],
  "insights": ["今日感悟"]
}
`

export const EXTRACT_TASKS_PROMPT = `
你是任务提取助手，请从以下笔记内容中提取可执行的任务。

笔记内容：
{content}

请严格按照以下 JSON 格式返回，不要包含任何其他文本：
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
}

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
}
`
