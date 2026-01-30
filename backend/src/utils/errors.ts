/**
 * 错误分类和处理工具
 * 提供错误类型识别和用户友好的错误消息
 */

/**
 * 错误类型枚举
 */
export enum ErrorType {
  /** 认证错误（API key 无效、权限不足等） */
  AUTHENTICATION = 'authentication_error',
  /** API 配额超限 */
  QUOTA_EXCEEDED = 'quota_exceeded',
  /** 速率限制错误 */
  RATE_LIMIT = 'rate_limit_error',
  /** 网络错误 */
  NETWORK = 'network_error',
  /** 超时错误 */
  TIMEOUT = 'timeout_error',
  /** 服务器错误（5xx） */
  SERVER = 'server_error',
  /** 客户端错误（4xx，除 401/403/429 外） */
  CLIENT = 'client_error',
  /** 解析错误（响应解析失败） */
  PARSING = 'parsing_error',
  /** 未知错误 */
  UNKNOWN = 'unknown_error',
}

/**
 * 分类错误结果接口
 */
export interface ClassifiedError {
  /** 错误类型 */
  type: ErrorType
  /** 原始错误对象 */
  originalError: any
  /** HTTP 状态码（如果有） */
  statusCode?: number
  /** 是否可重试 */
  retryable: boolean
  /** 错误详情（用于日志记录） */
  details: string
}

/**
 * 用户友好的错误消息
 */
export interface UserErrorMessage {
  /** 用户可见的标题 */
  title: string
  /** 用户可见的描述 */
  message: string
  /** 建议的操作 */
  suggestion?: string
}

/**
 * 用户友好错误消息映射
 */
const USER_MESSAGES: Record<ErrorType, UserErrorMessage> = {
  [ErrorType.AUTHENTICATION]: {
    title: 'API 密钥无效',
    message: '无法验证您的 API 密钥，请检查配置是否正确',
    suggestion: '请在设置中检查您的 Anthropic API 密钥',
  },
  [ErrorType.QUOTA_EXCEEDED]: {
    title: 'API 配额已用完',
    message: '您的 API 使用额度已耗尽',
    suggestion: '请前往 Anthropic 控制台充值或等待配额重置',
  },
  [ErrorType.RATE_LIMIT]: {
    title: '请求过于频繁',
    message: 'API 请求频率超限，系统正在自动重试',
    suggestion: '请稍等片刻，系统会自动处理',
  },
  [ErrorType.NETWORK]: {
    title: '网络连接失败',
    message: '无法连接到 API 服务器',
    suggestion: '请检查您的网络连接',
  },
  [ErrorType.TIMEOUT]: {
    title: '请求超时',
    message: 'API 请求时间过长，正在重试',
    suggestion: '请稍等片刻，系统会自动重试',
  },
  [ErrorType.SERVER]: {
    title: '服务器错误',
    message: 'API 服务器暂时不可用，正在重试',
    suggestion: '请稍等片刻，系统会自动重试',
  },
  [ErrorType.CLIENT]: {
    title: '请求错误',
    message: '发送的请求格式有误',
    suggestion: '请检查输入内容是否正确',
  },
  [ErrorType.PARSING]: {
    title: '响应解析失败',
    message: '无法解析 API 返回的数据',
    suggestion: '请稍后重试，如问题持续请联系支持',
  },
  [ErrorType.UNKNOWN]: {
    title: '未知错误',
    message: '发生了未知错误',
    suggestion: '请稍后重试，如问题持续请联系支持',
  },
}

/**
 * 从错误对象中提取 HTTP 状态码
 * @param error 错误对象
 * @returns HTTP 状态码或 undefined
 */
function extractStatusCode(error: any): number | undefined {
  if (!error) return undefined

  // Anthropic SDK 错误结构
  if (error.status) {
    return error.status
  }

  // 标准 HTTP 错误
  if (error.statusCode) {
    return error.statusCode
  }

  // Axios 错误
  if (error.response?.status) {
    return error.response.status
  }

  return undefined
}

