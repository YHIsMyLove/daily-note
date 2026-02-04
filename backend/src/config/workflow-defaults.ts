/**
 * 默认工作流配置
 *
 * 定义系统预置的工作流配置，包括：
 * - 触发场景
 * - 任务节点
 * - 节点连线
 */

import type { WorkflowTrigger } from '@daily-note/shared'

/**
 * 任务类型定义
 */
export const AVAILABLE_TASK_TYPES = [
  {
    type: 'classify_note',
    label: '笔记分类',
    description: '使用 AI 对笔记进行分类、打标签、情感分析和重要性评分',
    icon: '📝',
    category: 'analysis',
  },
  {
    type: 'extract_todo_tasks',
    label: '提取待办',
    description: '从笔记内容中提取待办事项和任务',
    icon: '📋',
    category: 'extraction',
  },
  {
    type: 'analyze_relations',
    label: '关联分析',
    description: '分析笔记之间的关联关系，构建知识图谱',
    icon: '🔗',
    category: 'analysis',
  },
  {
    type: 'summary_analyzer',
    label: '总结分析',
    description: '对指定时间范围的笔记进行汇总分析',
    icon: '📊',
    category: 'summary',
  },
  {
    type: 'auto_complete_todo',
    label: '待办自动完成',
    description: 'AI 分析并自动完成符合条件的待办事项',
    icon: '✅',
    category: 'automation',
  },
] as const

/**
 * 默认工作流配置数据
 */
export const DEFAULT_WORKFLOWS: Array<{
  trigger: WorkflowTrigger
  label: string
  description?: string
  enabled: boolean
  steps: Array<{
    taskType: string
    label: string
    enabled: boolean
    priority: number
    position: number
    dependencies: string[]
    nodeX: number
    nodeY: number
  }>
  connections: Array<{
    fromPosition: number
    toPosition: number
    condition?: string
  }>
}> = [
  {
    trigger: 'note_created',
    label: '笔记创建时',
    description: '新笔记创建后自动执行的 AI 分析流程',
    enabled: true,
    steps: [
      {
        taskType: 'classify_note',
        label: '笔记分类',
        enabled: true,
        priority: 10,
        position: 0,
        dependencies: [],
        nodeX: 100,
        nodeY: 100,
      },
      {
        taskType: 'extract_todo_tasks',
        label: '提取待办',
        enabled: true,
        priority: 8,
        position: 1,
        dependencies: [],
        nodeX: 300,
        nodeY: 50,
      },
      {
        taskType: 'analyze_relations',
        label: '关联分析',
        enabled: true,
        priority: 5,
        position: 2,
        dependencies: ['0'], // 依赖 classify_note (position 0)
        nodeX: 500,
        nodeY: 100,
      },
    ],
    connections: [
      {
        fromPosition: 0,
        toPosition: 2,
      },
    ],
  },
  {
    trigger: 'note_updated',
    label: '笔记更新时',
    description: '笔记内容更新后执行的 AI 任务',
    enabled: true,
    steps: [
      {
        taskType: 'extract_todo_tasks',
        label: '提取待办',
        enabled: true,
        priority: 8,
        position: 0,
        dependencies: [],
        nodeX: 200,
        nodeY: 100,
      },
    ],
    connections: [],
  },
  {
    trigger: 'note_deleted',
    label: '笔记删除时',
    description: '笔记被删除时的处理流程（通常不执行 AI 任务）',
    enabled: true,
    steps: [],
    connections: [],
  },
  {
    trigger: 'manual_analysis',
    label: '手动分析时',
    description: '用户手动触发分析时执行的流程',
    enabled: true,
    steps: [
      {
        taskType: 'classify_note',
        label: '笔记分类',
        enabled: true,
        priority: 10,
        position: 0,
        dependencies: [],
        nodeX: 150,
        nodeY: 100,
      },
      {
        taskType: 'extract_todo_tasks',
        label: '提取待办',
        enabled: true,
        priority: 8,
        position: 1,
        dependencies: [],
        nodeX: 350,
        nodeY: 100,
      },
    ],
    connections: [],
  },
]

/**
 * 获取任务类型定义
 */
export function getTaskTypeDefinition(type: string) {
  return AVAILABLE_TASK_TYPES.find((t) => t.type === type)
}

/**
 * 获取所有任务类型定义
 */
export function getAllTaskTypeDefinitions() {
  return AVAILABLE_TASK_TYPES
}
