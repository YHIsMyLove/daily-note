/**
 * Pipeline API 路由
 *
 * 提示词管道（Pipeline）的 CRUD 和执行接口
 */
import { FastifyInstance } from 'fastify'
import { prisma } from '../../database/prisma'
import { pipelineExecutorService } from '../../services/pipeline-executor.service'
import type {
  Pipeline,
  PipelineDetail,
  CreatePipelineRequest,
  UpdatePipelineRequest,
  CreatePipelineNodeRequest,
  UpdatePipelineNodeRequest,
  CreatePipelineEdgeRequest,
  ExecutePipelineRequest,
} from '@daily-note/shared'

/**
 * 注册 Pipeline 路由
 */
export async function pipelineRoutes(fastify: FastifyInstance) {
  // ========== Pipeline CRUD ==========

  /**
   * 获取所有 Pipeline
   */
  fastify.get('/pipelines', async (request, reply) => {
    try {
      const pipelines = await prisma.pipeline.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              nodes: true,
              edges: true,
              executions: true,
            },
          },
        },
      })

      reply.send({
        success: true,
        data: pipelines,
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pipelines',
      })
    }
  })

  /**
   * 获取 Pipeline 详情
   */
  fastify.get('/pipelines/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      const pipeline = await prisma.pipeline.findUnique({
        where: { id },
        include: {
          nodes: {
            orderBy: { createdAt: 'asc' },
          },
          edges: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      if (!pipeline) {
        return reply.code(404).send({
          success: false,
          error: 'Pipeline not found',
        })
      }

      // 解析节点的 config 字段
      const nodes = pipeline.nodes.map((node) => ({
        ...node,
        config: node.config ? JSON.parse(node.config) : undefined,
        incomingEdges: pipeline.edges.filter(e => e.toNodeId === node.id),
        outgoingEdges: pipeline.edges.filter(e => e.fromNodeId === node.id),
      }))

      reply.send({
        success: true,
        data: {
          ...pipeline,
          nodes,
          edges: pipeline.edges,
        } as PipelineDetail,
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pipeline',
      })
    }
  })

  /**
   * 创建 Pipeline
   */
  fastify.post('/pipelines', async (request, reply) => {
    try {
      const body = request.body as CreatePipelineRequest

      // 验证名称唯一性
      const existing = await prisma.pipeline.findUnique({
        where: { name: body.name },
      })

      if (existing) {
        return reply.code(400).send({
          success: false,
          error: 'Pipeline with this name already exists',
        })
      }

      const pipeline = await prisma.pipeline.create({
        data: {
          name: body.name,
          description: body.description,
          trigger: body.trigger || 'manual',
        },
      })

      reply.code(201).send({
        success: true,
        data: pipeline as Pipeline,
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create pipeline',
      })
    }
  })

  /**
   * 更新 Pipeline
   */
  fastify.put('/pipelines/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as UpdatePipelineRequest

      // 验证名称唯一性（如果修改了名称）
      if (body.name) {
        const existing = await prisma.pipeline.findFirst({
          where: {
            name: body.name,
            NOT: { id },
          },
        })

        if (existing) {
          return reply.code(400).send({
            success: false,
            error: 'Pipeline with this name already exists',
          })
        }
      }

      const pipeline = await prisma.pipeline.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.trigger !== undefined && { trigger: body.trigger }),
          ...(body.enabled !== undefined && { enabled: body.enabled }),
        },
      })

      reply.send({
        success: true,
        data: pipeline as Pipeline,
      })
    } catch (error) {
      if ((error as any).code === 'P2025') {
        return reply.code(404).send({
          success: false,
          error: 'Pipeline not found',
        })
      }
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update pipeline',
      })
    }
  })

  /**
   * 删除 Pipeline
   */
  fastify.delete('/pipelines/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      await prisma.pipeline.delete({
        where: { id },
      })

      reply.send({
        success: true,
        data: { message: 'Pipeline deleted successfully' },
      })
    } catch (error) {
      if ((error as any).code === 'P2025') {
        return reply.code(404).send({
          success: false,
          error: 'Pipeline not found',
        })
      }
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete pipeline',
      })
    }
  })

  // ========== 节点操作 ==========

  /**
   * 添加节点
   */
  fastify.post('/pipelines/:id/nodes', async (request, reply) => {
    try {
      const { id: pipelineId } = request.params as { id: string }
      const body = request.body as CreatePipelineNodeRequest

      // 验证 Pipeline 存在
      const pipeline = await prisma.pipeline.findUnique({
        where: { id: pipelineId },
      })

      if (!pipeline) {
        return reply.code(404).send({
          success: false,
          error: 'Pipeline not found',
        })
      }

      // 验证提示词模板存在
      const prompt = await prisma.promptTemplate.findUnique({
        where: { key: body.promptKey },
      })

      if (!prompt) {
        return reply.code(400).send({
          success: false,
          error: `Prompt template not found: ${body.promptKey}`,
        })
      }

      const node = await prisma.pipelineNode.create({
        data: {
          pipelineId,
          promptKey: body.promptKey,
          promptName: body.promptName || prompt.name,
          enabled: body.enabled ?? true,
          config: body.config ? JSON.stringify(body.config) : null,
          nodeX: body.nodeX ?? 0,
          nodeY: body.nodeY ?? 0,
        },
      })

      // 解析 config
      const result = {
        ...node,
        config: body.config,
        incomingEdges: [],
        outgoingEdges: [],
      }

      reply.send({
        success: true,
        data: result,
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create node',
      })
    }
  })

  /**
   * 更新节点
   */
  fastify.put('/pipelines/:pipelineId/nodes/:nodeId', async (request, reply) => {
    try {
      const { nodeId } = request.params as { pipelineId: string; nodeId: string }
      const body = request.body as UpdatePipelineNodeRequest

      // 如果修改了 promptKey，验证模板存在
      if (body.promptKey) {
        const prompt = await prisma.promptTemplate.findUnique({
          where: { key: body.promptKey },
        })

        if (!prompt) {
          return reply.code(400).send({
            success: false,
            error: `Prompt template not found: ${body.promptKey}`,
          })
        }
      }

      const node = await prisma.pipelineNode.update({
        where: { id: nodeId },
        data: {
          ...(body.promptKey !== undefined && { promptKey: body.promptKey }),
          ...(body.promptName !== undefined && { promptName: body.promptName }),
          ...(body.enabled !== undefined && { enabled: body.enabled }),
          ...(body.config !== undefined && {
            config: body.config ? JSON.stringify(body.config) : null,
          }),
          ...(body.nodeX !== undefined && { nodeX: body.nodeX }),
          ...(body.nodeY !== undefined && { nodeY: body.nodeY }),
        },
      })

      // 解析 config
      const result = {
        ...node,
        config: body.config || (node.config ? JSON.parse(node.config) : undefined),
        incomingEdges: [],
        outgoingEdges: [],
      }

      reply.send({
        success: true,
        data: result,
      })
    } catch (error) {
      if ((error as any).code === 'P2025') {
        return reply.code(404).send({
          success: false,
          error: 'Node not found',
        })
      }
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update node',
      })
    }
  })

  /**
   * 删除节点
   */
  fastify.delete('/pipelines/:pipelineId/nodes/:nodeId', async (request, reply) => {
    try {
      const { nodeId } = request.params as { pipelineId: string; nodeId: string }

      await prisma.pipelineNode.delete({
        where: { id: nodeId },
      })

      reply.send({
        success: true,
        data: { message: 'Node deleted successfully' },
      })
    } catch (error) {
      if ((error as any).code === 'P2025') {
        return reply.code(404).send({
          success: false,
          error: 'Node not found',
        })
      }
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete node',
      })
    }
  })

  // ========== 连线操作 ==========

  /**
   * 添加连线
   */
  fastify.post('/pipelines/:id/edges', async (request, reply) => {
    try {
      const { id: pipelineId } = request.params as { id: string }
      const body = request.body as CreatePipelineEdgeRequest

      // 验证 Pipeline 存在
      const pipeline = await prisma.pipeline.findUnique({
        where: { id: pipelineId },
      })

      if (!pipeline) {
        return reply.code(404).send({
          success: false,
          error: 'Pipeline not found',
        })
      }

      // 验证节点存在
      const fromNode = await prisma.pipelineNode.findFirst({
        where: { id: body.fromNodeId, pipelineId },
      })

      const toNode = await prisma.pipelineNode.findFirst({
        where: { id: body.toNodeId, pipelineId },
      })

      if (!fromNode || !toNode) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid node IDs',
        })
      }

      // 检查是否已存在相同连线
      const existing = await prisma.pipelineEdge.findFirst({
        where: {
          pipelineId,
          fromNodeId: body.fromNodeId,
          toNodeId: body.toNodeId,
        },
      })

      if (existing) {
        return reply.code(400).send({
          success: false,
          error: 'Edge already exists',
        })
      }

      const edge = await prisma.pipelineEdge.create({
        data: {
          pipelineId,
          fromNodeId: body.fromNodeId,
          toNodeId: body.toNodeId,
          outputKey: body.outputKey || 'output',
          inputKey: body.inputKey || 'input',
          condition: body.condition,
        },
      })

      reply.send({
        success: true,
        data: edge,
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create edge',
      })
    }
  })

  /**
   * 删除连线
   */
  fastify.delete('/pipelines/:pipelineId/edges/:edgeId', async (request, reply) => {
    try {
      const { edgeId } = request.params as { pipelineId: string; edgeId: string }

      await prisma.pipelineEdge.delete({
        where: { id: edgeId },
      })

      reply.send({
        success: true,
        data: { message: 'Edge deleted successfully' },
      })
    } catch (error) {
      if ((error as any).code === 'P2025') {
        return reply.code(404).send({
          success: false,
          error: 'Edge not found',
        })
      }
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete edge',
      })
    }
  })

  // ========== 执行操作 ==========

  /**
   * 执行 Pipeline
   */
  fastify.post('/pipelines/:id/execute', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as ExecutePipelineRequest

      const executionId = await pipelineExecutorService.execute(
        id,
        body.inputData || {},
        body.triggerEvent || 'manual'
      )

      reply.send({
        success: true,
        data: {
          executionId,
          message: 'Pipeline execution started',
        },
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute pipeline',
      })
    }
  })

  /**
   * 获取执行状态
   */
  fastify.get('/pipelines/:pipelineId/status/:executionId', async (request, reply) => {
    try {
      const { executionId } = request.params as { pipelineId: string; executionId: string }

      const status = await pipelineExecutorService.getExecutionStatus(executionId)

      if (!status) {
        return reply.code(404).send({
          success: false,
          error: 'Execution not found',
        })
      }

      reply.send({
        success: true,
        data: status,
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch execution status',
      })
    }
  })

  /**
   * 取消执行
   */
  fastify.post('/pipelines/:pipelineId/cancel/:executionId', async (request, reply) => {
    try {
      const { executionId } = request.params as { pipelineId: string; executionId: string }

      await pipelineExecutorService.cancelExecution(executionId)

      reply.send({
        success: true,
        data: { message: 'Execution cancelled' },
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel execution',
      })
    }
  })

  /**
   * 获取 Pipeline 的执行历史
   */
  fastify.get('/pipelines/:id/executions', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { limit = '20', offset = '0' } = request.query as { limit?: string; offset?: string }

      const executions = await prisma.pipelineExecution.findMany({
        where: { pipelineId: id },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      })

      const total = await prisma.pipelineExecution.count({
        where: { pipelineId: id },
      })

      reply.send({
        success: true,
        data: {
          executions,
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch executions',
      })
    }
  })
}
