/**
 * 重试工具函数（前端版本）
 * 提供指数退避和抖动的重试机制，专门为 Axios 优化
 */

/**
 * Axios 错误类型
 */
export interface AxiosErrorLike {
  response?: {
    status: number
    data?: any
  }
  code?: string
  message?: string
  request?: any
}

/**
 * 重试配置选项
 */
export interface RetryOptions {
  /** 最大重试次数（包括首次尝试） */
  maxAttempts?: number
  /** 初始延迟时间（毫秒） */
  initialDelay?: number
  /** 退避倍数 */
  backoffMultiplier?: number
  /** 最大延迟时间（毫秒） */
  maxDelay?: number
  /** 是否添加随机抖动（避免多个客户端同时重试） */
  jitter?: boolean
  /** 判断错误是否可重试的函数 */
  isRetryable?: (error: any) => boolean
  /** 重试前的回调 */
  onRetry?: (error: any, attempt: number) => void
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1秒
  backoffMultiplier: 2,
  maxDelay: 10000, // 10秒
  jitter: true,
  isRetryable: () => true,
  onRetry: () => {},
}

/**
 * 计算带抖动的延迟时间
 * @param baseDelay 基础延迟时间
 * @param jitter 是否添加抖动
 * @returns 实际延迟时间（毫秒）
 */
function calculateDelay(baseDelay: number, jitter: boolean): number {
  if (!jitter) {
    return baseDelay
  }

  // 添加 ±25% 的随机抖动
  const jitterAmount = baseDelay * 0.25
  const randomJitter = Math.random() * 2 * jitterAmount - jitterAmount
  return Math.max(0, baseDelay + randomJitter)
}

/**
 * 睡眠函数
 * @param ms 延迟毫秒数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 带指数退避和抖动的重试函数
 *
 * @param fn 要执行的异步函数
 * @param options 重试配置选项
 * @returns 函数执行结果
 * @throws 当所有重试都失败时，抛出最后一次的错误
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => {
 *     const response = await axios.get('/api/notes')
 *     return response.data
 *   },
 *   { maxAttempts: 3, initialDelay: 1000 }
 * )
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options }

  let lastError: any
  let currentDelay = opts.initialDelay

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // 如果是最后一次尝试，直接抛出错误
      if (attempt >= opts.maxAttempts) {
        throw error
      }

      // 检查错误是否可重试
      if (!opts.isRetryable(error)) {
        throw error
      }

      // 计算延迟时间（指数退避）
      const delay = Math.min(
        calculateDelay(currentDelay, opts.jitter),
        opts.maxDelay
      )

      // 调用重试回调
      opts.onRetry(error, attempt)

      // 等待后重试
      await sleep(delay)

      // 计算下一次的延迟时间（指数增长）
      currentDelay = Math.min(
        currentDelay * opts.backoffMultiplier,
        opts.maxDelay
      )
    }
  }

  // 理论上不会到达这里，但 TypeScript 需要这个返回
  throw lastError
}

/**
 * 判断错误是否为网络错误
 * @param error 错误对象
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false

  // 检查常见的网络错误代码
  const networkCodes = ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNABORTED']
  if (error.code && networkCodes.includes(error.code)) {
    return true
  }

  // 检查是否为 Axios 网络错误（没有 response）
  if (error.isAxiosError && !error.response && error.request) {
    return true
  }

  // 检查错误消息
  const errorMessage = error.message || error.toString()
  const networkMessages = [
    'network',
    'timeout',
    'ECONNREFUSED',
    'ECONNRESET',
    'fetch failed',
    'Network request failed',
    'ERR_NETWORK'
  ]

  return networkMessages.some(msg =>
    errorMessage.toLowerCase().includes(msg.toLowerCase())
  )
}

/**
 * 判断错误是否为超时错误
 * @param error 错误对象
 */
export function isTimeoutError(error: any): boolean {
  if (!error) return false

  const errorMessage = error.message || error.toString() || ''
  return (
    errorMessage.toLowerCase().includes('timeout') ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ESOCKETTIMEDOUT' ||
    error.code === 'ECONNABORTED'
  )
}

/**
 * 判断 HTTP 错误是否可重试
 * @param statusCode HTTP 状态码
 */
export function isHttpStatusCodeRetryable(statusCode: number): boolean {
  // 429 Too Many Requests - 可重试
  if (statusCode === 429) return true

  // 5xx 服务器错误 - 可重试
  if (statusCode >= 500 && statusCode < 600) return true

  // 408 Request Timeout - 可重试
  if (statusCode === 408) return true

  return false
}

/**
 * 判断 Axios 错误是否可重试
 * @param error Axios 错误对象
 */
export function isAxiosErrorRetryable(error: AxiosErrorLike): boolean {
  // 网络错误（无响应）可重试
  if (isNetworkError(error)) {
    return true
  }

  // 超时错误可重试
  if (isTimeoutError(error)) {
    return true
  }

  // 检查 HTTP 状态码
  if (error.response?.status) {
    return isHttpStatusCodeRetryable(error.response.status)
  }

  return false
}

/**
 * 获取友好的错误消息（前端版本）
 * @param error 错误对象
 */
export function getErrorMessage(error: any): string {
  // Axios 错误
  if (error.isAxiosError || error.response) {
    const status = error.response?.status
    const data = error.response?.data

    // 优先使用服务器返回的错误消息
    if (data?.error) {
      return data.error
    }
    if (data?.message) {
      return data.message
    }

    // 根据 HTTP 状态码返回友好消息
    switch (status) {
      case 400:
        return '请求参数错误，请检查输入'
      case 401:
        return '未授权，请重新登录'
      case 403:
        return '无权访问此资源'
      case 404:
        return '请求的资源不存在'
      case 429:
        return '请求过于频繁，请稍后再试'
      case 500:
        return '服务器内部错误，请稍后再试'
      case 502:
      case 503:
        return '服务暂时不可用，请稍后再试'
      case 504:
        return '服务器响应超时，请稍后再试'
      default:
        return status ? `请求失败 (${status})` : '请求失败，请检查网络连接'
    }
  }

  // 网络错误
  if (isNetworkError(error)) {
    return '网络连接失败，请检查网络设置'
  }

  // 超时错误
  if (isTimeoutError(error)) {
    return '请求超时，请稍后再试'
  }

  // 其他错误
  return error?.message || '发生未知错误'
}

/**
 * 判断错误类型（用于日志和调试）
 * @param error 错误对象
 */
export function classifyError(error: any): 'network' | 'timeout' | 'retryable_http' | 'client_error' | 'server_error' | 'unknown' {
  if (isTimeoutError(error)) return 'timeout'
  if (isNetworkError(error)) return 'network'

  if (error.response?.status) {
    const status = error.response.status
    if (status >= 400 && status < 500) return 'client_error'
    if (status >= 500) return 'server_error'
    if (status === 429 || status === 408) return 'retryable_http'
  }

  return 'unknown'
}
