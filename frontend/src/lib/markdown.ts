/**
 * Markdown 渲染和处理工具函数
 *
 * 提供安全的 Markdown 处理功能，包括序列化、反序列化和内容清理。
 */

/**
 * Markdown 处理配置
 */
export interface MarkdownConfig {
  /**
   * 是否允许 HTML 标签
   * @default false
   */
  allowHtml?: boolean

  /**
   * 是否跳过 sanitize
   * @default false
   * @warning 仅在可信内容中使用
   */
  skipSanitize?: boolean

  /**
   * 最大渲染长度（字符数）
   * @default 100000
   */
  maxLength?: number
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<Omit<MarkdownConfig, 'skipSanitize'>> & {
  skipSanitize: boolean
} = {
  allowHtml: false,
  skipSanitize: false,
  maxLength: 100000,
}

/**
 * 危险的 HTML 标签和属性黑名单
 * 用于防止 XSS 攻击
 */
const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
]

const DANGEROUS_ATTRS = [
  'onclick',
  'onload',
  'onerror',
  'onmouseover',
  'onfocus',
  'onblur',
  'onsubmit',
  'javascript:',
  'data:text/html',
]

/**
 * 清理 Markdown 内容，移除潜在危险的 HTML
 *
 * @param markdown - 原始 Markdown 内容
 * @param config - 处理配置
 * @returns 清理后的 Markdown 内容
 *
 * @example
 * ```ts
 * const safe = sanitizeMarkdown('# Hello <script>alert("xss")</script>')
 * // returns: '# Hello &lt;script&gt;alert("xss")&lt;/script&gt;'
 * ```
 */
