/**
 * Pipeline API 客户端
 *
 * 提示词管道（Pipeline）的 API 调用
 */
import { apiClient } from './api'
import type {
  Pipeline,
  PipelineDetail,
  CreatePipelineRequest,
  UpdatePipelineRequest,
  CreatePipelineNodeRequest,
  UpdatePipelineNodeRequest,
  CreatePipelineEdgeRequest,
  ExecutePipelineRequest,
  PipelineExecution,
  PipelineNodeExecution,
} from '@daily-note/shared'

type ApiResponseType<T> = Promise<{ success: boolean; data?: T; error?: string }>

/**
 * Pipeline API
 */
export const pipelineApi = {
  // ========== Pipeline CRUD ==========

  /**
   * 获取所有 Pipeline
   */
  list: (): ApiResponseType<Pipeline[]> =>
    apiClient.get('/pipelines'),

  /**
   * 获取 Pipeline 详情
   */
  getById: (id: string): ApiResponseType<PipelineDetail> =>
    apiClient.get(`/pipelines/${id}`),

  /**
   * 创建 Pipeline
   */
  create: (data: CreatePipelineRequest): ApiResponseType<Pipeline> =>
    apiClient.post('/pipelines', data),

  /**
   * 更新 Pipeline
   */
  update: (id: string, data: UpdatePipelineRequest): ApiResponseType<Pipeline> =>
    apiClient.put(`/pipelines/${id}`, data),

  /**
   * 删除 Pipeline
   */
  delete: (id: string): ApiResponseType<void> =>
    apiClient.delete(`/pipelines/${id}`),

  // ========== 节点操作 ==========

  /**
   * 添加节点
   */
  addNode: (pipelineId: string, data: CreatePipelineNodeRequest): ApiResponseType<any> =>
    apiClient.post(`/pipelines/${pipelineId}/nodes`, data),

  /**
   * 更新节点
   */
  updateNode: (pipelineId: string, nodeId: string, data: UpdatePipelineNodeRequest): ApiResponseType<any> =>
    apiClient.put(`/pipelines/${pipelineId}/nodes/${nodeId}`, data),

  /**
   * 删除节点
   */
  deleteNode: (pipelineId: string, nodeId: string): ApiResponseType<void> =>
    apiClient.delete(`/pipelines/${pipelineId}/nodes/${nodeId}`),

  // ========== 连线操作 ==========

  /**
   * 添加连线
   */
  addEdge: (pipelineId: string, data: CreatePipelineEdgeRequest): ApiResponseType<any> =>
    apiClient.post(`/pipelines/${pipelineId}/edges`, data),

  /**
   * 删除连线
   */
  deleteEdge: (pipelineId: string, edgeId: string): ApiResponseType<void> =>
    apiClient.delete(`/pipelines/${pipelineId}/edges/${edgeId}`),

  // ========== 执行操作 ==========

  /**
   * 执行 Pipeline
   */
  execute: (pipelineId: string, data: ExecutePipelineRequest = {}): ApiResponseType<{ executionId: string; message: string }> =>
    apiClient.post(`/pipelines/${pipelineId}/execute`, data),

  /**
   * 获取执行状态
   */
  getExecutionStatus: (pipelineId: string, executionId: string): ApiResponseType<{
    execution: PipelineExecution
    nodeExecutions: PipelineNodeExecution[]
  }> =>
    apiClient.get(`/pipelines/${pipelineId}/status/${executionId}`),

  /**
   * 取消执行
   */
  cancelExecution: (pipelineId: string, executionId: string): ApiResponseType<{ message: string }> =>
    apiClient.post(`/pipelines/${pipelineId}/cancel/${executionId}`, {}),

  /**
   * 获取执行历史
   */
  getExecutions: (pipelineId: string, options: { limit?: number; offset?: number } = {}): ApiResponseType<{
    executions: PipelineExecution[]
    total: number
    limit: number
    offset: number
  }> =>
    apiClient.get(`/pipelines/${pipelineId}/executions`, { params: options }),
}
