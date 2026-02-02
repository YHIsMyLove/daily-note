/**
 * API Client for Note Skill
 * 提供 HTTP 客户端，包含错误处理和重试机制
 */

import type {
  ApiResponse,
  NoteSkillConfig,
  DEFAULT_SKILL_CONFIG,
} from './types'

/**
 * 判断错误是否可重试（网络错误、5xx、超时）
 */
function isRetryableError(error: unknown, response?: Response): boolean {
  if (!response) return true
  if (response.status >= 500) return true
  if (response.status === 429) return true
  if (response.status === 408) return true
  return false
}

/**
 * 获取用户友好的错误消息
 */
function getErrorMessage(error: unknown, response?: Response): string {
  if (response) {
    switch (response.status) {
      case 400:
        return 'Invalid request. Please check your input parameters.'
      case 401:
        return 'Unauthorized. Please check your credentials.'
      case 403:
        return 'Access forbidden. You do not have permission to perform this action.'
      case 404:
        return 'Resource not found. The requested item may have been deleted or does not exist.'
      case 409:
        return 'Conflict. The resource already exists or is in an incompatible state.'
      case 422:
        return 'Validation error. Please check your input data.'
      case 429:
        return 'Too many requests. Please wait a moment and try again.'
      case 500:
        return 'Server error. Please try again later.'
      case 502:
        return 'Bad gateway. The backend service may be temporarily unavailable.'
      case 503:
        return 'Service unavailable. The server is temporarily unable to handle the request.'
      case 504:
        return 'Gateway timeout. The request took too long to process.'
      default:
        return `HTTP error ${response.status}: ${response.statusText}`
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unknown error occurred. Please try again.'
}

/**
 * 计算指数退避延迟
 */
function getRetryDelay(attemptNumber: number): number {
  const baseDelay = Math.min(1000 * Math.pow(2, attemptNumber - 1), 10000)
  const jitter = baseDelay * 0.25
  return baseDelay + (Math.random() * 2 * jitter - jitter)
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * API Client 类
 */
export class ApiClient {
  private config: NoteSkillConfig

  constructor(config: Partial<NoteSkillConfig> = {}) {
    this.config = {
      ...DEFAULT_SKILL_CONFIG,
      ...config,
    }
  }

  /**
   * 获取 API 基础 URL
   */
  getApiBase(): string {
    if (process.env.NOTE_SKILL_API_URL) {
      return process.env.NOTE_SKILL_API_URL
    }
    return this.config.apiBaseUrl
  }

  /**
   * 发起 HTTP 请求，包含错误处理和重试逻辑
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<ApiResponse<T>> {
    const url = `${this.getApiBase()}${endpoint}`
    const maxRetries = this.config.retries || DEFAULT_SKILL_CONFIG.retries

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }

    try {
      const response = await fetch(url, requestOptions)

      if (!response.ok) {
        const error = getErrorMessage(null, response)

        if (isRetryableError(null, response) && retryCount < maxRetries) {
          const delay = getRetryDelay(retryCount + 1)
          console.warn(`[API] Request failed (HTTP ${response.status}), retrying (${retryCount + 1}/${maxRetries}) after ${Math.round(delay)}ms`)

          await sleep(delay)
          return this.request<T>(endpoint, options, retryCount + 1)
        }

        let errorDetail = error
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorDetail = errorData.error
          }
        } catch {
          // Ignore JSON parse errors
        }

        return {
          success: false,
          error: errorDetail,
        }
      }

      const data = await response.json()

      if (typeof data === 'object' && data !== null && 'success' in data) {
        return data as ApiResponse<T>
      }

      return {
        success: true,
        data: data as T,
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)

      if (isRetryableError(error) && retryCount < maxRetries) {
        const delay = getRetryDelay(retryCount + 1)
        console.warn(`[API] Request failed (network error), retrying (${retryCount + 1}/${maxRetries}) after ${Math.round(delay)}ms: ${errorMessage}`)

        await sleep(delay)
        return this.request<T>(endpoint, options, retryCount + 1)
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * GET 请求
   */
  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | string[] | undefined>): Promise<ApiResponse<T>> {
    let url = endpoint

    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(item => searchParams.append(key, String(item)))
          } else {
            searchParams.append(key, String(value))
          }
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    return this.request<T>(url, {
      method: 'GET',
    })
  }

  /**
   * POST 请求
   */
  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PUT 请求
   */
  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * DELETE 请求
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    })
  }
}

/**
 * 创建 API 客户端实例
 */
export function createApiClient(config?: Partial<NoteSkillConfig>): ApiClient {
  return new ApiClient(config)
}

/**
 * 默认 API 客户端
 * 支持通过环境变量 NOTE_SKILL_API_URL 覆盖默认 URL
 */
export const apiClient = new ApiClient()