export function sanitizeMarkdown(
  markdown: string,
  config: MarkdownConfig = {},
): string {
  const { allowHtml = DEFAULT_CONFIG.allowHtml } = config

  if (!markdown) return ''

  // 检查长度限制
  if (markdown.length > DEFAULT_CONFIG.maxLength) {
    markdown = markdown.slice(0, DEFAULT_CONFIG.maxLength)
  }

  // 如果不允许 HTML，转义 HTML 标签
  if (!allowHtml) {
    return markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  // 如果允许 HTML，执行更细致的清理
  let cleaned = markdown

  // 移除危险的标签
  DANGEROUS_TAGS.forEach((tag) => {
    const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gis')
    cleaned = cleaned.replace(regex, '')
  })

  // 移除自闭合的危险标签
  DANGEROUS_TAGS.forEach((tag) => {
    const regex = new RegExp(`<${tag}[^>]*/?>`, 'gis')
    cleaned = cleaned.replace(regex, '')
  })

  // 移除危险的属性
  DANGEROUS_ATTRS.forEach((attr) => {
    const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gis')
    cleaned = cleaned.replace(regex, '')
  })

  // 移除 javascript: 和 data: 协议
  cleaned = cleaned.replace(
    /href\s*=\s*["'](?:javascript|data|vbscript):[^"']*["']/gi,
    'href=""',
  )

  return cleaned
}

/**
 * 提取 Markdown 的纯文本预览
 *
 * 移除 Markdown 语法，返回纯文本内容用于预览显示。
 *
 * @param markdown - Markdown 内容
 * @param maxLength - 最大长度（默认 200 字符）
 * @returns 纯文本预览
 *
 * @example
 * ```ts
 * const preview = extractMarkdownPreview('# Hello\n\nThis is **bold** text', 50)
 * // returns: 'Hello This is bold text'
 * ```
 */
export function extractMarkdownPreview(
  markdown: string,
  maxLength: number = 200,
): string {
  if (!markdown) return ''

  // 移除标题标记
  let text = markdown.replace(/^#{1,6}\s+/gm, '')

  // 移除加粗、斜体、删除线标记
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1') // ***bold italic***
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1') // **bold**
  text = text.replace(/\*([^*]+)\*/g, '$1') // *italic*
  text = text.replace(/___([^_]+)___/g, '$1') // ___bold italic___
  text = text.replace(/__([^_]+)__/g, '$1') // __bold__
  text = text.replace(/_([^_]+)_/g, '$1') // _italic_
  text = text.replace(/~~([^~]+)~~/g, '$1') // ~~strikethrough~~

  // 移除链接但保留文本 [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 移除图片 ![alt](url) -> alt
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')

  // 移除代码块
  text = text.replace(/```[\s\S]*?```/g, '')
  text = text.replace(/`([^`]+)`/g, '$1')

  // 移除引用标记
  text = text.replace(/^>\s+/gm, '')

  // 移除列表标记
  text = text.replace(/^[\s]*[-*+]\s+/gm, '')
  text = text.replace(/^[\s]*\d+\.\s+/gm, '')

  // 移除水平线
  text = text.replace(/^[-*_]{3,}\s*$/gm, '')

  // 移除多余的空行
  text = text.replace(/\n{3,}/g, '\n\n')

  // 去除首尾空白
  text = text.trim()

  // 限制长度
  if (text.length > maxLength) {
    text = text.slice(0, maxLength - 3) + '...'
  }

  return text
}

/**
 * 验证 Markdown 内容是否有效
 *
 * @param markdown - Markdown 内容
 * @returns 是否有效
 */
export function isValidMarkdown(markdown: string): boolean {
  if (typeof markdown !== 'string') return false
  if (markdown.length > DEFAULT_CONFIG.maxLength) return false
  return true
}

/**
 * 检测 Markdown 内容中是否包含特定元素
 *
 * @param markdown - Markdown 内容
 * @param elementType - 要检测的元素类型
 * @returns 是否包含该元素
 *
 * @example
 * ```ts
 * const hasCode = containsMarkdownElement('```js\nconsole.log("hi")\n```', 'code')
 * // returns: true
 * ```
 */
export function containsMarkdownElement(
  markdown: string,
  elementType:
    | 'heading'
    | 'link'
    | 'image'
    | 'code'
    | 'list'
    | 'blockquote'
    | 'table',
): boolean {
  if (!markdown) return false

  const patterns: Record<typeof elementType, RegExp> = {
    heading: /^#{1,6}\s+/m,
    link: /\[([^\]]+)\]\([^)]+\)/,
    image: /!\[([^\]]*)\]\([^)]+\)/,
    code: /```[\s\S]*?```/,
    list: /^[\s]*[-*+]\s+|^\d+\.\s+/m,
    blockquote: /^>\s+/m,
    table: /\|.*\|/,
  }

  return patterns[elementType].test(markdown)
}

/**
 * 获取 Markdown 内容的统计信息
 *
 * @param markdown - Markdown 内容
 * @returns 统计信息
 *
 * @example
 * ```ts
 * const stats = getMarkdownStats('# Hello\n\n- item 1\n- item 2')
 * // returns: { headings: 1, lists: 1, codes: 0, links: 0, images: 0, wordCount: 3 }
 * ```
 */
export function getMarkdownStats(markdown: string): {
  headings: number
  lists: number
  codes: number
  links: number
  images: number
  wordCount: number
} {
  if (!markdown) {
    return {
      headings: 0,
      lists: 0,
      codes: 0,
      links: 0,
      images: 0,
      wordCount: 0,
    }
  }

  return {
    headings: (markdown.match(/^#{1,6}\s+/gm) || []).length,
    lists: (markdown.match(/^[\s]*[-*+]\s+|^\d+\.\s+/gm) || []).length,
    codes: (markdown.match(/```/g) || []).length / 2, // 代码块成对出现
    links: (markdown.match(/\[([^\]]+)\]\([^)]+\)/g) || []).length,
    images: (markdown.match(/!\[([^\]]*)\]\([^)]+\)/g) || []).length,
    wordCount: markdown.trim().split(/\s+/).filter(Boolean).length,
  }
}

/**
 * 处理 Markdown 内容用于显示
 *
 * 组合了清理和验证功能，是处理用户输入的主要入口点。
 *
 * @param markdown - 原始 Markdown 内容
 * @param config - 处理配置
 * @returns 处理后的 Markdown 内容，如果无效则返回空字符串
 */
export function processMarkdownForDisplay(
  markdown: string,
  config: MarkdownConfig = {},
): string {
  // 验证内容
  if (!isValidMarkdown(markdown)) {
    return ''
  }

  // 清理内容
  const cleaned = sanitizeMarkdown(markdown, config)

  return cleaned
}
