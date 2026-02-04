/**
 * 工作流 API 客户端
 */
import { apiClient } from './api'
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
  TaskTypeDefinition,
  WorkflowExport,
  WorkflowImportRequest,
} from '@daily-note/shared'

type ApiResponseType<T> = Promise<{ success: boolean; data?: T; error?: string }>

/**
 * 工作流 API
 */
export const workflowApi = {
  /**
   * 获取所有工作流配置
   */
  list: (): ApiResponseType<WorkflowConfig[]> =>
    apiClient.get('/api/workflow'),

  /**
   * 根据 trigger 获取工作流配置详情
   */
  getByTrigger: (trigger: string): ApiResponseType<WorkflowConfigDetail> =>
    apiClient.get(`/api/workflow/${trigger}`),

  /**
   * 获取工作流配置详情
   */
  getById: (id: string): ApiResponseType<WorkflowConfigDetail> =>
    apiClient.get(`/api/workflow/${id}`),

  /**
   * 创建工作流配置
   */
  create: (data: CreateWorkflowRequest): ApiResponseType<WorkflowConfig> =>
    apiClient.post('/api/workflow', data),

  /**
   * 更新工作流配置
   */
  update: (id: string, data: UpdateWorkflowRequest): ApiResponseType<WorkflowConfig> =>
    apiClient.put(`/api/workflow/${id}`, data),

  /**
   * 删除工作流配置
   */
  delete: (id: string): ApiResponseType<void> =>
    apiClient.delete(`/api/workflow/${id}`),

  /**
   * 添加工作流步骤
   */
  addStep: (workflowId: string, data: CreateWorkflowStepRequest): ApiResponseType<WorkflowStep> =>
    apiClient.post(`/api/workflow/${workflowId}/steps`, data),

  /**
   * 更新工作流步骤
   */
  updateStep: (stepId: string, data: UpdateWorkflowStepRequest): ApiResponseType<WorkflowStep> =>
    apiClient.put(`/api/workflow/steps/${stepId}`, data),

  /**
   * 删除工作流步骤
   */
  deleteStep: (stepId: string): ApiResponseType<void> =>
    apiClient.delete(`/api/workflow/steps/${stepId}`),

  /**
   * 添加连线
   */
  addConnection: (workflowId: string, data: CreateWorkflowConnectionRequest): ApiResponseType<WorkflowConnection> =>
    apiClient.post(`/api/workflow/${workflowId}/connections`, data),

  /**
   * 删除连线
   */
  deleteConnection: (connectionId: string): ApiResponseType<void> =>
    apiClient.delete(`/api/workflow/connections/${connectionId}`),

  /**
   * 重置所有工作流为默认配置
   */
  reset: (): ApiResponseType<{ message: string }> =>
    apiClient.post('/api/workflow/reset'),

  /**
   * 获取所有可用的任务类型
   */
  getTaskTypes: (): ApiResponseType<TaskTypeDefinition[]> =>
    apiClient.get('/api/workflow/meta/task-types'),

  /**
   * 导出所有工作流配置
   */
  export: (): ApiResponseType<WorkflowExport> =>
    apiClient.get('/api/workflow/export'),

  /**
   * 导入工作流配置
   */
  import: (data: WorkflowImportRequest): ApiResponseType<{ message: string }> =>
    apiClient.post('/api/workflow/import', data),
}