/**
 * 从错误对象中提取错误消息
 * @param error 错误对象
 * @returns 错误消息
 */
function extractErrorMessage(error: any): string {
  if (!error) return '未知错误'

  if (error.message) {
    return error.message
  }

  if (error.error?.message) {
    return error.error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return error.toString()
}

/**
 * 检查错误是否为认证错误
 * @param error 错误对象
 * @param statusCode HTTP 状态码
 */
function isAuthenticationError(error: any, statusCode?: number): boolean {
  const errorMessage = extractErrorMessage(error).toLowerCase()

  // 检查状态码
  if (statusCode === 401 || statusCode === 403) {
    return true
  }

  // 检查错误消息关键词
  const authKeywords = [
    'api key',
    'authentication',
    'unauthorized',
    'invalid api key',
    'forbidden',
    '权限',
    '认证',
    '密钥',
  ]

  return authKeywords.some(keyword => errorMessage.includes(keyword))
}

/**
 * 检查错误是否为配额超限错误
 * @param error 错误对象
 * @param statusCode HTTP 状态码
 */
function isQuotaExceededError(error: any, statusCode?: number): boolean {
  const errorMessage = extractErrorMessage(error).toLowerCase()

  // 检查状态码
  if (statusCode === 429) {
    // 429 可能是 rate limit 或 quota exceeded，需要根据消息区分
    const quotaKeywords = ['quota', 'credit', 'balance', 'billing', 'usage limit']
    return quotaKeywords.some(keyword => errorMessage.includes(keyword))
  }

  // 检查错误消息关键词
  const quotaKeywords = [
    'quota exceeded',
    'credit',
    'balance',
    'billing',
    'usage limit',
    '配额',
    '额度',
    '余额',
  ]

  return quotaKeywords.some(keyword => errorMessage.includes(keyword))
}

/**
 * 检查错误是否为速率限制错误
 * @param error 错误对象
 * @param statusCode HTTP 状态码
 */
function isRateLimitError(error: any, statusCode?: number): boolean {
  const errorMessage = extractErrorMessage(error).toLowerCase()

  // 检查状态码
  if (statusCode === 429) {
    return true
  }

  // 检查错误消息关键词
  const rateLimitKeywords = [
    'rate limit',
    'too many requests',
    '请求过多',
    '频率限制',
  ]

  return rateLimitKeywords.some(keyword => errorMessage.includes(keyword))
}

/**
 * 检查错误是否为解析错误
 * @param error 错误对象
 */
function isParsingError(error: any): boolean {
  const errorMessage = extractErrorMessage(error).toLowerCase()

  const parsingKeywords = [
    'json',
    'parse',
    'invalid response',
    'unexpected token',
    '解析',
    '格式',
  ]

  return parsingKeywords.some(keyword => errorMessage.includes(keyword))
}

/**
 * 分类错误
 *
 * 根据错误内容自动识别错误类型，并返回分类结果
 *
 * @param error 原始错误对象
 * @returns 分类后的错误对象
 *
 * @example
 * ```typescript
 * try {
 *   await claudeAPIcall()
 * } catch (error) {
 *   const classified = classifyError(error)
 *   console.log(`Error type: ${classified.type}`)
 *   console.log(`Retryable: ${classified.retryable}`)
 * }
 * ```
 */
export function classifyError(error: any): ClassifiedError {
  const statusCode = extractStatusCode(error)
  const errorMessage = extractErrorMessage(error)

  // 1. 检查认证错误
  if (isAuthenticationError(error, statusCode)) {
    return {
      type: ErrorType.AUTHENTICATION,
      originalError: error,
      statusCode,
      retryable: false,
      details: errorMessage,
    }
  }

  // 2. 检查配额超限错误
  if (isQuotaExceededError(error, statusCode)) {
    return {
      type: ErrorType.QUOTA_EXCEEDED,
      originalError: error,
      statusCode,
      retryable: false,
      details: errorMessage,
    }
  }

  // 3. 检查速率限制错误
  if (isRateLimitError(error, statusCode)) {
    return {
      type: ErrorType.RATE_LIMIT,
      originalError: error,
      statusCode,
      retryable: true,
      details: errorMessage,
    }
  }

  // 4. 检查网络错误
  if (errorMessage.toLowerCase().includes('network') ||
      errorMessage.toLowerCase().includes('econnrefused') ||
      errorMessage.toLowerCase().includes('enotfound')) {
    return {
      type: ErrorType.NETWORK,
      originalError: error,
      statusCode,
      retryable: true,
      details: errorMessage,
    }
  }

  // 5. 检查超时错误
  if (errorMessage.toLowerCase().includes('timeout') ||
      errorMessage.toLowerCase().includes('etimedout')) {
    return {
      type: ErrorType.TIMEOUT,
      originalError: error,
      statusCode,
      retryable: true,
      details: errorMessage,
    }
  }

  // 6. 检查服务器错误 (5xx)
  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return {
      type: ErrorType.SERVER,
      originalError: error,
      statusCode,
      retryable: true,
      details: errorMessage,
    }
  }

  // 7. 检查客户端错误 (4xx)
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return {
      type: ErrorType.CLIENT,
      originalError: error,
      statusCode,
      retryable: false,
      details: errorMessage,
    }
  }

  // 8. 检查解析错误
  if (isParsingError(error)) {
    return {
      type: ErrorType.PARSING,
      originalError: error,
      statusCode,
      retryable: true,
      details: errorMessage,
    }
  }

  // 9. 未知错误
  return {
    type: ErrorType.UNKNOWN,
    originalError: error,
    statusCode,
    retryable: true,
    details: errorMessage,
  }
}

