/**
 * 提示词模板 API 路由
 */
import type { FastifyInstance } from 'fastify'
import { promptService } from '../../services/prompt.service'

export async function promptsRoutes(fastify: FastifyInstance) {
  // GET /api/prompts - 获取提示词列表
  fastify.get('/', async (request, reply) => {
    try {
      const templates = await promptService.listTemplates()
      return {
        success: true,
        data: templates,
      }
    } catch (error) {
      console.error('[PromptsAPI] Error listing templates:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to list prompt templates',
      }
    }
  })

  // GET /api/prompts/:key - 获取提示词详情
  fastify.get<{ Params: { key: string } }>('/:key', async (request, reply) => {
    try {
      const { key } = request.params
      const template = await promptService.getTemplate(key)

      if (!template) {
        reply.code(404)
        return {
          success: false,
          error: `Prompt template not found: ${key}`,
        }
      }

      return {
        success: true,
        data: template,
      }
    } catch (error) {
      console.error('[PromptsAPI] Error getting template:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to get prompt template',
      }
    }
  })

  // POST /api/prompts - 创建新提示词
  fastify.post<{
    Body: {
      key: string
      name: string
      description?: string
      systemPart: string
      userPart: string
      variables: Array<{
        name: string
        description: string
        required: boolean
        placeholder: string
      }>
    }
  }>('/', async (request, reply) => {
    try {
      const body = request.body

      if (!body.key || !body.name || !body.systemPart || !body.userPart) {
        reply.code(400)
        return {
          success: false,
          error: 'Missing required fields: key, name, systemPart, userPart',
        }
      }

      const template = await promptService.createTemplate({
        key: body.key,
        name: body.name,
        description: body.description,
        systemPart: body.systemPart,
        userPart: body.userPart,
        variables: body.variables || [],
      })

      return {
        success: true,
        data: template,
      }
    } catch (error) {
      console.error('[PromptsAPI] Error creating template:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to create prompt template',
      }
    }
  })

  // PUT /api/prompts/:key - 更新提示词
  fastify.put<{
    Params: { key: string }
    Body: { userPart: string }
  }>('/:key', async (request, reply) => {
    try {
      const { key } = request.params
      const { userPart } = request.body

      if (!userPart) {
        reply.code(400)
        return {
          success: false,
          error: 'Missing required field: userPart',
        }
      }

      await promptService.updateTemplate(key, userPart)

      return {
        success: true,
      }
    } catch (error) {
      console.error('[PromptsAPI] Error updating template:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to update prompt template',
      }
    }
  })

  // DELETE /api/prompts/:key - 删除提示词
  fastify.delete<{ Params: { key: string } }>('/:key', async (request, reply) => {
    try {
      const { key } = request.params
      await promptService.deleteTemplate(key)

      return {
        success: true,
      }
    } catch (error) {
      console.error('[PromptsAPI] Error deleting template:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to delete prompt template',
      }
    }
  })

  // POST /api/prompts/:key/reset - 恢复默认提示词
  fastify.post<{ Params: { key: string } }>('/:key/reset', async (request, reply) => {
    try {
      const { key } = request.params
      const template = await promptService.resetToDefault(key)

      return {
        success: true,
        data: template,
      }
    } catch (error) {
      console.error('[PromptsAPI] Error resetting template:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to reset prompt template',
      }
    }
  })

  // GET /api/prompts/:key/preview - 预览提示词
  fastify.get<{
    Params: { key: string }
    Querystring: Record<string, any>
  }>('/:key/preview', async (request, reply) => {
    try {
      const { key } = request.params
      const sampleData = request.query

      const preview = await promptService.previewTemplate(key, sampleData)

      return {
        success: true,
        data: { preview },
      }
    } catch (error) {
      console.error('[PromptsAPI] Error previewing template:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to preview prompt template',
      }
    }
  })
}
