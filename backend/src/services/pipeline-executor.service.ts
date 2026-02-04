/**
 * Pipeline 执行引擎服务
 *
 * 负责执行提示词管道（Pipeline），实现拓扑排序、节点执行、数据流转等核心逻辑
 *
 * 执行流程：
 * 1. 加载 Pipeline 配置
 * 2. 构建执行图（节点 + 边）
 * 3. 拓扑排序确定执行顺序
 * 4. 按顺序执行节点（每个节点调用提示词执行器）
 * 5. 数据流转：前一个节点的输出作为下一个节点的输入
 */
import { prisma } from '../database/prisma'
import { claudeService } from '../llm/claude.service'
import { sseService } from './sse.service'
import type {
  PipelineDetail,
  PipelineNode,
  PipelineEdge,
  PipelineExecutionStatus,
  PipelineNodeExecutionStatus,
} from '@daily-note/shared'

/**
 * 执行图数据结构
 */
interface ExecutionGraph {
  nodes: Map<string, PipelineNode>
  edges: PipelineEdge[]
  inEdges: Map<string, PipelineEdge[]>  // 每个节点的入边
  outEdges: Map<string, PipelineEdge[]> // 每个节点的出边
}

/**
 * 执行上下文
 */
interface ExecutionContext {
  pipelineId: string
  executionId: string
  initialInput: any
  nodeResults: Map<string, any>
  currentStatus: PipelineExecutionStatus
}

/**
 * 提示词节点执行结果
 */
interface PromptNodeResult {
  success: boolean
  data?: any
  error?: string
}

