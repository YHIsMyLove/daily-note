/**
 * SSE (Server-Sent Events) 服务
 *
 * 功能：
 * - 管理所有 SSE 客户端连接
 * - 广播任务状态变化事件
 * - 处理客户端断线清理
 */
import { FastifyReply } from 'fastify'

/**
 * SSE 事件类型
 */
export type SSEEventType =
  | 'task.created'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  | 'stats.updated'
  | 'todo.created'
  | 'todo.updated'
  | 'todo.deleted'

/**
 * SSE 事件数据
 */
export interface SSEEventData {
  taskId?: string
  todoId?: string
  type?: string
  noteId?: string
  status?: string
  result?: any
  error?: string
  [key: string]: any
}

/**
 * SSE 服务类
 */
class SSEService {
  private clients: Set<FastifyReply> = new Set()

  /**
   * 注册客户端连接
   */
  addClient(reply: FastifyReply) {
    this.clients.add(reply)
    console.log(`[SSE] Client connected. Total clients: ${this.clients.size}`)

    // 监听连接关闭事件
    reply.raw.on('close', () => {
      this.clients.delete(reply)
      console.log(`[SSE] Client disconnected. Total clients: ${this.clients.size}`)
    })
  }

  /**
   * 广播事件给所有客户端
   */
  broadcast(event: SSEEventType, data: SSEEventData) {
    const payload = JSON.stringify({
      ...data,
      timestamp: new Date().toISOString(),
    })

    console.log(`[SSE] Broadcasting ${event}:`, data)

    // SSE 格式: event: <event>\ndata: <data>\n\n
    const message = `event: ${event}\ndata: ${payload}\n\n`

    for (const client of this.clients) {
      try {
        if (client.raw.writable) {
          client.raw.write(message)
        } else {
          // 连接不可写，移除客户端
          this.clients.delete(client)
        }
      } catch (error) {
        console.error('[SSE] Failed to send event to client:', error)
        // 移除失效的客户端
        this.clients.delete(client)
      }
    }
  }

  /**
   * 获取当前连接的客户端数量
   */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * 关闭所有客户端连接
   */
  closeAll() {
    for (const client of this.clients) {
      try {
        client.raw.end()
      } catch (error) {
        console.error('[SSE] Error closing client:', error)
      }
    }
    this.clients.clear()
    console.log('[SSE] All clients disconnected')
  }
}

/**
 * 导出单例
 */
export const sseService = new SSEService()
