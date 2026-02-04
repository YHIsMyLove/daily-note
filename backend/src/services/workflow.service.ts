/**
 * 工作流服务
 *
 * 处理工作流配置的 CRUD 操作，以及工作流的执行逻辑
 */
import { prisma } from '../database/prisma'
import type {
  WorkflowConfig,
  WorkflowConfigDetail,
  WorkflowStep,
  WorkflowConnection,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  CreateWorkflowStepRequest,
  UpdateWorkflowStepRequest,
  CreateWorkflowConnectionRequest,
  WorkflowExport,
  WorkflowTrigger,
} from '@daily-note/shared'
import { DEFAULT_WORKFLOWS } from '../config/workflow-defaults'

export class WorkflowService {
  /**
   * 获取所有工作流配置
   */
  async getAllWorkflows(): Promise<WorkflowConfig[]> {
    const workflows = await prisma.workflowConfig.findMany({
      orderBy: { trigger: 'asc' },
    })
    // 将 trigger 从 string 转换为 WorkflowTrigger，description 的 null 转换为 undefined
    return workflows.map(w => ({
      ...w,
      trigger: w.trigger as WorkflowTrigger,
      description: w.description ?? undefined,
    }))
  }

  /**
   * 根据 trigger 获取工作流配置详情
   */
  async getWorkflowByTrigger(trigger: string): Promise<WorkflowConfigDetail | null> {
    const workflow = await prisma.workflowConfig.findUnique({
      where: { trigger },
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
        connections: true,
      },
    })

    if (!workflow) {
      return null
    }

    // 转换步骤的 dependencies 字段，并转换 connections 的 condition
    const steps = workflow.steps.map((step) => ({
      ...step,
      dependencies: step.dependencies ? JSON.parse(step.dependencies) : [],
      config: step.config ? JSON.parse(step.config) : undefined,
    })) as WorkflowStep[]

    // 转换 connections：将 condition 的 null 转换为 undefined
    const connections: WorkflowConnection[] = workflow.connections.map((conn) => ({
      ...conn,
      condition: conn.condition ?? undefined,
    }))

