/**
 * API 客户端
 * 跨平台支持（桌面端使用本地 API，移动端使用云端 API）
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { toast } from 'sonner'
import { getPlatform, isTauriEnvironment } from './platform'
import {
  retryWithBackoff,
  isAxiosErrorRetryable,
  getErrorMessage,
  classifyError,
} from './retry'
import {
  NoteBlock,
  Category,
  Tag,
  ClaudeTask,
  ActivityData,
  StatsSummary,
  ApiResponse,
  PromptTemplate,
  PromptTemplateDetail,
  PromptVariable,
  SummaryAnalyzerPayload,
  SummaryAnalysisResult,
  Summary,
  SummaryComparison,
  SummaryHistoryFilters,
  Todo,
  CreateTodoRequest,
  UpdateTodoRequest,
  CompleteTodoRequest,
  TodoListResponse,
  TodoFilters,
  TodoSortBy,
  TodoSortOrder,
  TodoListQuery,
  TodoStats,
} from '@daily-note/shared'

// API 响应类型（后端返回格式）
type ApiResponseType<T> = Promise<{ success: boolean; data?: T; error?: string }>

/**
 * 检测是否在 Tauri 环境中运行（运行时检测，非模块加载时）
 */
const isTauriEnv = (): boolean => {
  if (typeof window === 'undefined') return false

  // 检查多个可能的 Tauri 标识
  // @ts-ignore
  if (window.__TAURI__) return true
  // @ts-ignore
  if (window.__TAURI_INTERNALS__) return true
  // @ts-ignore
  if (window.__TAURI_METADATA__) return true

  return false
}

/**
 * 获取 API 地址（运行时动态获取）
 */
const getApiBase = (): string => {
  // 优先检测 Tauri 环境（运行时检测，此时 Tauri API 已初始化）
  if (isTauriEnv()) {
    const apiBase = process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:3001'
    console.log('[API] Tauri environment detected (runtime), using local API:', apiBase)
    return apiBase
  }

  // 获取平台（运行时检测）
  const platform = getPlatform()
  const isDevelopment = process.env.NODE_ENV === 'development'

  // 开发环境优先使用本地 API
  if (isDevelopment) {
    const apiBase = process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:3001'
    console.log('[API] Development environment (runtime), using local API:', apiBase)
    return apiBase
  }

  // 生产环境根据平台选择
  let apiBase: string
  switch (platform) {
    case 'android':
    case 'ios':
      apiBase = process.env.NEXT_PUBLIC_CLOUD_API_URL || 'https://api.dailynote.com'
      break
    case 'desktop':
      apiBase = process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:3001'
      break
    case 'web':
      apiBase = process.env.NEXT_PUBLIC_CLOUD_API_URL || 'https://api.dailynote.com'
      break
    default:
      apiBase = 'http://localhost:3001'
  }

  console.log('[API] Platform (runtime):', platform, 'API Base:', apiBase)
  return apiBase
}

/**
 * 获取 Axios 实例（延迟初始化，每次调用时动态创建）
 * 这样可以确保在 Tauri 环境中，API 初始化时 Tauri API 已经就绪
 */