export class PipelineExecutorService {
  /**
   * 执行 Pipeline
   */
  async execute(
    pipelineId: string,
    triggerData: any,
    triggerEvent: string = 'manual'
  ): Promise<string> {
    // 1. 加载 Pipeline 配置
    const pipeline = await this.loadPipeline(pipelineId)
    if (!pipeline || !pipeline.enabled) {
      throw new Error('Pipeline not found or disabled')
    }

    // 2. 创建执行记录
    const execution = await prisma.pipelineExecution.create({
      data: {
        pipelineId,
        triggerEvent,
        status: 'pending',
        inputData: JSON.stringify(triggerData),
      },
    })

    const executionId = execution.id

    // 3. 构建执行图
    const graph = this.buildExecutionGraph(pipeline)

    // 4. 拓扑排序
    const executionOrder = this.topologicalSort(graph)

    console.log(`[Pipeline] Starting execution: ${executionId}`)
    console.log(`[Pipeline] Execution order: ${executionOrder.join(' -> ')}`)

    // 5. 更新执行状态为 running
    await prisma.pipelineExecution.update({
      where: { id: executionId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    })

    // SSE 推送：Pipeline 开始执行
    await sseService.broadcast('pipeline.started', {
      executionId,
      pipelineId,
      pipelineName: pipeline.name,
      triggerEvent,
    })

    // 6. 启动执行（异步）
    this.executeNodes(
      executionId,
      executionOrder,
      graph,
      triggerData,
      0
    ).catch(async (error) => {
      console.error(`[Pipeline] Execution failed: ${executionId}`, error)
      await this.completeExecution(executionId, 'failed', undefined, error.message)
    })

    return executionId
  }

  /**
   * 执行节点序列（异步）
   */
  private async executeNodes(
    executionId: string,
    executionOrder: string[],
    graph: ExecutionGraph,
    currentInput: any,
    currentIndex: number
  ): Promise<void> {
    // 检查是否所有节点都已执行完毕
    if (currentIndex >= executionOrder.length) {
      await this.completeExecution(executionId, 'completed', currentInput)
      return
    }

    const nodeId = executionOrder[currentIndex]
    const node = graph.nodes.get(nodeId)

    if (!node) {
      throw new Error(`Node not found: ${nodeId}`)
    }

    // 检查节点是否启用
    if (!node.enabled) {
      console.log(`[Pipeline] Skipping disabled node: ${nodeId}`)

      // 标记节点为跳过状态
      await prisma.pipelineNodeExecution.create({
        data: {
          executionId,
          nodeId,
          status: 'skipped',
          inputData: JSON.stringify(currentInput),
          completedAt: new Date(),
        },
      })

      // 继续执行下一个节点
      return this.executeNodes(
        executionId,
        executionOrder,
        graph,
        currentInput,
        currentIndex + 1
      )
    }

    console.log(`[Pipeline] Executing node: ${nodeId} (${node.promptKey})`)

    // 创建节点执行记录
    const nodeExecution = await prisma.pipelineNodeExecution.create({
      data: {
        executionId,
        nodeId,
        status: 'running',
        inputData: JSON.stringify(currentInput),
        startedAt: new Date(),
      },
    })

    try {
      // 获取入边，准备节点输入
      const inEdges = graph.inEdges.get(nodeId) || []
      const nodeInput = this.prepareNodeInput(currentInput, inEdges, graph)

      // 执行节点
      const result = await this.executeNode(node, nodeInput)

      // 更新节点执行记录
      await prisma.pipelineNodeExecution.update({
        where: { id: nodeExecution.id },
        data: {
          status: 'completed',
          outputData: JSON.stringify(result),
          completedAt: new Date(),
        },
      })

      // SSE 推送：节点完成
      await sseService.broadcast('pipeline.node_completed', {
        executionId,
        nodeId,
        promptKey: node.promptKey,
        result,
      })

      // 继续执行下一个节点
      return this.executeNodes(
        executionId,
        executionOrder,
        graph,
        result,
        currentIndex + 1
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Pipeline] Node execution failed: ${nodeId}`, error)

      // 更新节点执行记录为失败
      await prisma.pipelineNodeExecution.update({
        where: { id: nodeExecution.id },
        data: {
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
        },
      })

      // 节点执行失败，终止 Pipeline
      throw error
    }
  }

  /**
   * 执行单个节点
   */
  private async executeNode(node: PipelineNode, input: any): Promise<any> {
    // 1. 获取提示词模板
    const prompt = await prisma.promptTemplate.findUnique({
      where: { key: node.promptKey },
    })

    if (!prompt) {
      throw new Error(`Prompt template not found: ${node.promptKey}`)
    }

    // 2. 获取节点配置（已在 loadPipeline 中解析为对象）
    const config = node.config || {}

    // 3. 替换变量
    const userPart = this.replaceVariables(prompt.userPart, input)
    const systemPart = prompt.systemPart || undefined

    // 4. 调用 Claude API
    const model = config.model || 'claude-3-5-sonnet-20241022'
    const maxTokens = config.maxTokens || 4096
    const temperature = config.temperature ?? 0.7

    const message = await claudeService['client'].messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPart,
      messages: [{ role: 'user', content: userPart }],
    })

    // 5. 解析响应
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    return this.parseResponse(responseText)
  }

  /**
   * 准备节点输入（合并所有入边的数据）
   */
  private prepareNodeInput(
    previousOutput: any,
    inEdges: PipelineEdge[],
    graph: ExecutionGraph
  ): any {
    if (inEdges.length === 0) {
      return previousOutput
    }

    const input: any = {
      _input: previousOutput,
    }

    // 从每条入边提取数据
    for (const edge of inEdges) {
      const outputKey = edge.outputKey || 'output'
      const inputKey = edge.inputKey || `input_${edge.fromNodeId}`

      // 尝试从 previousOutput 中提取数据
      if (previousOutput && typeof previousOutput === 'object') {
        input[inputKey] = previousOutput[outputKey] !== undefined
          ? previousOutput[outputKey]
          : previousOutput
      } else {
        input[inputKey] = previousOutput
      }
    }

    return input
  }

  /**
   * 替换模板变量
   * 支持 {{variable}} 和 {{path.to.value}} 语法
   */
  private replaceVariables(template: string, input: any): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const keys = path.trim().split('.')
      let value = input

      for (const key of keys) {
        if (value && typeof value === 'object') {
          value = value[key]
        } else {
          return ''
        }
      }

      return value !== undefined && value !== null ? String(value) : ''
    })
  }

  /**
   * 解析响应（尝试 JSON 解析）
   */
  private parseResponse(text: string): any {
    // 尝试提取 JSON
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                      text.match(/\{[\s\S]*\}/) ||
                      text.match(/\[[\s\S]*\]/)

    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1] || jsonMatch[0])
      } catch {
        // JSON 解析失败，返回原始文本
      }
    }

    // 返回文本结果
    return { text, raw: text }
  }

  /**
   * 完成 Pipeline 执行
   */
  private async completeExecution(
    executionId: string,
    status: PipelineExecutionStatus,
    outputData?: any,
    error?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      completedAt: new Date(),
    }

    if (outputData !== undefined) {
      updateData.outputData = JSON.stringify(outputData)
    }

    if (error) {
      updateData.error = error
    }

    await prisma.pipelineExecution.update({
      where: { id: executionId },
      data: updateData,
    })

    console.log(`[Pipeline] Execution ${status}: ${executionId}`)

    // SSE 推送：Pipeline 完成
    await sseService.broadcast('pipeline.completed', {
      executionId,
      status,
      outputData,
      error,
    })
  }

  /**
   * 加载 Pipeline 配置
   */
  private async loadPipeline(pipelineId: string): Promise<PipelineDetail | null> {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        nodes: true,
        edges: true,
      },
    })

    if (!pipeline) {
      return null
    }

    // 解析节点的 config 字段，并转换 edges 的 null 为 undefined
    const nodes = pipeline.nodes.map((node) => ({
      ...node,
      config: node.config ? JSON.parse(node.config) : undefined,
      incomingEdges: [],
      outgoingEdges: [],
    })) as PipelineNode[]

    // 转换 edges：将 condition 的 null 转换为 undefined
    const edges: PipelineEdge[] = pipeline.edges.map((edge) => ({
      ...edge,
      condition: edge.condition ?? undefined,
    }))

    // 关联边信息
    for (const node of nodes) {
      node.incomingEdges = edges.filter(e => e.toNodeId === node.id)
      node.outgoingEdges = edges.filter(e => e.fromNodeId === node.id)
    }

    return {
      ...pipeline,
      description: pipeline.description ?? undefined,
      trigger: pipeline.trigger as any, // PipelineTrigger 类型
      nodes,
      edges,
    }
  }

  /**
   * 构建执行图
   */
  private buildExecutionGraph(pipeline: PipelineDetail): ExecutionGraph {
    const nodes = new Map<string, PipelineNode>()
    const inEdges = new Map<string, PipelineEdge[]>()
    const outEdges = new Map<string, PipelineEdge[]>()

    // 添加节点
    for (const node of pipeline.nodes) {
      nodes.set(node.id, node)
      inEdges.set(node.id, [])
      outEdges.set(node.id, [])
    }

    // 添加边
    for (const edge of pipeline.edges) {
      inEdges.get(edge.toNodeId)?.push(edge)
      outEdges.get(edge.fromNodeId)?.push(edge)
    }

    return {
      nodes,
      edges: pipeline.edges,
      inEdges,
      outEdges,
    }
  }

  /**
   * 拓扑排序（Kahn 算法）
   * 返回节点的执行顺序
   */
  private topologicalSort(graph: ExecutionGraph): string[] {
    const order: string[] = []
    const inDegree = new Map<string, number>()
    const queue: string[] = []

    // 初始化入度
    for (const [id, node] of graph.nodes) {
      const degree = graph.inEdges.get(id)?.length || 0
      inDegree.set(id, degree)
      if (degree === 0) {
        queue.push(id)
      }
    }

    // 拓扑排序
    while (queue.length > 0) {
      const nodeId = queue.shift()!
      order.push(nodeId)

      const outEdges = graph.outEdges.get(nodeId) || []
      for (const edge of outEdges) {
        const newDegree = inDegree.get(edge.toNodeId)! - 1
        inDegree.set(edge.toNodeId, newDegree)
        if (newDegree === 0) {
          queue.push(edge.toNodeId)
        }
      }
    }

    // 检查环
    if (order.length !== graph.nodes.size) {
      throw new Error('Pipeline contains a cycle, cannot determine execution order')
    }

    return order
  }

  /**
   * 获取执行状态
   */
  async getExecutionStatus(executionId: string): Promise<{
    execution: any
    nodeExecutions: any[]
  } | null> {
    const execution = await prisma.pipelineExecution.findUnique({
      where: { id: executionId },
    })

    if (!execution) {
      return null
    }

    const nodeExecutions = await prisma.pipelineNodeExecution.findMany({
      where: { executionId },
      orderBy: { createdAt: 'asc' },
    })

    return {
      execution: {
        ...execution,
        inputData: execution.inputData ? JSON.parse(execution.inputData) : undefined,
        outputData: execution.outputData ? JSON.parse(execution.outputData) : undefined,
      },
      nodeExecutions: nodeExecutions.map((ne) => ({
        ...ne,
        inputData: ne.inputData ? JSON.parse(ne.inputData) : undefined,
        outputData: ne.outputData ? JSON.parse(ne.outputData) : undefined,
      })),
    }
  }

  /**
   * 取消执行
   */
  async cancelExecution(executionId: string): Promise<void> {
    await prisma.pipelineExecution.update({
      where: { id: executionId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    })

    // 取消所有运行中的节点
    await prisma.pipelineNodeExecution.updateMany({
      where: {
        executionId,
        status: 'running',
      },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    })

    console.log(`[Pipeline] Execution cancelled: ${executionId}`)

    // SSE 推送：Pipeline 取消
    await sseService.broadcast('pipeline.cancelled', {
      executionId,
    })
  }
}

export const pipelineExecutorService = new PipelineExecutorService()
