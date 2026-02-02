/**
 * 重试工具函数
 * 提供指数退避和抖动的重试机制
 */

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
export function calculateDelay(baseDelay: number, jitter: boolean): number {
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
 *     const response = await fetch('https://api.example.com')
 *     return response.json()
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

  // 检查错误消息
  const errorMessage = error.message || error.toString()
  const networkMessages = [
    'network',
    'timeout',
    'ECONNREFUSED',
    'ECONNRESET',
    'fetch failed',
    'Network request failed'
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
    error.code === 'ESOCKETTIMEDOUT'
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