const getApiClient = (): AxiosInstance => {
  const platform = getPlatform()

  const client = axios.create({
    baseURL: getApiBase(),
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // 请求拦截器
  client.interceptors.request.use((config) => {
    config.headers['X-Platform'] = platform
    return config
  })

  // 响应拦截器（带重试逻辑）
  client.interceptors.response.use(
    (response) => response.data,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: number; _retryCount?: number }

      // 初始化重试计数器
      if (!originalRequest._retryCount) {
        originalRequest._retryCount = 0
      }

      // 检查是否应该重试
      const maxRetries = 3
      const shouldRetry = isAxiosErrorRetryable(error) && originalRequest._retryCount < maxRetries

      if (shouldRetry) {
        originalRequest._retryCount++

        // 计算延迟时间（指数退避：1s, 2s, 4s）
        const delay = Math.min(1000 * Math.pow(2, originalRequest._retryCount - 1), 10000)

        // 添加抖动（±25%）
        const jitter = delay * 0.25
        const actualDelay = delay + (Math.random() * 2 * jitter - jitter)

        // 记录重试日志
        const errorType = classifyError(error)
        console.log(`[API] 请求失败，正在重试 (${originalRequest._retryCount}/${maxRetries}) - 错误类型: ${errorType}, 延迟: ${Math.round(actualDelay)}ms`, {
          url: originalRequest.url,
          method: originalRequest.method,
          status: error.response?.status,
        })

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, actualDelay))

        // 重新发起请求
        try {
          const response = await client(originalRequest)
          return response.data
        } catch (retryError) {
          // 如果重试也失败，继续抛出错误（会被下面的错误处理捕获）
          throw retryError
        }
      }

      // 处理不需要重试或重试次数已用完的错误
      const userMessage = getErrorMessage(error)
      const errorType = classifyError(error)

      // 记录详细错误信息
      console.error('[API] 请求失败:', {
        url: originalRequest?.url,
        method: originalRequest?.method,
        status: error.response?.status,
        errorType,
        retryCount: originalRequest._retryCount || 0,
        message: userMessage,
      })

      // 显示用户友好的错误提示
      toast.error(userMessage, {
        description: originalRequest._retryCount > 0
          ? `已重试 ${originalRequest._retryCount} 次后失败`
          : undefined,
      })

      // 401 未授权错误特殊处理
      if (error.response?.status === 401) {
        console.error('[API] Unauthorized - 需要重新登录')
      }

      // 返回增强的错误对象
      const enhancedError = {
        ...error,
        userMessage,
        errorType,
        retryCount: originalRequest._retryCount || 0,
      }

      return Promise.reject(enhancedError)
    }
  )

  return client
}

/**
 * 缓存的 API 客户端实例
 */
let cachedApiClient: AxiosInstance | null = null
let cachedApiBase: string | null = null

/**
 * 导出 apiClient
 * 使用 Proxy 实现延迟初始化，确保在 Tauri 环境中首次访问时 Tauri API 已就绪
 */
export const apiClient = new Proxy({} as AxiosInstance, {
  get(_target, prop) {
    // 获取当前 API 地址（运行时检测）
    const currentApiBase = getApiBase()

    // 如果 API 地址变化或客户端不存在，重新创建
    if (!cachedApiClient || cachedApiBase !== currentApiBase) {
      cachedApiBase = currentApiBase
      cachedApiClient = getApiClient()
      console.log('[API] Created new axios instance with base URL:', currentApiBase)
    }

    // 获取属性值
    // @ts-ignore
    const value = cachedApiClient![prop]

    // 如果是方法，绑定正确的 this 上下文
    if (typeof value === 'function') {
      return value.bind(cachedApiClient!)
    }

    return value
  },
})

/**
 * 笔记 API
 */
