/**
 * 工作流流程图样式配置
 *
 * 定义 vis-network 的颜色、节点样式、连线样式等
 * 所有颜色值与系统主题保持一致
 */

import type { WorkflowStep, PipelineNode } from '@daily-note/shared'

/**
 * 任务类型到 Lucide 图标名称的映射
 * 注意：由于 vis-network 限制，实际渲染时使用 SVG 路径而非 React 组件
 */
export const TASK_TYPE_ICONS: Record<string, string> = {
  classify_note: 'FileText',
  extract_todo_tasks: 'CheckSquare',
  analyze_relations: 'Share2',
  summary_analyzer: 'BarChart3',
  auto_complete_todo: 'CheckCircle',
} as const

/**
 * 任务类型到图标的 Unicode 映射
 * 用于在节点中显示图标
 */
export const TASK_TYPE_ICON_UNICODE: Record<string, string> = {
  classify_note: '\ue800',      // FileText
  extract_todo_tasks: '\ue801',  // CheckSquare
  analyze_relations: '\ue802',   // Share2
  summary_analyzer: '\ue803',    // BarChart3
  auto_complete_todo: '\ue804',  // CheckCircle
} as const

/**
 * 任务类型到颜色的映射（使用系统分类颜色）
 * HSL 格式，与 globals.css 中的 CSS 变量保持一致
 */
export const TASK_TYPE_COLORS: Record<string, string> = {
  classify_note: 'hsl(217 91% 60%)',    // blue
  extract_todo_tasks: 'hsl(48 96% 53%)', // yellow
  analyze_relations: 'hsl(271 81% 56%)', // purple
  summary_analyzer: 'hsl(142 76% 36%)',  // green (primary)
  auto_complete_todo: 'hsl(188 94% 43%)', // cyan
} as const

/**
 * 系统主题颜色常量
 * 从 globals.css 的 CSS 变量中提取
 */
export const THEME_COLORS = {
  // 背景色
  background: 'hsl(0 0% 8%)',      // --background
  card: 'hsl(0 0% 12%)',           // --card

  // 文本色
  foreground: 'hsl(0 0% 95%)',     // --foreground
  textPrimary: 'hsl(0 0% 95%)',    // --text-primary
  textSecondary: 'hsl(0 0% 70%)',  // --text-secondary
  textMuted: 'hsl(0 0% 50%)',      // --text-muted
  textDisabled: 'hsl(0 0% 35%)',   // --text-disabled

  // 边框和强调色
  border: 'hsl(0 0% 20%)',         // --border
  accent: 'hsl(0 0% 25%)',         // --accent
  primary: 'hsl(142 76% 36%)',     // --primary (GitHub 绿)
  primaryHover: 'hsl(142 76% 50%)', // --primary hover

  // 禁用状态
  disabledBg: 'hsl(0 0% 10%)',
  disabledBorder: 'hsl(0 0% 15%)',
} as const

/**
 * 获取任务类型对应的颜色
 * 如果任务类型未定义，返回默认蓝色
 */
export function getTaskTypeColor(taskType: string): string {
  return TASK_TYPE_COLORS[taskType] || 'hsl(217 91% 60%)'
}

/**
 * 获取节点的 vis-network 样式配置
 * 根据节点启用状态返回不同的样式
 */
export function getNodeStyle(step: WorkflowStep) {
  const taskColor = getTaskTypeColor(step.taskType)

  if (step.enabled) {
    return {
      // 深色背景 + 彩色边框 + 浅色文本
      background: THEME_COLORS.card,
      border: taskColor,
      font: {
        color: THEME_COLORS.textPrimary,
        size: 13,
      },
      borderWidth: 2,
      shadow: {
        enabled: true,
        color: 'rgba(0, 0, 0, 0.4)',
        size: 8,
        x: 2,
        y: 2,
      },
    }
  } else {
    return {
      // 灰色禁用状态
      background: THEME_COLORS.disabledBg,
      border: THEME_COLORS.disabledBorder,
      font: {
        color: THEME_COLORS.textDisabled,
        size: 13,
      },
      borderWidth: 2,
      shadow: {
        enabled: false,
      },
    }
  }
}

/**
 * 提示词图标 Unicode
 */
export const PROMPT_ICON = '\uf15b' // 类似 FileText 的图标

/**
 * 获取节点标签文本
 * 包含图标和标签名称
 * 如果配置了提示词模板，会显示提示词图标
 */
export function getNodeLabel(step: WorkflowStep): string {
  const icon = TASK_TYPE_ICON_UNICODE[step.taskType] || '•'
  const status = step.enabled ? '' : ' (已禁用)'
  // 如果配置了自定义提示词，添加提示词图标
  const hasPromptKey = step.config?.promptKey
  const promptIndicator = hasPromptKey ? ' 📝' : ''
  return `${icon} ${step.label}${status}${promptIndicator}`
}

/**
 * 获取节点标题（悬停提示）
 */
