/**
 * 工作流 API 路由
 *
 * 提供工作流配置的 CRUD 接口
 */
import type { FastifyInstance } from 'fastify'
import { workflowService } from '../../services/workflow.service'
import { getAllTaskTypeDefinitions } from '../../config/workflow-defaults'
import type {
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  CreateWorkflowStepRequest,
  UpdateWorkflowStepRequest,
  CreateWorkflowConnectionRequest,
  WorkflowImportRequest,
} from '@daily-note/shared'

export async function workflowRoutes(fastify: FastifyInstance) {
  // GET /api/workflow - 获取所有工作流配置列表
  fastify.get('/', async (request, reply) => {
    try {
      const workflows = await workflowService.getAllWorkflows()
      return {
        success: true,
        data: workflows,
      }
    } catch (error) {
      console.error('[WorkflowAPI] Error listing workflows:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to list workflows',
      }
    }
  })

  // GET /api/workflow/:trigger - 获取指定触发场景的工作流配置
  fastify.get<{ Params: { trigger: string } }>('/:trigger', async (request, reply) => {
    try {
      const { trigger } = request.params
      const workflow = await workflowService.getWorkflowByTrigger(trigger)

      if (!workflow) {
        reply.code(404)
        return {
          success: false,
          error: `Workflow not found for trigger: ${trigger}`,
        }
      }

      return {
        success: true,
        data: workflow,
      }
    } catch (error) {
      console.error('[WorkflowAPI] Error getting workflow:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to get workflow',
      }
    }
  })

  // POST /api/workflow - 创建新的工作流配置
  fastify.post<{ Body: CreateWorkflowRequest }>('/', async (request, reply) => {
    try {
      const data = request.body

      if (!data.trigger || !data.label) {
        reply.code(400)
        return {
          success: false,
          error: 'Missing required fields: trigger, label',
        }
      }

      const workflow = await workflowService.createWorkflow(data)
      return {
        success: true,
        data: workflow,
      }
    } catch (error) {
      console.error('[WorkflowAPI] Error creating workflow:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to create workflow',
      }
    }
  })

  // PUT /api/workflow/:id - 更新工作流配置
  fastify.put<{ Params: { id: string }; Body: UpdateWorkflowRequest }>(
    '/:id',
    async (request, reply) => {
      try {
        const { id } = request.params
        const data = request.body

        const workflow = await workflowService.updateWorkflow(id, data)
        return {
          success: true,
          data: workflow,
        }
      } catch (error) {
        console.error('[WorkflowAPI] Error updating workflow:', error)
        reply.code(500)
        return {
          success: false,
          error: 'Failed to update workflow',
        }
      }
    }
  )

  // DELETE /api/workflow/:id - 删除工作流配置
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const { id } = request.params
      await workflowService.deleteWorkflow(id)
      return {
        success: true,
        data: { id },
      }
    } catch (error) {
      console.error('[WorkflowAPI] Error deleting workflow:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to delete workflow',
      }
    }
  })

  // POST /api/workflow/:id/steps - 添加工作流步骤
  fastify.post<{ Params: { id: string }; Body: CreateWorkflowStepRequest }>(
    '/:id/steps',
    async (request, reply) => {
      try {
        const { id } = request.params
        const data = request.body

        if (!data.taskType || !data.label) {
          reply.code(400)
          return {
            success: false,
            error: 'Missing required fields: taskType, label',
          }
        }

        const step = await workflowService.addStep(id, data)
        return {
          success: true,
          data: step,
        }
      } catch (error) {
        console.error('[WorkflowAPI] Error adding step:', error)
        reply.code(500)
        return {
          success: false,
          error: 'Failed to add step',
        }
      }
    }
  )

  // PUT /api/workflow/steps/:stepId - 更新工作流步骤
  fastify.put<{ Params: { stepId: string }; Body: UpdateWorkflowStepRequest }>(
    '/steps/:stepId',
    async (request, reply) => {
      try {
        const { stepId } = request.params
        const data = request.body

        const step = await workflowService.updateStep(stepId, data)
        return {
          success: true,
          data: step,
        }
      } catch (error) {
        console.error('[WorkflowAPI] Error updating step:', error)
        reply.code(500)
        return {
          success: false,
          error: 'Failed to update step',
        }
      }
    }
  )

  // DELETE /api/workflow/steps/:stepId - 删除工作流步骤
  fastify.delete<{ Params: { stepId: string } }>('/steps/:stepId', async (request, reply) => {
    try {
      const { stepId } = request.params
      await workflowService.deleteStep(stepId)
      return {
        success: true,
        data: { stepId },
      }
    } catch (error) {
      console.error('[WorkflowAPI] Error deleting step:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to delete step',
      }
    }
  })

  // POST /api/workflow/:id/connections - 添加连线
  fastify.post<{ Params: { id: string }; Body: CreateWorkflowConnectionRequest }>(
    '/:id/connections',
    async (request, reply) => {
      try {
        const { id } = request.params
        const data = request.body

        if (!data.fromStepId || !data.toStepId) {
          reply.code(400)
          return {
            success: false,
            error: 'Missing required fields: fromStepId, toStepId',
          }
        }

        const connection = await workflowService.addConnection(id, data)
        return {
          success: true,
          data: connection,
        }
      } catch (error) {
        console.error('[WorkflowAPI] Error adding connection:', error)
        reply.code(500)
        return {
          success: false,
          error: 'Failed to add connection',
        }
      }
    }
  )

  // DELETE /api/workflow/connections/:connectionId - 删除连线
  fastify.delete<{ Params: { connectionId: string } }>(
    '/connections/:connectionId',
    async (request, reply) => {
      try {
        const { connectionId } = request.params
        await workflowService.deleteConnection(connectionId)
        return {
          success: true,
          data: { connectionId },
        }
      } catch (error) {
        console.error('[WorkflowAPI] Error deleting connection:', error)
        reply.code(500)
        return {
          success: false,
          error: 'Failed to delete connection',
        }
      }
    }
  )

  // POST /api/workflow/reset - 重置所有工作流为默认配置
  fastify.post('/reset', async (request, reply) => {
    try {
      await workflowService.resetToDefaults()
      return {
        success: true,
        data: { message: 'Workflows reset to defaults' },
      }
    } catch (error) {
      console.error('[WorkflowAPI] Error resetting workflows:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to reset workflows',
      }
    }
  })

  // GET /api/workflow/meta/task-types - 获取所有可用的任务类型
  fastify.get('/meta/task-types', async (request, reply) => {
    try {
      const taskTypes = getAllTaskTypeDefinitions()
      return {
        success: true,
        data: taskTypes,
      }
    } catch (error) {
      console.error('[WorkflowAPI] Error getting task types:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to get task types',
      }
    }
  })

  // GET /api/workflow/export - 导出所有工作流配置
  fastify.get('/export', async (request, reply) => {
    try {
      const exported = await workflowService.exportWorkflows()
      return {
        success: true,
        data: exported,
      }
    } catch (error) {
      console.error('[WorkflowAPI] Error exporting workflows:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to export workflows',
      }
    }
  })

  // POST /api/workflow/import - 导入工作流配置
  fastify.post<{ Body: WorkflowImportRequest }>('/import', async (request, reply) => {
    try {
      const { workflows, overwrite = false } = request.body

      if (!workflows || !Array.isArray(workflows)) {
        reply.code(400)
        return {
          success: false,
          error: 'Missing or invalid field: workflows (must be an array)',
        }
      }

      await workflowService.importWorkflows({ workflows, version: '1.0.0', exportedAt: new Date().toISOString() }, overwrite)
      return {
        success: true,
        data: { message: 'Workflows imported successfully' },
      }
    } catch (error) {
      console.error('[WorkflowAPI] Error importing workflows:', error)
      reply.code(500)
      return {
        success: false,
        error: 'Failed to import workflows',
      }
    }
  })
}
