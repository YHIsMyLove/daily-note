/**
 * 工作流初始化服务
 *
 * 在应用启动时检查并初始化默认工作流配置
 */
import { prisma } from '../database/prisma'
import { workflowService } from './workflow.service'

/**
 * 初始化工作流配置
 * 如果数据库中没有工作流配置，则创建默认配置
 */
export async function initializeWorkflows(): Promise<void> {
  try {
    console.log('[WorkflowInit] Checking workflow configurations...')

    // 检查是否已有工作流配置
    const count = await prisma.workflowConfig.count()

    if (count === 0) {
      console.log('[WorkflowInit] No workflows found, creating default configurations...')

      await workflowService.resetToDefaults()

      console.log('[WorkflowInit] Default workflows created successfully')
    } else {
      console.log(`[WorkflowInit] Found ${count} existing workflow(s)`)
    }

    // 验证所有默认 trigger 是否存在
    const requiredTriggers = ['note_created', 'note_updated', 'note_deleted', 'manual_analysis']
    const existingWorkflows = await prisma.workflowConfig.findMany({
      select: { trigger: true },
    })
    const existingTriggers = new Set(existingWorkflows.map((w) => w.trigger))

    for (const trigger of requiredTriggers) {
      if (!existingTriggers.has(trigger)) {
        console.log(`[WorkflowInit] Missing trigger: ${trigger}, creating...`)
        // TODO: 创建缺失的默认工作流
      }
    }

    console.log('[WorkflowInit] Workflow initialization completed')
  } catch (error) {
    console.error('[WorkflowInit] Error initializing workflows:', error)
    // 不抛出错误，允许应用继续启动
  }
}