export function getNodeTitle(step: WorkflowStep): string {
  const status = step.enabled ? '启用' : '禁用'
  const colorName = getTaskColorName(step.taskType)
  let title = `类型: ${step.taskType}\n状态: ${status}\n优先级: ${step.priority}\n位置: ${step.position}\n颜色: ${colorName}`

  // 如果配置了自定义提示词，显示提示词信息
  if (step.config?.promptKey) {
    title += `\n提示词模板: ${step.config.promptKey}`
  }

  return title
}

/**
 * 获取任务类型的颜色名称
 */
function getTaskColorName(taskType: string): string {
  const names: Record<string, string> = {
    classify_note: '蓝色',
    extract_todo_tasks: '黄色',
    analyze_relations: '紫色',
    summary_analyzer: '绿色',
    auto_complete_todo: '青色',
  }
  return names[taskType] || '默认'
}

/**
 * vis-network 全局配置选项
 */
export const NETWORK_OPTIONS = {
  nodes: {
    shape: 'box' as const,
    margin: { top: 12, right: 12, bottom: 12, left: 12 },
    widthConstraint: { maximum: 180 },
    font: {
      size: 13,
      multi: true,
      color: THEME_COLORS.textPrimary,
    },
    borderWidth: 2,
    // 选中状态样式 - 仅边框颜色变化，不加粗
    borderWidthSelected: 2,
    // 悬停效果 - 仅边框颜色变化，背景不变
    color: {
      background: THEME_COLORS.card,
      border: THEME_COLORS.border,
      hover: {
        background: THEME_COLORS.card,
        border: THEME_COLORS.primary,
      },
      highlight: {
        background: THEME_COLORS.card,
        border: THEME_COLORS.primary,
      },
    },
  },
  edges: {
    width: 2,
    // 使用系统边框色和主色
    color: {
      color: THEME_COLORS.accent,         // 默认连线颜色
      highlight: THEME_COLORS.primary,    // 选中连线颜色
      hover: THEME_COLORS.primaryHover,   // 悬停连线颜色
    },
    arrows: {
      to: { enabled: true, scaleFactor: 0.7 },
    },
    smooth: {
      enabled: true,
      type: 'curvedCW',
      roundness: 0.2,
    },
    // 选中状态
    selectionWidth: 3,
  },
  layout: {
    randomSeed: 42,
    improvedLayout: true,
  },
  physics: {
    enabled: true,
    barnesHut: {
      gravitationalConstant: -2000,
      centralGravity: 0.3,
      springLength: 150,
      springConstant: 0.04,
      damping: 0.09,
      avoidOverlap: 0.5,
    },
  },
  interaction: {
    dragNodes: true,
    dragView: true,
    zoomView: true,
    selectable: true,
    hover: true,
    multiselect: false,
    hoverConnectedEdges: true,
  },
} as const

/**
 * 连线模式下的节点高亮颜色
 */
export const LINK_MODE_COLORS = {
  sourceNodeBorder: THEME_COLORS.primary,      // 源节点边框绿色高亮
  sourceNodeBackground: 'hsl(142 76% 36% / 0.1)', // 源节点背景淡绿
  targetHint: 'hsl(142 76% 50%)',               // 目标节点提示色
} as const

// ========== Pipeline 样式函数 ==========

/**
 * 提示词节点图标（统一使用文档图标）
 */
export const PROMPT_NODE_ICON = '📝'

/**
 * 获取 Pipeline 节点的 vis-network 样式配置
 * Pipeline 节点统一使用绿色边框（表示提示词）
 */
export function getPipelineNodeStyle(node: PipelineNode) {
  if (node.enabled) {
    return {
      // 深色背景 + 绿色边框（提示词统一色）+ 浅色文本
      background: THEME_COLORS.card,
      border: THEME_COLORS.primary, // 统一使用主题绿色
      font: {
        color: THEME_COLORS.textPrimary,
        size: 13,
      },
      borderWidth: 2,
      shadow: {
        enabled: true,
        color: 'rgba(20, 163, 119, 0.3)', // 绿色阴影
        size: 8,
        x: 2,
        y: 2,
      },
    }
  } else {
    return {
      // 灰色禁用状态
      background: THEME_COLORS.disabledBg,
      border: THEME_COLORS.disabledBorder,
      font: {
        color: THEME_COLORS.textDisabled,
        size: 13,
      },
      borderWidth: 2,
      shadow: {
        enabled: false,
      },
    }
  }
}

/**
 * 获取 Pipeline 节点标签文本
 */
export function getPipelineNodeLabel(node: PipelineNode): string {
  const status = node.enabled ? '' : ' (已禁用)'
  return `${PROMPT_NODE_ICON} ${node.promptName}${status}`
}

/**
 * 获取 Pipeline 节点标题（悬停提示）
 */
export function getPipelineNodeTitle(node: PipelineNode): string {
  const status = node.enabled ? '启用' : '禁用'
  const configInfo = node.config
    ? `\n配置: ${JSON.stringify(node.config, null, 2)}`
    : ''

  return `提示词: ${node.promptKey}\n名称: ${node.promptName}\n状态: ${status}${configInfo}`
}
