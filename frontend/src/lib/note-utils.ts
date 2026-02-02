import { NoteBlock } from '@daily-note/shared'

/**
 * 笔记类型枚举
 */
export enum NoteType {
  /**
   * 片段笔记 - 短笔记，使用行内编辑
   */
  Fragment = 'fragment',
  /**
   * 长篇笔记 - 内容丰富的笔记，使用专用编辑器
   */
  LongForm = 'long-form',
}

/**
 * 笔记分类配置
 */
interface NoteClassificationConfig {
  /**
   * 字符数阈值，超过此阈值视为长篇笔记
   * @default 200
   */
  charThreshold?: number
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<NoteClassificationConfig> = {
  charThreshold: 200,
}

/**
 * 分类笔记类型
 *
 * 根据笔记内容的字符数判断笔记类型：
 * - 字符数 <= 阈值：片段笔记 (fragment)
 * - 字符数 > 阈值：长篇笔记 (long-form)
 *
 * @param note - 笔记对象
 * @param config - 分类配置
 * @returns 笔记类型
 *
 * @example
 * ```ts
 * import { NoteBlock } from '@daily-note/shared'
 * import { classifyNoteType, NoteType } from '@/lib/note-utils'
 *
 * const note: NoteBlock = {
 *   id: '1',
 *   content: '这是一条短笔记',
 *   // ...其他字段
 * }
 *
 * const type = classifyNoteType(note)
 * console.log(type) // NoteType.Fragment
 * ```
 */
export function classifyNoteType(
  note: NoteBlock | Pick<NoteBlock, 'content'>,
  config: NoteClassificationConfig = {},
): NoteType {
  const { charThreshold = DEFAULT_CONFIG.charThreshold } = config

  // 计算内容字符数（去除空白字符）
  const charCount = note.content.trim().length

  return charCount > charThreshold ? NoteType.LongForm : NoteType.Fragment
}

/**
 * 检查是否为片段笔记
 *
 * @param note - 笔记对象
 * @param config - 分类配置
 * @returns 是否为片段笔记
 */
export function isFragmentNote(
  note: NoteBlock | Pick<NoteBlock, 'content'>,
  config?: NoteClassificationConfig,
): boolean {
  return classifyNoteType(note, config) === NoteType.Fragment
}

/**
 * 检查是否为长篇笔记
 *
 * @param note - 笔记对象
 * @param config - 分类配置
 * @returns 是否为长篇笔记
 */
export function isLongFormNote(
  note: NoteBlock | Pick<NoteBlock, 'content'>,
  config?: NoteClassificationConfig,
): boolean {
  return classifyNoteType(note, config) === NoteType.LongForm
}

/**
 * 获取笔记字符数（去除空白字符）
 *
 * @param note - 笔记对象
 * @returns 字符数
 */
export function getNoteCharCount(note: Pick<NoteBlock, 'content'>): number {
  return note.content.trim().length
}
