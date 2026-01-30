/**
 * useCreateNote Hook
 * 用于创建笔记的自定义 Hook，支持乐观更新
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notesApi } from '@/lib/api'
import { NoteBlock } from '@daily-note/shared'

export interface CreateNoteVariables {
  content: string
  date?: Date
  category?: string
  tags?: string[]
  importance?: number
}

export function useCreateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (variables: CreateNoteVariables) => {
      const response = await notesApi.create(
        variables.content,
        variables.date,
        {
          category: variables.category,
          tags: variables.tags,
          importance: variables.importance,
        }
      )
      return response.data
    },

    // 乐观更新：在发送请求前立即更新缓存
    onMutate: async (variables) => {
      // 取消正在进行的查询，避免覆盖我们的乐观更新
      await queryClient.cancelQueries({ queryKey: ['notes'] })

      // 保存之前的快照，用于错误时回滚
      const previousNotes = queryClient.getQueryData(['notes'])

      // 创建乐观笔记对象
      const optimisticNote: NoteBlock = {
        id: `temp-${Date.now()}`, // 临时 ID
        content: variables.content,
        date: variables.date || new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        category: variables.category,
        tags: variables.tags || [],
        importance: variables.importance,
      }

      // 乐观更新缓存
      queryClient.setQueryData(['notes'], (old: any) => {
        if (!old?.data?.notes) {
          return {
            data: {
              notes: [optimisticNote],
              total: 1,
            },
          }
        }

        return {
          data: {
            notes: [optimisticNote, ...old.data.notes],
            total: old.data.total + 1,
          },
        }
      })

      // 返回上下文，包含之前的快照和乐观笔记
      return { previousNotes, optimisticNote }
    },

    // 错误时回滚
    onError: (error, variables, context) => {
      // 恢复之前的快照
      if (context?.previousNotes) {
        queryClient.setQueryData(['notes'], context.previousNotes)
      }
    },

    // 成功后刷新查询以确保数据一致性
    onSuccess: () => {
      // 使缓存失效，触发重新查询以获取真实数据
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      // 同时刷新任务统计
      queryClient.invalidateQueries({ queryKey: ['tasks-stats'] })
    },
  })
}
