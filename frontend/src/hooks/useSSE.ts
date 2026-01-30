/**
 * SSE React Hook
 *
 * 功能：
 * - 管理 SSE 连接生命周期
 * - 提供事件监听接口
 * - 支持降级到轮询模式
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { sseClient, SSEEventType, SSEEventData } from '@/lib/sse'

/**
 * SSE 连接状态
 */
export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * useSSE Hook 返回值
 */
interface UseSSEReturn {
  connectionState: SSEConnectionState
  isConnected: boolean
  events: SSEEventData[]
  clearEvents: () => void
  reconnect: () => void
}

/**
 * useSSE Hook
 *
 * @param url - SSE 服务器地址
 * @param callbacks - 事件回调函数
 */
export function useSSE(
  url?: string,
  callbacks?: {
    onTaskCreated?: (data: SSEEventData) => void
    onTaskStarted?: (data: SSEEventData) => void
    onTaskCompleted?: (data: SSEEventData) => void
    onTaskFailed?: (data: SSEEventData) => void
    onTaskCancelled?: (data: SSEEventData) => void
    onStatsUpdated?: (data: SSEEventData) => void
    onTodoCreated?: (data: SSEEventData) => void
    onTodoUpdated?: (data: SSEEventData) => void
    onTodoDeleted?: (data: SSEEventData) => void
    onTodoCompleted?: (data: SSEEventData) => void
  }
): UseSSEReturn {
  const queryClient = useQueryClient()
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected')
  const [events, setEvents] = useState<SSEEventData[]>([])
  const callbacksRef = useRef(callbacks)

  // 更新回调引用
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  // 清除事件列表
  const clearEvents = useCallback(() => {
    setEvents([])
  }, [])

  // 重新连接
  const reconnect = useCallback(() => {
    sseClient.close()
    setConnectionState('connecting')
    setTimeout(() => {
      sseClient.connect(url)
    }, 100)
  }, [url])

  useEffect(() => {
    let mounted = true

    // 连接到 SSE 服务器
    setConnectionState('connecting')
    const es = sseClient.connect(url)

    if (!es) {
      setConnectionState('error')
      return
    }

    // 监听连接状态
    const onOpen = () => {
      if (mounted) {
        setConnectionState('connected')
      }
    }

    const onError = () => {
      if (mounted) {
        setConnectionState('error')
      }
    }

    es.onopen = onOpen
    es.onerror = onError

    // 监听连接成功事件
    const unsubscribeConnected = sseClient.on('connected', (data) => {
      console.log('[SSE] Connected:', data)
      if (mounted) {
        setConnectionState('connected')
      }
    })

    // 监听任务创建事件
    const unsubscribeTaskCreated = sseClient.on('task.created', (data) => {
      console.log('[SSE] Task created:', data)
      if (mounted) {
        setEvents((prev) => [...prev, { ...data, eventType: 'task.created' }])
        // 刷新任务统计
        queryClient.invalidateQueries({ queryKey: ['tasks-stats'] })
      }
    })

    // 监听任务开始事件
    const unsubscribeTaskStarted = sseClient.on('task.started', (data) => {
      console.log('[SSE] Task started:', data)
      if (mounted) {
        setEvents((prev) => [...prev, { ...data, eventType: 'task.started' }])
        // 刷新任务统计
        queryClient.invalidateQueries({ queryKey: ['tasks-stats'] })
        callbacksRef.current?.onTaskStarted?.(data)
      }
    })

    // 监听任务完成事件
    const unsubscribeTaskCompleted = sseClient.on('task.completed', (data) => {
      console.log('[SSE] Task completed:', data)
      if (mounted) {
        setEvents((prev) => [...prev, { ...data, eventType: 'task.completed' }])
        // 刷新笔记列表和任务统计
        queryClient.invalidateQueries({ queryKey: ['notes'] })
        queryClient.invalidateQueries({ queryKey: ['tasks-stats'] })
        callbacksRef.current?.onTaskCompleted?.(data)
      }
    })

    // 监听任务失败事件
    const unsubscribeTaskFailed = sseClient.on('task.failed', (data) => {
      console.log('[SSE] Task failed:', data)
      if (mounted) {
        setEvents((prev) => [...prev, { ...data, eventType: 'task.failed' }])
        // 刷新任务统计
        queryClient.invalidateQueries({ queryKey: ['tasks-stats'] })
        callbacksRef.current?.onTaskFailed?.(data)
      }
    })

    // 监听任务取消事件
    const unsubscribeTaskCancelled = sseClient.on('task.cancelled', (data) => {
      console.log('[SSE] Task cancelled:', data)
      if (mounted) {
        setEvents((prev) => [...prev, { ...data, eventType: 'task.cancelled' }])
        // 刷新任务统计
        queryClient.invalidateQueries({ queryKey: ['tasks-stats'] })
      }
    })

    // 监听统计更新事件
    const unsubscribeStatsUpdated = sseClient.on('stats.updated', (data) => {
      console.log('[SSE] Stats updated:', data)
      if (mounted) {
        setEvents((prev) => [...prev, { ...data, eventType: 'stats.updated' }])
        // 更新查询缓存
        queryClient.setQueryData(['tasks-stats'], {
          success: true,
          data,
        })
        callbacksRef.current?.onStatsUpdated?.(data)
      }
    })

    // 监听待办创建事件
    const unsubscribeTodoCreated = sseClient.on('todo.created', (data) => {
      console.log('[SSE] Todo created:', data)
      if (mounted) {
        setEvents((prev) => [...prev, { ...data, eventType: 'todo.created' }])
        // 刷新待办列表
        queryClient.invalidateQueries({ queryKey: ['todos'] })
        callbacksRef.current?.onTodoCreated?.(data)
      }
    })

    // 监听待办更新事件
    const unsubscribeTodoUpdated = sseClient.on('todo.updated', (data) => {
      console.log('[SSE] Todo updated:', data)
      if (mounted) {
        setEvents((prev) => [...prev, { ...data, eventType: 'todo.updated' }])
        // 刷新待办列表
        queryClient.invalidateQueries({ queryKey: ['todos'] })
        callbacksRef.current?.onTodoUpdated?.(data)
      }
    })

    // 监听待办删除事件
    const unsubscribeTodoDeleted = sseClient.on('todo.deleted', (data) => {
      console.log('[SSE] Todo deleted:', data)
      if (mounted) {
        setEvents((prev) => [...prev, { ...data, eventType: 'todo.deleted' }])
        // 刷新待办列表
        queryClient.invalidateQueries({ queryKey: ['todos'] })
        callbacksRef.current?.onTodoDeleted?.(data)
      }
    })

    // 监听待办完成事件
    const unsubscribeTodoCompleted = sseClient.on('todo.completed', (data) => {
      console.log('[SSE] Todo completed:', data)
      if (mounted) {
        setEvents((prev) => [...prev, { ...data, eventType: 'todo.completed' }])
        // 刷新待办列表
        queryClient.invalidateQueries({ queryKey: ['todos'] })
        callbacksRef.current?.onTodoCompleted?.(data)
      }
    })

    // 清理函数
    return () => {
      mounted = false
      unsubscribeConnected()
      unsubscribeTaskCreated()
      unsubscribeTaskStarted()
      unsubscribeTaskCompleted()
      unsubscribeTaskFailed()
      unsubscribeTaskCancelled()
      unsubscribeStatsUpdated()
      unsubscribeTodoCreated()
      unsubscribeTodoUpdated()
      unsubscribeTodoDeleted()
      unsubscribeTodoCompleted()
      sseClient.close()
    }
  }, [url, queryClient])

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    events,
    clearEvents,
    reconnect,
  }
}
