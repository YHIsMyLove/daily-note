/**
 * 知识图谱 API 路由
 * 提供图谱数据查询接口
 */
import { FastifyInstance } from 'fastify'
import { graphService } from '../../services/graph.service'
import { GraphFilters } from '@daily-note/shared'

export async function graphRoutes(fastify: FastifyInstance) {
  // 获取图谱数据
  fastify.get('/api/graph', async (request, reply) => {
    try {
      const query = request.query as any

      // 构建过滤器对象
      const filters: GraphFilters = {}

      // 支持多分类参数（兼容单分类）
      if (query.categories) {
        if (Array.isArray(query.categories)) {
          filters.categories = query.categories
        } else {
          filters.categories = [query.categories]
        }
      } else if (query.category) {
        // 兼容 category 单数参数
        filters.categories = [query.category]
      }

      // 支持多标签参数（兼容单标签）
      if (query.tags) {
        if (Array.isArray(query.tags)) {
          filters.tags = query.tags
        } else {
          filters.tags = [query.tags]
        }
      }

      // 日期范围过滤
      if (query.dateFrom) {
        filters.dateFrom = query.dateFrom
      }
      if (query.dateTo) {
        filters.dateTo = query.dateTo
      }

      // 相似度阈值
      if (query.minSimilarity !== undefined) {
        filters.minSimilarity = parseFloat(query.minSimilarity)
      }

      // 重要性阈值
      if (query.minImportance !== undefined) {
        filters.minImportance = parseFloat(query.minImportance)
      }

      // 节点数量限制
      if (query.limit !== undefined) {
        filters.limit = parseInt(query.limit)
      }

      // 情感过滤
      if (query.sentiment) {
        filters.sentiment = query.sentiment
      }

      // 调用服务获取图谱数据
      const graphData = await graphService.getGraphData(filters)

      return reply.send({
        success: true,
        data: graphData,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch graph data',
      })
    }
  })
}
