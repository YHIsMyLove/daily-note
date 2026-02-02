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
你是任务分析助手，请分析笔记内容并决定对已有任务执行什么操作。

笔记内容：
{content}

已有任务列表：
{existingTasks}

请严格按照以下 JSON 格式返回，不要包含任何其他文本：
{
  "operations": [
    {
      "action": "create",
      "task": {
        "title": "任务标题（简短明确）",
        "description": "任务详细描述（可选）",
        "priority": "high|medium|low",
        "dueDate": "ISO日期字符串或null（如：2024-01-15）",
        "status": "pending|completed",
        "subtasks": [
          {
            "title": "子任务标题",
            "description": "子任务描述（可选）",
            "dueDate": "ISO日期字符串或null"
          }
        ]
      }
    },
    {
      "action": "update",
      "taskId": "任务ID",
      "updates": {
        "status": "PENDING|COMPLETED",
        "completedAt": "ISO日期时间字符串（仅当status为COMPLETED时需要）"
      }
    },
    {
      "action": "delete",
      "taskId": "任务ID"
    },
    {
      "action": "skip",
      "taskId": "任务ID"
    }
  ]
}

操作类型说明：

1. **create**（创建新任务）：
   - 笔记内容中新出现的任务
   - 不能与任何已有任务匹配
   - 必须包含完整的 task 信息

2. **update**（更新已有任务）：
   - 笔记中提到"完成了XXX"、"已做完XXX" → 将对应任务标记为 COMPLETED
   - 任务状态发生变化，如从待办变为已完成
   - 必须提供 taskId 和更新的字段

3. **delete**（删除任务）：
   - 笔记明确说明"不需要做XXX"、"取消XXX"、"不再需要XXX"
   - 任务已失去意义或不再相关
   - 谨慎使用，仅在明确表示取消时才删除

4. **skip**（保持不变）：
   - 任务没有变化，保持原样
   - 最常见的情况

任务匹配规则：
- 优先通过任务标题的语义相似性进行匹配
- 考虑任务描述的相似性
- 同一个任务的表述可能略有不同（如"完成周报"和"周报撰写"）
- 如果存在多个相似任务，选择最相关的一个

任务状态判断规则：
- **已完成**（completed/COMPLETED）：
  * "完成"、"已完成"、"做了"、"搞定"、"解决"、"处理了"、"办了"、"弄好"
  * "已经"、"已"等表示完成的时间标记
  * 过去时态的表述，如"昨天发了邮件"、"上午开了会"
- **待办**（pending/PENDING）：
  * "需要"、"要"、"准备"、"计划"、"打算"
  * 未来时间标记，如"明天"、"下周"、"下午3点前"
  * 祈使句，如"完成报告"、"联系客户"

优先级判断：
- high：有明确截止日期、重要紧急、影响重大
- medium：需要完成但不紧急、常规任务
- low：可选事项、参考性任务

截止日期提取：
- 从笔记内容中提取明确的时间信息
- 如"明天"、"下周"、"12月15日"
- 如无明确时间则返回 null

复杂任务拆分规则：
- 判断标准：任务包含多个明确的步骤、有序列词、可分解为独立单元
- 拆分结构：父任务（概括性）+ 子任务（具体步骤），最多2级
- 子任务数量：通常2-5个，避免过度拆分

示例：

**示例 1：首次分析（无已有任务）**

输入：
笔记："明天下午3点前完成周报"
已有任务：[]

输出：
{
  "operations": [
    {
      "action": "create",
      "task": {
        "title": "完成周报",
        "priority": "high",
        "dueDate": "2024-01-16",
        "status": "pending",
        "subtasks": []
      }
    }
  ]
}

**示例 2：更新状态（已有任务）**

输入：
笔记："今天完成了周报撰写"
已有任务：
- ID: task-1, 标题: "完成周报", 状态: PENDING

输出：
{
  "operations": [
    {
      "action": "update",
      "taskId": "task-1",
      "updates": {
        "status": "COMPLETED",
        "completedAt": "2024-01-15T18:00:00Z"
      }
    }
  ]
}

**示例 3：混合场景**

输入：
笔记："今天完成了周报。明天下午3点前完成月度总结。客户会议取消了。"
已有任务：
- ID: task-1, 标题: "完成周报", 状态: PENDING
- ID: task-2, 标题: "客户会议", 状态: PENDING
- ID: task-3, 标题: "代码审查", 状态: PENDING

输出：
{
  "operations": [
    {
      "action": "update",
      "taskId": "task-1",
      "updates": {
        "status": "COMPLETED",
        "completedAt": "2024-01-15T18:00:00Z"
      }
    },
    {
      "action": "create",
      "task": {
        "title": "月度总结",
        "priority": "high",
        "dueDate": "2024-01-16",
        "status": "pending",
        "subtasks": []
      }
    },
    {
      "action": "delete",
      "taskId": "task-2"
    },
    {
      "action": "skip",
      "taskId": "task-3"
    }
  ]
}

**示例 4：复杂任务拆分**

输入：
笔记："明天下午3点前完成周报，需要收集本周项目进度、整理下周计划、制作数据图表。"
已有任务：[]

输出：
{
  "operations": [
    {
      "action": "create",
      "task": {
        "title": "完成周报",
        "description": "收集项目进度、整理计划、制作图表",
        "priority": "high",
        "dueDate": "2024-01-16",
        "status": "pending",
        "subtasks": [
          {
            "title": "收集本周项目进度",
            "description": "向各项目负责人收集进度更新"
          },
          {
            "title": "整理下周计划",
            "description": "汇总各项目下周的工作安排"
          },
          {
            "title": "制作数据图表",
            "description": "根据收集的数据制作可视化图表"
          }
        ]
      }
    }
  ]
}

注意事项：
- 每个已有任务最多对应一个操作
- 如果笔记中没有提到某个已有任务，使用 skip 保持不变
- 如果笔记没有任务相关内容，返回空数组 {"operations": []}
- 完成时间使用当前时间（ISO格式）
- 已完成任务不应该被删除（除非用户明确取消）
`

export const AUTO_COMPLETION_ANALYSIS_PROMPT = `
你是任务自动补全分析助手，请分析以下任务是否可以由 AI 自动完成。

任务信息：
{task}

请严格按照以下 JSON 格式返回，不要包含任何其他文本：
{
  "canAutoComplete": true/false,
  "confidence": 0-100的数字,
  "approach": "完成任务的详细方法描述",
  "estimatedSteps": ["步骤1", "步骤2", "步骤3"],
  "estimatedTime": "预计耗时（如：5-10分钟）",
  "requirements": ["需求1", "需求2"],
  "risks": ["风险1", "风险2"]
}

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
5. 给出置信度评分和详细执行方案
`
