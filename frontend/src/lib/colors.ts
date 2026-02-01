/**
 * Color Utilities Module
 * 颜色工具模块 - 提供统一的颜色获取函数，基于 CSS 变量系统
 *
 * This module provides a centralized Color system for categories and tags.
 * The Color assignment is deterministic - the same name always gets the same Color.
 *
 * @see globals.css for CSS variable definitions (--category-*)
 */

/**
 * Color Name Enum
 * 颜色名称枚举 - 对应 globals.css 中定义的 --category-* CSS 变量
 *
 * Available Color options for category and tag assignment.
 * Each Color name maps to a CSS variable defined in the global stylesheet.
 */
export const CATEGORY_COLORS = [
  'blue',
  'orange',
  'purple',
  'green',
  'pink',
  'cyan',
  'yellow',
  'red',
] as const

export type CategoryColorName = typeof CATEGORY_COLORS[number]

/**
 * 根据名称计算哈希值
 * 确保相同的名称始终获得相同的颜色
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

/**
 * 获取分类或标签的颜色名称
 * 使用哈希算法确保相同名称始终获得相同颜色
 *
 * @param name - 分类或标签名称
 * @returns 颜色名称 (blue, orange, purple, etc.)
 */
export function getColorName(name: string): CategoryColorName {
  const hash = hashString(name)
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length]
}

/**
 * 获取分类或标签的颜色
 * 优先使用存储的自定义颜色，否则使用哈希计算的颜色名称
 *
 * @param name - 分类或标签名称
 * @param storedColor - 存储的自定义颜色（HSL 格式，如 "217 91% 60%"）
 * @returns 颜色对象，包含 hsl 值和可选的颜色名称
 */
export function getItemColor(name: string, storedColor?: string): { hsl: string; colorName?: CategoryColorName } {
  if (storedColor) {
    return { hsl: storedColor }
  }
  const colorName = getColorName(name)
  return { hsl: `var(--category-${colorName})`, colorName }
}

/**
 * 获取分类徽章的 Tailwind 类名
 * 返回背景色、文本色和边框色的组合
 *
 * @param name - 分类名称
 * @param storedColor - 存储的自定义颜色（可选）
 * @returns Tailwind 类名字符串
 *
 * @example
 * ```tsx
 * const badgeClass = getCategoryColorClass('工作总结')
 * // => "bg-category-blue/15 text-category-blue/90 border border-category-blue/25"
 * ```
 */
export function getCategoryColorClass(name: string, storedColor?: string): string {
  if (storedColor) {
    // 自定义颜色使用内联样式
    return ''
  }
  const colorName = getColorName(name)
  return `bg-category-${colorName}/15 text-category-${colorName}/90 border border-category-${colorName}/25`
}

/**
 * 获取标签徽章的 Tailwind 类名
 * 返回背景色、文本色和边框色的组合，包含 hover 状态
 *
 * @param name - 标签名称
 * @param storedColor - 存储的自定义颜色（可选）
 * @returns Tailwind 类名字符串
 *
 * @example
 * ```tsx
 * const badgeClass = getTagColorClass('重要')
 * // => "bg-category-purple/20 text-category-purple/90 border border-category-purple/30 hover:bg-category-purple/30"
 * ```
 */
export function getTagColorClass(name: string, storedColor?: string): string {
  if (storedColor) {
    // 自定义颜色使用内联样式
    return ''
  }
  const colorName = getColorName(name)
  return `bg-category-${colorName}/20 text-category-${colorName}/90 border border-category-${colorName}/30 hover:bg-category-${colorName}/30`
}

/**
 * 获取分类或标签的文本颜色类名
 * 仅返回文本颜色，用于需要单独控制文本颜色的场景
 *
 * @param name - 分类或标签名称
 * @param storedColor - 存储的自定义颜色（可选）
 * @returns 文本颜色的 Tailwind 类名
 *
 * @example
 * ```tsx
 * const textColor = getTextColorClass('工作总结')
 * // => "text-category-blue/90"
 * ```
 */
export function getTextColorClass(name: string, storedColor?: string): string {
  if (storedColor) {
    return ''
  }
  const colorName = getColorName(name)
  return `text-category-${colorName}/90`
}

/**
 * 获取分类或标签的背景颜色类名
 * 仅返回背景颜色，用于需要单独控制背景颜色的场景
 *
 * @param name - 分类或标签名称
 * @param opacity - 背景透明度 (10-90)，默认 15
 * @param storedColor - 存储的自定义颜色（可选）
 * @returns 背景颜色的 Tailwind 类名
 *
 * @example
 * ```tsx
 * const bgColor = getBgColorClass('工作总结', 20)
 * // => "bg-category-blue/20"
 * ```
 */
export function getBgColorClass(name: string, opacity: number = 15, storedColor?: string): string {
  if (storedColor) {
    return ''
  }
  const colorName = getColorName(name)
  return `bg-category-${colorName}/${opacity}`
}

/**
 * 获取分类或标签的边框颜色类名
 * 仅返回边框颜色，用于需要单独控制边框颜色的场景
 *
 * @param name - 分类或标签名称
 * @param opacity - 边框透明度 (10-90)，默认 25
 * @param storedColor - 存储的自定义颜色（可选）
 * @returns 边框颜色的 Tailwind 类名
 *
 * @example
 * ```tsx
 * const borderColor = getBorderColorClass('工作总结', 30)
 * // => "border-category-blue/30"
 * ```
 */
export function getBorderColorClass(name: string, opacity: number = 25, storedColor?: string): string {
  if (storedColor) {
    return ''
  }
  const colorName = getColorName(name)
  return `border-category-${colorName}/${opacity}`
}

/**
 * 获取完整的分类徽章样式对象
 * 返回包含所有样式属性的完整对象，用于内联样式
 *
 * @param name - 分类或标签名称
 * @param storedColor - 存储的自定义颜色（可选）
 * @returns 样式对象
 *
 * @example
 * ```tsx
 * const style = getCategoryColorStyle('工作总结')
 * // => { backgroundColor: 'hsl(var(--category-blue) / 0.15)', ... }
 * ```
 */
export function getCategoryColorStyle(name: string, storedColor?: string): React.CSSProperties {
  if (storedColor) {
    return {
      backgroundColor: `hsl(${storedColor} / 0.15)`,
      color: `hsl(${storedColor} / 0.9)`,
      borderColor: `hsl(${storedColor} / 0.25)`,
    }
  }
  const colorName = getColorName(name)
  return {
    backgroundColor: `hsl(var(--category-${colorName}) / 0.15)`,
    color: `hsl(var(--category-${colorName}) / 0.9)`,
    borderColor: `hsl(var(--category-${colorName}) / 0.25)`,
  }
}
