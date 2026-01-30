/**
 * SSE API 路由
 *
 * 提供：
 * - GET /api/sse - SSE 连接端点
 */
import { FastifyInstance } from 'fastify'
import { sseService } from '../../services/sse.service'

export async function sseRoutes(fastify: FastifyInstance) {
  /**
   * SSE 连接端点
   *
   * 客户端通过此端点建立 SSE 连接，接收实时任务状态更新
   */
  fastify.get('/api/sse', async (request, reply) => {
    // 设置 SSE 响应头
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')

    // 添加 CORS 响应头
    reply.raw.setHeader('Access-Control-Allow-Origin', '*')
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true')

    // 注册客户端
    sseService.addClient(reply)

    // 发送初始连接成功消息
    reply.raw.write(`event: connected\n`)
    reply.raw.write(`data: ${JSON.stringify({
      message: 'SSE connection established',
      timestamp: new Date().toISOString(),
    })}\n\n`)

    // 返回一个永不 resolve 的 Promise，保持连接打开
    return new Promise(() => {})
  })
}