    return {
      ...workflow,
      trigger: workflow.trigger as WorkflowTrigger,
      description: workflow.description ?? undefined,
      steps,
      connections,
    }
  }

  /**
   * 获取工作流配置详情
   */
  async getWorkflowById(id: string): Promise<WorkflowConfigDetail | null> {
    const workflow = await prisma.workflowConfig.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
        connections: true,
      },
    })

    if (!workflow) {
      return null
    }

    // 转换步骤的 dependencies 字段，并转换 connections 的 condition
    const steps = workflow.steps.map((step) => ({
      ...step,
      dependencies: step.dependencies ? JSON.parse(step.dependencies) : [],
      config: step.config ? JSON.parse(step.config) : undefined,
    })) as WorkflowStep[]

    // 转换 connections：将 condition 的 null 转换为 undefined
    const connections: WorkflowConnection[] = workflow.connections.map((conn) => ({
      ...conn,
      condition: conn.condition ?? undefined,
    }))

    return {
      ...workflow,
      trigger: workflow.trigger as WorkflowTrigger,
      description: workflow.description ?? undefined,
      steps,
      connections,
    }
  }

  /**
   * 创建工作流配置
   */
  async createWorkflow(data: CreateWorkflowRequest): Promise<WorkflowConfig> {
    const workflow = await prisma.workflowConfig.create({
      data: {
        trigger: data.trigger,
        label: data.label,
        description: data.description,
      },
    })
    return {
      ...workflow,
      trigger: workflow.trigger as WorkflowTrigger,
      description: workflow.description ?? undefined,
    }
  }

  /**
   * 更新工作流配置
   */
  async updateWorkflow(id: string, data: UpdateWorkflowRequest): Promise<WorkflowConfig> {
    const workflow = await prisma.workflowConfig.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    })
    return {
      ...workflow,
      trigger: workflow.trigger as WorkflowTrigger,
      description: workflow.description ?? undefined,
    }
  }

  /**
   * 删除工作流配置
   */
  async deleteWorkflow(id: string): Promise<void> {
    await prisma.workflowConfig.delete({
      where: { id },
    })
  }

  /**
   * 添加工作流步骤
   */
  async addStep(workflowId: string, data: CreateWorkflowStepRequest): Promise<WorkflowStep> {
    const step = await prisma.workflowStep.create({
      data: {
        workflowId,
        taskType: data.taskType,
        label: data.label,
        enabled: data.enabled ?? true,
        priority: data.priority ?? 0,
        position: data.position ?? 0,
        dependencies: data.dependencies ? JSON.stringify(data.dependencies) : null,
        config: data.config ? JSON.stringify(data.config) : null,
        nodeX: data.nodeX ?? 0,
        nodeY: data.nodeY ?? 0,
      },
    })

    return {
      ...step,
      dependencies: data.dependencies ?? [],
      config: data.config,
    }
  }

  /**
   * 更新工作流步骤
   */
  async updateStep(stepId: string, data: UpdateWorkflowStepRequest): Promise<WorkflowStep> {
    const step = await prisma.workflowStep.update({
      where: { id: stepId },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.position !== undefined && { position: data.position }),
        ...(data.dependencies !== undefined && {
          dependencies: JSON.stringify(data.dependencies),
        }),
        ...(data.config !== undefined && {
          config: data.config ? JSON.stringify(data.config) : null,
        }),
        ...(data.nodeX !== undefined && { nodeX: data.nodeX }),
        ...(data.nodeY !== undefined && { nodeY: data.nodeY }),
      },
    })

    return {
      ...step,
      dependencies: data.dependencies ?? (step.dependencies ? JSON.parse(step.dependencies) : []),
      config: data.config ?? (step.config ? JSON.parse(step.config) : undefined),
    }
  }

  /**
   * 删除工作流步骤
   */
  async deleteStep(stepId: string): Promise<void> {
    await prisma.workflowStep.delete({
      where: { id: stepId },
    })
  }

  /**
   * 添加工作流连线
   */
  async addConnection(workflowId: string, data: CreateWorkflowConnectionRequest): Promise<WorkflowConnection> {
    const connection = await prisma.workflowConnection.create({
      data: {
        workflowId,
        fromStepId: data.fromStepId,
        toStepId: data.toStepId,
        condition: data.condition,
      },
    })
    // 将 condition 的 null 转换为 undefined
    return {
      ...connection,
      condition: connection.condition ?? undefined,
    }
  }

  /**
   * 删除工作流连线
   */
  async deleteConnection(connectionId: string): Promise<void> {
    await prisma.workflowConnection.delete({
      where: { id: connectionId },
    })
  }

  /**
   * 根据步骤 ID 删除所有相关连线
   */
  async deleteConnectionsByStep(stepId: string): Promise<void> {
    await prisma.workflowConnection.deleteMany({
      where: {
        OR: [{ fromStepId: stepId }, { toStepId: stepId }],
      },
    })
  }

  /**
   * 重置所有工作流为默认配置
   */
  async resetToDefaults(): Promise<void> {
    // 删除所有现有工作流
    await prisma.workflowConnection.deleteMany({})
    await prisma.workflowStep.deleteMany({})
    await prisma.workflowConfig.deleteMany({})

    // 创建默认工作流
    for (const workflowData of DEFAULT_WORKFLOWS) {
      const workflow = await prisma.workflowConfig.create({
        data: {
          trigger: workflowData.trigger,
          label: workflowData.label,
          description: workflowData.description,
          enabled: workflowData.enabled,
        },
      })

      // 创建步骤并记录 position -> id 的映射
      const positionToIdMap: Record<number, string> = {}

      for (const stepData of workflowData.steps) {
        const step = await prisma.workflowStep.create({
          data: {
            workflowId: workflow.id,
            taskType: stepData.taskType,
            label: stepData.label,
            enabled: stepData.enabled,
            priority: stepData.priority,
            position: stepData.position,
            dependencies: JSON.stringify(stepData.dependencies),
            nodeX: stepData.nodeX,
            nodeY: stepData.nodeY,
          },
        })
        positionToIdMap[stepData.position] = step.id
      }

      // 创建连线
      for (const connData of workflowData.connections) {
        const fromId = positionToIdMap[connData.fromPosition]
        const toId = positionToIdMap[connData.toPosition]

        if (fromId && toId) {
          await prisma.workflowConnection.create({
            data: {
              workflowId: workflow.id,
              fromStepId: fromId,
              toStepId: toId,
              condition: connData.condition,
            },
          })
        }
      }
    }
  }

  /**
   * 导出所有工作流配置
   */
  async exportWorkflows(): Promise<WorkflowExport> {
    const workflows = await prisma.workflowConfig.findMany({
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
        connections: true,
      },
    })

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      workflows: workflows.map((wf) => ({
        trigger: wf.trigger,
        label: wf.label,
        description: wf.description ?? undefined,
        steps: wf.steps.map((step) => ({
          taskType: step.taskType,
          label: step.label,
          enabled: step.enabled,
          priority: step.priority,
          position: step.position,
          dependencies: step.dependencies ? JSON.parse(step.dependencies) : [],
          config: step.config ? JSON.parse(step.config) : undefined,
          nodeX: step.nodeX,
          nodeY: step.nodeY,
        })),
        connections: wf.connections.map((conn) => ({
          fromStepId: conn.fromStepId,
          toStepId: conn.toStepId,
          condition: conn.condition ?? undefined,
        })),
      })),
    }
  }

  /**
   * 导入工作流配置
   */
  async importWorkflows(data: WorkflowExport, overwrite = false): Promise<void> {
    if (overwrite) {
      // 删除所有现有工作流
      await prisma.workflowConnection.deleteMany({})
      await prisma.workflowStep.deleteMany({})
      await prisma.workflowConfig.deleteMany({})
    }

    for (const workflowData of data.workflows) {
      // 检查是否已存在相同 trigger 的工作流
      const existing = await prisma.workflowConfig.findUnique({
        where: { trigger: workflowData.trigger },
      })

      let workflowId: string

      if (existing && !overwrite) {
        // 跳过已存在的工作流
        continue
      } else if (existing && overwrite) {
        // 更新现有工作流
        const updated = await prisma.workflowConfig.update({
          where: { id: existing.id },
          data: {
            label: workflowData.label,
            description: workflowData.description,
          },
        })
        workflowId = updated.id

        // 删除现有步骤和连线
        await prisma.workflowConnection.deleteMany({ where: { workflowId } })
        await prisma.workflowStep.deleteMany({ where: { workflowId } })
      } else {
        // 创建新工作流
        const workflow = await prisma.workflowConfig.create({
          data: {
            trigger: workflowData.trigger,
            label: workflowData.label,
            description: workflowData.description,
          },
        })
        workflowId = workflow.id
      }

      // 创建步骤并记录 position -> id 的映射
      const positionToIdMap: Record<number, string> = {}

      for (const stepData of workflowData.steps) {
        const step = await prisma.workflowStep.create({
          data: {
            workflowId,
            taskType: stepData.taskType,
            label: stepData.label,
            enabled: stepData.enabled,
            priority: stepData.priority,
            position: stepData.position,
            dependencies: JSON.stringify(stepData.dependencies),
            config: stepData.config ? JSON.stringify(stepData.config) : null,
            nodeX: stepData.nodeX,
            nodeY: stepData.nodeY,
          },
        })
        positionToIdMap[stepData.position] = step.id
      }

      // 创建连线（需要将步骤位置映射到实际 ID）
      for (const connData of workflowData.connections) {
        // 这里需要根据实际情况映射步骤 ID
        // 如果导出时使用的是 stepId，则需要特殊处理
        // 当前实现假设使用 position 映射
        // TODO: 改进 ID 映射逻辑
      }
    }
  }

  /**
   * 执行工作流
   * 根据触发场景执行相应的任务队列
   */
  async executeWorkflow(trigger: WorkflowTrigger, noteId: string, content: string): Promise<void> {
    const workflow = await this.getWorkflowByTrigger(trigger)

    if (!workflow || !workflow.enabled) {
      console.log(`[Workflow] No active workflow found for trigger: ${trigger}`)
      return
    }

    const { queueManager } = await import('../queue/queue-manager')

    // 只执行已启用的步骤
    const enabledSteps = workflow.steps.filter((s) => s.enabled)

    // 按优先级排序
    const sortedSteps = [...enabledSteps].sort((a, b) => b.priority - a.priority)

    for (const step of sortedSteps) {
      // 检查依赖是否满足（简化版本，只检查是否依赖其他步骤）
      // TODO: 实现完整的依赖检查逻辑

      // 将任务加入队列
      await queueManager.enqueue(
        step.taskType,
        { noteId, content },
        noteId,
        step.priority
      )

      console.log(`[Workflow] Enqueued task: ${step.taskType} for note ${noteId}`)
    }
  }
}

export const workflowService = new WorkflowService()
