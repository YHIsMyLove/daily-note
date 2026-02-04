/**
 * 工作流相关类型定义
 */

/**
 * 工作流触发场景
 */
export type WorkflowTrigger =
  | 'note_created'
  | 'note_updated'
  | 'note_deleted'
  | 'manual_analysis'

/**
 * 工作流触发场景的显示名称映射
 */
export const WorkflowTriggerLabels: Record<WorkflowTrigger, string> = {
  note_created: '笔记创建时',
  note_updated: '笔记更新时',
  note_deleted: '笔记删除时',
  manual_analysis: '手动分析时',
}

/**
 * 工作流步骤
 */
export interface WorkflowStep {
  id: string
  workflowId: string
  taskType: string
  label: string
  enabled: boolean
  priority: number
  position: number
  dependencies: string[]  // 依赖的步骤ID
  config?: Record<string, any>
  nodeX: number  // 节点在流程图中的 X 坐标
  nodeY: number  // 节点在流程图中的 Y 坐标
  createdAt: Date
  updatedAt: Date
}

/**
 * 工作流连线
 */
export interface WorkflowConnection {
  id: string
  workflowId: string
  fromStepId: string
  toStepId: string
  condition?: string
  createdAt: Date
}

/**
 * 工作流配置
 */
export interface WorkflowConfig {
  id: string
  trigger: WorkflowTrigger
  label: string
  description?: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * 工作流配置详情（包含步骤和连线）
 */
export interface WorkflowConfigDetail extends WorkflowConfig {
  steps: WorkflowStep[]
  connections: WorkflowConnection[]
}

/**
 * 可用的任务类型定义
 */
export interface TaskTypeDefinition {
  type: string
  label: string
  description: string
  defaultConfig?: Record<string, any>
  icon?: string
  category?: string
}

/**
 * 工作流节点（用于前端可视化）
 */
export interface WorkflowNode {
  id: string
  label: string
  taskType: string
  x: number
  y: number
  enabled: boolean
}

/**
 * 工作流边（用于前端可视化）
 */
export interface WorkflowEdge {
  from: string
  to: string
  condition?: string
}

/**
 * 创建工作流请求
 */
export interface CreateWorkflowRequest {
  trigger: string
  label: string
  description?: string
}

/**
 * 更新工作流请求
 */
export interface UpdateWorkflowRequest {
  label?: string
  description?: string
  enabled?: boolean
}

/**
 * 创建工作流步骤请求
 */
export interface CreateWorkflowStepRequest {
  taskType: string
  label: string
  enabled?: boolean
  priority?: number
  position?: number
  dependencies?: string[]
  config?: Record<string, any>
  nodeX?: number
  nodeY?: number
}

/**
 * 更新工作流步骤请求
 */
export interface UpdateWorkflowStepRequest {
  label?: string
  enabled?: boolean
  priority?: number
  position?: number
  dependencies?: string[]
  config?: Record<string, any>
  nodeX?: number
  nodeY?: number
}

/**
 * 创建工作流连线请求
 */
export interface CreateWorkflowConnectionRequest {
  fromStepId: string
  toStepId: string
  condition?: string
}

/**
 * 工作流配置导出格式
 */
export interface WorkflowExport {
  version: string
  exportedAt: string
  workflows: Array<{
    trigger: string
    label: string
    description?: string
    steps: Array<{
      taskType: string
      label: string
      enabled: boolean
      priority: number
      position: number
      dependencies: string[]
      config?: Record<string, any>
      nodeX: number
      nodeY: number
    }>
    connections: Array<{
      fromStepId: string
      toStepId: string
      condition?: string
    }>
  }>
}

/**
 * 工作流配置导入请求
 */
export interface WorkflowImportRequest {
  workflows: WorkflowExport['workflows']
  overwrite?: boolean  // 是否覆盖现有配置
}

// ========== Pipeline 类型（提示词管道） ==========

/**
 * Pipeline 触发方式
 */
export type PipelineTrigger =
  | 'manual'
  | 'note_created'
  | 'note_updated'
  | 'note_deleted'
  | 'scheduled'

/**
 * Pipeline 触发方式的显示名称映射
 */
export const PipelineTriggerLabels: Record<PipelineTrigger, string> = {
  manual: '手动触发',
  note_created: '笔记创建时',
  note_updated: '笔记更新时',
  note_deleted: '笔记删除时',
  scheduled: '定时任务',
}

/**
 * Pipeline 节点
 */
export interface PipelineNode {
  id: string
  pipelineId: string
  promptKey: string
  promptName: string
  enabled: boolean
  config?: Record<string, any>
  nodeX: number
  nodeY: number
  incomingEdges: PipelineEdge[]
  outgoingEdges: PipelineEdge[]
  createdAt: Date
  updatedAt: Date
}

/**
 * Pipeline 连线
 */
export interface PipelineEdge {
  id: string
  pipelineId: string
  fromNodeId: string
  toNodeId: string
  outputKey: string
  inputKey: string
  condition?: string
  createdAt: Date
}

/**
 * Pipeline 配置
 */
export interface Pipeline {
  id: string
  name: string
  description?: string
  trigger: PipelineTrigger
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Pipeline 配置详情（包含节点和连线）
 */
export interface PipelineDetail extends Pipeline {
  nodes: PipelineNode[]
  edges: PipelineEdge[]
}

/**
 * Pipeline 执行状态
 */
export type PipelineExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * Pipeline 节点执行状态
 */
export type PipelineNodeExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

/**
 * Pipeline 执行记录
 */
export interface PipelineExecution {
  id: string
  pipelineId: string
  triggerEvent: string
  status: PipelineExecutionStatus
  inputData?: Record<string, any>
  outputData?: Record<string, any>
  error?: string
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
}

/**
 * Pipeline 节点执行记录
 */
export interface PipelineNodeExecution {
  id: string
  executionId: string
  nodeId: string
  status: PipelineNodeExecutionStatus
  inputData?: Record<string, any>
  outputData?: Record<string, any>
  error?: string
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
}

/**
 * 创建 Pipeline 请求
 */
export interface CreatePipelineRequest {
  name: string
  description?: string
  trigger?: PipelineTrigger
}

/**
 * 更新 Pipeline 请求
 */
export interface UpdatePipelineRequest {
  name?: string
  description?: string
  trigger?: PipelineTrigger
  enabled?: boolean
}

/**
 * 创建 Pipeline 节点请求
 */
export interface CreatePipelineNodeRequest {
  promptKey: string
  promptName: string
  enabled?: boolean
  config?: Record<string, any>
  nodeX?: number
  nodeY?: number
}

/**
 * 更新 Pipeline 节点请求
 */
export interface UpdatePipelineNodeRequest {
  promptKey?: string
  promptName?: string
  enabled?: boolean
  config?: Record<string, any>
  nodeX?: number
  nodeY?: number
}

/**
 * 创建 Pipeline 连线请求
 */
export interface CreatePipelineEdgeRequest {
  fromNodeId: string
  toNodeId: string
  outputKey?: string
  inputKey?: string
  condition?: string
}

/**
 * 执行 Pipeline 请求
 */
export interface ExecutePipelineRequest {
  triggerEvent?: string
  inputData?: Record<string, any>
}

/**
 * Pipeline 可视化节点
 */
export interface PipelineVisNode {
  id: string
  label: string
  title?: string
  x: number
  y: number
  enabled: boolean
  promptKey: string
}

/**
 * Pipeline 可视化边
 */
export interface PipelineVisEdge {
  id: string
  from: string
  to: string
  label?: string
  outputKey: string
  inputKey: string
}