export const notesApi = {
  create: (content: string, date?: Date, options?: { category?: string; tags?: string[]; importance?: number }): ApiResponseType<NoteBlock> =>
    apiClient.post('/api/notes', { content, date, ...options }),
  list: (params?: {
    date?: Date
    category?: string
    tags?: string[]  // 改为数组
    page?: number
    pageSize?: number
    dateFilterMode?: 'createdAt' | 'updatedAt' | 'both'
  }): ApiResponseType<{ notes: NoteBlock[]; total: number }> => apiClient.get('/api/notes', { params }),
  get: (id: string): ApiResponseType<NoteBlock> => apiClient.get(`/api/notes/${id}`),
  update: (id: string, data: any): ApiResponseType<NoteBlock> => apiClient.put(`/api/notes/${id}`, data),
  delete: (id: string): ApiResponseType<void> => apiClient.delete(`/api/notes/${id}`),
  // 软删除到回收站
  trash: (id: string): ApiResponseType<void> => apiClient.patch(`/api/notes/${id}/trash`),
  // 从回收站恢复
  restore: (id: string): ApiResponseType<NoteBlock> => apiClient.patch(`/api/notes/${id}/restore`),
  // 永久删除
  permanentDelete: (id: string): ApiResponseType<void> => apiClient.delete(`/api/notes/${id}/permanent`),
  // 获取回收站列表
  getTrash: (): ApiResponseType<NoteBlock[]> => apiClient.get('/api/notes/trash'),
  search: (query: string): ApiResponseType<NoteBlock[]> => apiClient.get('/api/notes/search', { params: { q: query } }),
  getRelated: (id: string): ApiResponseType<NoteBlock[]> => apiClient.get(`/api/notes/${id}/related`),
  analyze: (id: string): ApiResponseType<NoteBlock> => apiClient.post(`/api/notes/${id}/analyze`),
}

/**
 * 分类 API
 */
export const categoriesApi = {
  list: (): ApiResponseType<Category[]> => apiClient.get('/api/categories'),
  getByCategory: (category: string, params?: any): ApiResponseType<NoteBlock[]> =>
    apiClient.get(`/api/categories/${category}/notes`, { params }),
}

/**
 * 标签 API
 */
export const tagsApi = {
  list: (): ApiResponseType<Tag[]> => apiClient.get('/api/tags'),
  create: (name: string): ApiResponseType<Tag> => apiClient.post('/api/tags', { name }),
  delete: (id: string): ApiResponseType<void> => apiClient.delete(`/api/tags/${id}`),
  cleanup: (): ApiResponseType<{ deletedCount: number; deletedTags: Tag[] }> =>
    apiClient.post('/api/tags/cleanup'),
}

/**
 * 统计 API
 */
export const statsApi = {
  summary: (): ApiResponseType<StatsSummary> => apiClient.get('/api/stats/summary'),
  activity: (params?: { mode?: 'year' | 'month' | 'week' | 'day'; startDate?: string; endDate?: string }): ApiResponseType<ActivityData[]> =>
    apiClient.get('/api/activity', { params }),
  monthly: (year: number): ApiResponseType<{ month: number; year: number; count: number }[]> => apiClient.get('/api/activity/monthly', { params: { year } }),
  hourly: (date: string): ApiResponseType<{ hour: number; count: number }[]> => apiClient.get('/api/activity/hourly', { params: { date } }),
}

/**
 * 任务 API
 */
export const tasksApi = {
  list: (params?: { status?: string; noteId?: string }): ApiResponseType<ClaudeTask[]> =>
    apiClient.get('/api/tasks', { params }),
  get: (id: string): ApiResponseType<ClaudeTask> => apiClient.get(`/api/tasks/${id}`),
  cancel: (id: string): ApiResponseType<void> => apiClient.delete(`/api/tasks/${id}`),
  stats: (): ApiResponseType<{ pending: number; running: number; completed: number; failed: number; maxConcurrency: number }> => apiClient.get('/api/tasks/stats'),
}

/**
 * 提示词 API
 */
export const promptsApi = {
  list: (): ApiResponseType<PromptTemplate[]> =>
    apiClient.get('/api/prompts'),
  get: (key: string): ApiResponseType<PromptTemplateDetail> =>
    apiClient.get(`/api/prompts/${key}`),
  create: (data: {
    key: string
    name: string
    description?: string
    systemPart: string
    userPart: string
    variables: PromptVariable[]
  }): ApiResponseType<PromptTemplate> =>
    apiClient.post('/api/prompts', data),
  update: (key: string, userPart: string): ApiResponseType<void> =>
    apiClient.put(`/api/prompts/${key}`, { userPart }),
  delete: (key: string): ApiResponseType<void> =>
    apiClient.delete(`/api/prompts/${key}`),
  reset: (key: string): ApiResponseType<PromptTemplateDetail> =>
    apiClient.post(`/api/prompts/${key}/reset`),
  preview: (key: string, variables: Record<string, any>): ApiResponseType<{ preview: string }> =>
    apiClient.get(`/api/prompts/${key}/preview`, { params: variables }),
}

