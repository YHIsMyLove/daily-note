/**
 * 统计 API 路由
 */
import { FastifyInstance } from 'fastify'
import { getActivityData, getStatsSummary, getMonthlyActivityData, getHourlyActivityData } from '../../services/stats.service'
import { ActivityMode } from '@daily-note/shared'

export async function statsRoutes(fastify: FastifyInstance) {
  // 获取统计数据摘要
  fastify.get('/api/stats/summary', async (request, reply) => {
    try {
      const data = await getStatsSummary()

      return reply.send({
        success: true,
        data,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch stats summary',
      })
    }
  })

  // 获取活跃度数据
  fastify.get('/api/activity', async (request, reply) => {
    try {
      // 解析查询参数
      const query = request.query as Record<string, string>

      const mode = (query.mode as ActivityMode) || 'year'
      const startDate = query.startDate
      const endDate = query.endDate

      // 验证 mode 参数
      if (!['year', 'month', 'week', 'day'].includes(mode)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid mode parameter. Must be one of: year, month, week, day',
        })
      }

      // 获取活跃度数据
      const data = await getActivityData(mode, startDate, endDate)

      return reply.send({
        success: true,
        data,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch activity data',
      })
    }
  })

  // 获取年度月度统计数据
  fastify.get('/api/activity/monthly', async (request, reply) => {
    try {
      const query = request.query as Record<string, string>
      const yearParam = query.year

      if (!yearParam) {
        return reply.status(400).send({
          success: false,
          error: 'Missing year parameter',
        })
      }

      const year = parseInt(yearParam, 10)
      if (isNaN(year)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid year parameter',
        })
      }

      const data = await getMonthlyActivityData(year)

      return reply.send({
        success: true,
        data,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch monthly activity data',
      })
    }
  })

  // 获取小时级统计数据
  fastify.get('/api/activity/hourly', async (request, reply) => {
    try {
      const query = request.query as Record<string, string>
      const dateParam = query.date

      if (!dateParam) {
        return reply.status(400).send({
          success: false,
          error: 'Missing date parameter',
        })
      }

      const date = new Date(dateParam)
      if (isNaN(date.getTime())) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid date parameter',
        })
      }

      const data = await getHourlyActivityData(date)

      return reply.send({
        success: true,
        data,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch hourly activity data',
      })
    }
  })
}
