/**
 * SSE (Server-Sent Events) 客户端
 *
 * 功能：
 * - 管理 SSE 连接
 * - 自动重连
 * - 事件监听和分发
 * - 连接状态管理
 */

/**
 * SSE 事件类型
 */
export type SSEEventType =
  | 'connected'
  | 'task.created'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  | 'stats.updated'
  | 'todo.created'
  | 'todo.updated'
  | 'todo.deleted'
  | 'todo.completed'

/**
 * SSE 事件数据类型
 * 所有 SSE 事件的基础类型，包含事件类型和关联数据
 */
export interface SSEEventData {
  eventType: SSEEventType
  [key: string]: any
}

/**
 * SSE 事件监听器类型
 */
export type SSEEventListener = (data: any) => void

/**
 * SSE 客户端类
 */
class SSEClient {
  private eventSource: EventSource | null = null
  private listeners: Map<SSEEventType, Set<SSEEventListener>> = new Map()
  private reconnectTimer: NodeJS.Timeout | null = null
  private isManualClose: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 10
  private reconnectDelay: number = 1000 // 初始重连延迟 1 秒

  /**
   * 连接到 SSE 服务器
   */
  connect(url: string = 'http://localhost:3001/api/sse'): EventSource | null {
    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
      console.log('[SSE] Connection already established')
      return this.eventSource
    }

    console.log('[SSE] Connecting to:', url)

    try {
      this.eventSource = new EventSource(url)
      this.isManualClose = false
      this.setupEventHandlers()
      return this.eventSource
    } catch (error) {
      console.error('[SSE] Failed to connect:', error)
      this.scheduleReconnect(url)
      return null
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers() {
    if (!this.eventSource) return

    // 连接打开
    this.eventSource.onopen = () => {
      console.log('[SSE] Connection opened')
      this.reconnectAttempts = 0
      this.reconnectDelay = 1000
    }

    // 连接错误
    this.eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error)

      if (!this.isManualClose) {
        this.scheduleReconnect()
      }
    }

    // 监听所有注册的事件类型
    const eventTypes: SSEEventType[] = [
      'connected',
      'task.created',
      'task.started',
      'task.completed',
      'task.failed',
      'task.cancelled',
      'stats.updated',
      'todo.created',
      'todo.updated',
      'todo.deleted',
      'todo.completed',
    ]

    eventTypes.forEach((eventType) => {
      this.eventSource?.addEventListener(eventType, (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log(`[SSE] ${eventType}:`, data)
          this.emit(eventType, data)
        } catch (error) {
          console.error(`[SSE] Failed to parse ${eventType} event:`, error)
        }
      })
    })
  }

  /**
   * 监听事件
   */
  on(eventType: SSEEventType, listener: SSEEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(listener)

    // 返回取消监听函数
    return () => {
      this.off(eventType, listener)
    }
  }

  /**
   * 取消监听事件
   */
  off(eventType: SSEEventType, listener: SSEEventListener) {
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.listeners.delete(eventType)
      }
    }
  }

  /**
   * 触发事件
   */
  private emit(eventType: SSEEventType, data: any) {
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data)
        } catch (error) {
          console.error(`[SSE] Error in ${eventType} listener:`, error)
        }
      })
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(url?: string) {
    if (this.isManualClose) {
      return
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnect attempts reached')
      return
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
    console.log(`[SSE] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts + 1})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      if (url) {
        this.connect(url)
      } else {
        this.reconnect()
      }
    }, delay)
  }

  /**
   * 重新连接
   */
  private reconnect() {
    if (this.eventSource) {
      this.eventSource.close()
    }
    this.connect()
  }

  /**
   * 关闭连接
   */
  close() {
    this.isManualClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.listeners.clear()
    console.log('[SSE] Connection closed')
  }

  /**
   * 获取连接状态
   */
  getReadyState(): number {
    return this.eventSource?.readyState ?? EventSource.CLOSED
  }

  /**
   * 检查连接是否打开
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN
  }
}

/**
 * 导出单例
 */
export const sseClient = new SSEClient()

/**
 * 便捷函数：监听单个事件
 */
export function listenToSSE(
  eventType: SSEEventType,
  listener: SSEEventListener
): () => void {
  return sseClient.on(eventType, listener)
}