/**
 * 总结分析 API
 */
export const summariesApi = {
  create: (payload: SummaryAnalyzerPayload): ApiResponseType<{ taskId: string; status: string }> =>
    apiClient.post('/api/summaries', payload),
  list: (params?: { status?: string; mode?: string; limit?: number }): ApiResponseType<Array<{
    id: string
    type: string
    status: string
    payload: SummaryAnalyzerPayload
    result: SummaryAnalysisResult | null
    error?: string
    createdAt: Date
    completedAt?: Date
  }>> =>
    apiClient.get('/api/summaries', { params }),
  get: (id: string): ApiResponseType<{
    id: string
    type: string
    status: string
    payload: SummaryAnalyzerPayload
    result: SummaryAnalysisResult | null
    error?: string
    createdAt: Date
    startedAt?: Date
    completedAt?: Date
  }> =>
    apiClient.get(`/api/summaries/${id}`),
  delete: (id: string): ApiResponseType<{ message: string }> =>
    apiClient.delete(`/api/summaries/${id}`),
  stats: (): ApiResponseType<{ total: number; byMode: { day: number; week: number; month: number; year: number; custom: number } }> =>
    apiClient.get('/api/summaries/stats'),
  // 总结历史相关 API（新增）
  history: (filters?: SummaryHistoryFilters): ApiResponseType<Summary[]> =>
    apiClient.get('/api/summaries/history', { params: filters }),
  getRecord: (id: string): ApiResponseType<Summary> =>
    apiClient.get(`/api/summaries/record/${id}`),
  compare: (id: string, compareId: string): ApiResponseType<SummaryComparison> =>
    apiClient.get(`/api/summaries/${id}/compare`, { params: { compareId } }),
  deleteRecord: (id: string): ApiResponseType<{ message: string }> =>
    apiClient.delete(`/api/summaries/record/${id}`),
}

/**
 * Todo API
 */
export const todosApi = {
  create: (data: CreateTodoRequest): ApiResponseType<Todo> =>
    apiClient.post('/api/todos', data),
  list: (query?: TodoListQuery): ApiResponseType<TodoListResponse> =>
    apiClient.get('/api/todos', { params: query }),
  get: (id: string): ApiResponseType<Todo> =>
    apiClient.get(`/api/todos/${id}`),
  update: (id: string, data: UpdateTodoRequest): ApiResponseType<Todo> =>
    apiClient.put(`/api/todos/${id}`, data),
  delete: (id: string): ApiResponseType<{ message: string }> =>
    apiClient.delete(`/api/todos/${id}`),
  complete: (id: string, data?: CompleteTodoRequest): ApiResponseType<Todo> =>
    apiClient.patch(`/api/todos/${id}/complete`, data || {}),
  cancel: (id: string): ApiResponseType<Todo> =>
    apiClient.patch(`/api/todos/${id}/cancel`),
  enableAutoCompletion: (id: string): ApiResponseType<Todo> =>
    apiClient.patch(`/api/todos/${id}/auto-completion/enable`),
  disableAutoCompletion: (id: string): ApiResponseType<Todo> =>
    apiClient.patch(`/api/todos/${id}/auto-completion/disable`),
  stats: (): ApiResponseType<TodoStats> =>
    apiClient.get('/api/todos/stats'),
  getByNoteId: (noteId: string): ApiResponseType<Todo[]> =>
    apiClient.get(`/api/todos/note/${noteId}`),
  permanentDelete: (id: string): ApiResponseType<{ message: string }> =>
    apiClient.delete(`/api/todos/${id}/permanent`),
}