/**
 * 获取用户友好的错误消息
 *
 * 根据分类后的错误，返回适合展示给用户的错误消息
 *
 * @param error 分类后的错误对象或原始错误对象
 * @returns 用户友好的错误消息
 *
 * @example
 * ```typescript
 * try {
 *   await claudeAPIcall()
 * } catch (error) {
 *   const classified = classifyError(error)
 *   const userMessage = getUserMessage(classified)
 *   console.log(`${userMessage.title}: ${userMessage.message}`)
 *   if (userMessage.suggestion) {
 *     console.log(`建议: ${userMessage.suggestion}`)
 *   }
 * }
 * ```
 */
export function getUserMessage(error: ClassifiedError | any): UserErrorMessage {
  // 如果传入的是已分类的错误
  if (error && typeof error === 'object' && 'type' in error) {
    const classified = error as ClassifiedError
    return USER_MESSAGES[classified.type] || USER_MESSAGES[ErrorType.UNKNOWN]
  }

  // 如果传入的是原始错误，先分类
  const classified = classifyError(error)
  return USER_MESSAGES[classified.type] || USER_MESSAGES[ErrorType.UNKNOWN]
}

/**
 * 格式化用户友好的错误消息为字符串
 *
 * @param error 分类后的错误对象或原始错误对象
 * @returns 格式化后的错误消息字符串
 *
 * @example
 * ```typescript
 * try {
 *   await claudeAPIcall()
 * } catch (error) {
 *   console.error(formatUserMessage(error))
 * }
 * ```
 */
export function formatUserMessage(error: ClassifiedError | any): string {
  const userMessage = getUserMessage(error)
  let result = `${userMessage.title}: ${userMessage.message}`

  if (userMessage.suggestion) {
    result += `\n建议: ${userMessage.suggestion}`
  }

  return result
}

/**
 * 检查错误是否可重试
 *
 * @param error 错误对象
 * @returns 是否可重试
 */
export function isRetryable(error: any): boolean {
  const classified = classifyError(error)
  return classified.retryable
}
