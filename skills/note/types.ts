/**
 * Note Skill 类型定义
 * 聚焦基础 CRUD 功能
 */

// ===== API 响应包装 =====

/**
 * 标准 API 响应格式
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ===== 笔记类型 =====

/**
 * 笔记块（完整定义）
 */
export interface NoteBlock {
  id: string
  content: string
  date: Date
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date

  // LLM 处理结果
  category?: string
  tags?: string[]
  summary?: string
  sentiment?: 'positive' | 'neutral' | 'negative'

  // 关联信息
  relatedNotes?: string[]
  importance?: number

  // 元数据
  metadata?: {
    wordCount?: number
  }

  // 匹配来源标记
  matchSource?: 'createdAt' | 'updatedAt' | null
}

/**
 * 创建笔记请求
 */
export interface CreateNoteRequest {
  content: string
  date?: Date
  category?: string
  tags?: string[]
  importance?: number
}

/**
 * 更新笔记请求
 */
export interface UpdateNoteRequest {
  content?: string
  category?: string
  tags?: string[]
  importance?: number
}

/**
 * 笔记列表筛选器
 */
export interface ListNotesFilters {
  date?: string
  category?: string
  tags?: string[]
  page?: number
  pageSize?: number
}

// ===== Skill 配置 =====

/**
 * Skill 配置选项
 */
export interface NoteSkillConfig {
  apiBaseUrl: string
  timeout?: number
  retries?: number
}

/**
 * 默认配置
 */
export const DEFAULT_SKILL_CONFIG: NoteSkillConfig = {
  apiBaseUrl: 'http://localhost:3001',
  timeout: 30000,
  retries: 3,
}
