/**
 * useNotes Hook
 * 用于获取笔记列表的自定义 Hook
 */
import { useQuery } from '@tanstack/react-query'
import { notesApi } from '@/lib/api'

export interface UseNotesParams {
  category?: string
  tags?: string[]
  date?: Date
  page?: number
  pageSize?: number
  dateFilterMode?: 'createdAt' | 'updatedAt' | 'both'
}

export function useNotes(params?: UseNotesParams) {
  return useQuery({
    queryKey: ['notes', params],
    queryFn: () => notesApi.list(params),
    select: (response) => ({
      notes: response.data?.notes || [],
      total: response.data?.total || 0,
    }),
  })
}
