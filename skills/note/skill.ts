/**
 * Note Skill - 工具函数
 * 提供笔记 CRUD 操作的函数接口
 */

import type {
  ApiResponse,
  NoteBlock,
  CreateNoteRequest,
  UpdateNoteRequest,
  ListNotesFilters,
} from './types'
import { apiClient } from './api-client'

/**
 * 创建笔记
 *
 * @param request - 笔记数据（content 必填，其他可选）
 * @returns 创建的笔记（含自动生成的字段）
 *
 * @example
 * // 创建简单笔记
 * const note = await createNote({ content: 'Buy groceries' })
 *
 * @example
 * // 创建带分类和标签的笔记
 * const note = await createNote({
 *   content: 'Complete project report',
 *   category: 'work',
 *   tags: ['important', 'deadline'],
 * })
 */
export async function createNote(
  request: CreateNoteRequest
): Promise<NoteBlock> {
  const response = await apiClient.post<NoteBlock>('/api/notes', request)

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to create note')
  }

  return response.data
}

/**
 * 获取笔记列表
 *
 * @param filters - 可选筛选条件（日期、分类、标签、分页）
 * @returns 分页的笔记列表和总数
 *
 * @example
 * // 获取所有笔记
 * const { notes, total } = await listNotes()
 *
 * @example
 * // 按日期筛选
 * const result = await listNotes({ date: '2026-01-30' })
 *
 * @example
 * // 按分类筛选
 * const result = await listNotes({ category: 'work' })
 *
 * @example
 * // 按标签筛选
 * const result = await listNotes({ tags: ['important', 'todo'] })
 */
export async function listNotes(
  filters?: ListNotesFilters
): Promise<{ notes: NoteBlock[]; total: number }> {
  const response = await apiClient.get<{ notes: NoteBlock[]; total: number }>(
    '/api/notes',
    {
      date: filters?.date,
      category: filters?.category,
      tags: filters?.tags,
      page: filters?.page,
      pageSize: filters?.pageSize,
    }
  )

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to list notes')
  }

  return {
    notes: response.data.notes,
    total: response.data.total,
  }
}

/**
 * 获取单条笔记
 *
 * @param id - 笔记唯一标识符
 * @returns 请求的笔记
 * @throws Error 当笔记不存在或请求失败时
 *
 * @example
 * const note = await getNote('note-id-123')
 */
export async function getNote(id: string): Promise<NoteBlock> {
  const response = await apiClient.get<NoteBlock>(`/api/notes/${id}`)

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch note')
  }

  return response.data
}

/**
 * 更新笔记
 *
 * @param id - 笔记唯一标识符
 * @param request - 要更新的字段（content、category、tags、importance）
 * @returns 更新后的笔记
 * @throws Error 当笔记不存在或更新失败时
 *
 * @example
 * // 更新内容
 * const note = await updateNote('note-id-123', { content: 'Updated content' })
 *
 * @example
 * // 更新分类
 * const note = await updateNote('note-id-123', { category: 'personal' })
 *
 * @example
 * // 更新多个字段
 * const note = await updateNote('note-id-123', {
 *   content: 'Revised meeting notes',
 *   category: 'work',
 *   tags: ['meeting', 'action-items'],
 *   importance: 8
 * })
 */
export async function updateNote(
  id: string,
  request: UpdateNoteRequest
): Promise<NoteBlock> {
  const response = await apiClient.put<NoteBlock>(`/api/notes/${id}`, request)

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to update note')
  }

  return response.data
}

/**
 * 删除笔记（软删除）
 *
 * @param id - 笔记唯一标识符
 * @throws Error 当笔记不存在或删除失败时
 *
 * @example
 * await deleteNote('note-id-123')
 */
export async function deleteNote(id: string): Promise<void> {
  const response = await apiClient.delete<{ success: boolean }>(`/api/notes/${id}`)

  if (!response.success) {
    throw new Error(response.error || 'Failed to delete note')
  }
}

/**
 * 搜索笔记
 *
 * @param query - 搜索关键词
 * @returns 匹配的笔记数组
 * @throws Error 当搜索失败时
 *
 * @example
 * // 搜索包含 "meeting" 的笔记
 * const notes = await searchNotes('meeting')
 *
 * @example
 * // 多关键词搜索
 * const notes = await searchNotes('project deadline')
 */
export async function searchNotes(query: string): Promise<NoteBlock[]> {
  const response = await apiClient.get<NoteBlock[]>('/api/notes/search', {
    q: query,
  })

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to search notes')
  }

  return response.data
}
