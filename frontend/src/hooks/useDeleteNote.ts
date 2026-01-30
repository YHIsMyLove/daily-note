/**
 * useDeleteNote Hook
 * 用于删除笔记的自定义 Hook，支持乐观更新
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notesApi } from '@/lib/api'

export function useDeleteNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await notesApi.delete(id)
      return id
    },

    // 乐观更新：在发送请求前立即从缓存中移除
    onMutate: async (id) => {
      // 取消正在进行的查询，避免覆盖我们的乐观更新
      await queryClient.cancelQueries({ queryKey: ['notes'] })

      // 保存之前的快照，用于错误时回滚
      const previousNotes = queryClient.getQueryData(['notes'])

      // 乐观更新缓存：从列表中移除该笔记
      queryClient.setQueryData(['notes'], (old: any) => {
        if (!old?.data?.notes) {
          return old
        }

        return {
          data: {
            notes: old.data.notes.filter((note: any) => note.id !== id),
            total: Math.max(0, old.data.total - 1),
          },
        }
      })

      // 返回上下文，包含之前的快照和被删除的笔记 ID
      return { previousNotes, deletedId: id }
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
