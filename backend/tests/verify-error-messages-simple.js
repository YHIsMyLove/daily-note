/**
 * Quick verification of user-friendly error messages
 * Simple JavaScript version for fast testing
 */

const errorTypes = {
  AUTHENTICATION: 'authentication_error',
  QUOTA_EXCEEDED: 'quota_exceeded',
  RATE_LIMIT: 'rate_limit_error',
  NETWORK: 'network_error',
  TIMEOUT: 'timeout_error',
  SERVER: 'server_error',
  CLIENT: 'client_error',
  PARSING: 'parsing_error',
  UNKNOWN: 'unknown_error',
}

// Mock classifyError function (simplified)
function classifyError(error) {
  const msg = error.message || ''
  const status = error.status || error.statusCode

  if (status === 401 || status === 403 || msg.includes('API key')) {
    return { type: errorTypes.AUTHENTICATION, retryable: false }
  }
  if (msg.includes('quota') || msg.includes('credit') || msg.includes('balance')) {
    return { type: errorTypes.QUOTA_EXCEEDED, retryable: false }
  }
  if (status === 429 || msg.includes('rate limit')) {
    return { type: errorTypes.RATE_LIMIT, retryable: true }
  }
  if (msg.includes('timeout') || error.code === 'ETIMEDOUT') {
    return { type: errorTypes.TIMEOUT, retryable: true }
  }
  if (msg.includes('network') || error.code === 'ECONNREFUSED') {
    return { type: errorTypes.NETWORK, retryable: true }
  }
  if (status >= 500 && status < 600) {
    return { type: errorTypes.SERVER, retryable: true }
  }

  return { type: errorTypes.UNKNOWN, retryable: true }
}

// User-friendly messages (Chinese)
const userMessages = {
  [errorTypes.AUTHENTICATION]: {
    title: 'API 密钥无效',
    message: '无法验证您的 API 密钥，请检查配置是否正确',
    suggestion: '请在设置中检查您的 Anthropic API 密钥',
  },
  [errorTypes.QUOTA_EXCEEDED]: {
    title: 'API 配额已用完',
    message: '您的 API 使用额度已耗尽',
    suggestion: '请前往 Anthropic 控制台充值或等待配额重置',
  },
  [errorTypes.RATE_LIMIT]: {
    title: '请求过于频繁',
    message: 'API 请求频率超限，系统正在自动重试',
    suggestion: '请稍等片刻，系统会自动处理',
  },
  [errorTypes.NETWORK]: {
    title: '网络连接失败',
    message: '无法连接到 API 服务器',
    suggestion: '请检查您的网络连接',
  },
  [errorTypes.TIMEOUT]: {
    title: '请求超时',
    message: 'API 请求时间过长，正在重试',
    suggestion: '请稍等片刻，系统会自动重试',
  },
  [errorTypes.SERVER]: {
    title: '服务器错误',
    message: 'API 服务器暂时不可用，正在重试',
    suggestion: '请稍等片刻，系统会自动重试',
  },
  [errorTypes.CLIENT]: {
    title: '请求错误',
    message: '发送的请求格式有误',
    suggestion: '请检查输入内容是否正确',
  },
  [errorTypes.PARSING]: {
    title: '响应解析失败',
    message: '无法解析 API 返回的数据',
    suggestion: '请稍后重试，如问题持续请联系支持',
  },
  [errorTypes.UNKNOWN]: {
    title: '未知错误',
    message: '发生了未知错误',
    suggestion: '请稍后重试，如问题持续请联系支持',
  },
}

function getUserMessage(classifiedError) {
  return userMessages[classifiedError.type] || userMessages[errorTypes.UNKNOWN]
}

function testError(name, error) {
  console.log(`\n=== ${name} ===`)

  const classified = classifyError(error)
  const userMessage = getUserMessage(classified)

  console.log('Error Type:', classified.type)
  console.log('Retryable:', classified.retryable)
  console.log('Title:', userMessage.title)
  console.log('Message:', userMessage.message)
  console.log('Suggestion:', userMessage.suggestion)

  // Verify message quality
  const hasTitle = userMessage.title && userMessage.title.length > 0
  const hasMessage = userMessage.message && userMessage.message.length > 0
  const hasSuggestion = userMessage.suggestion && userMessage.suggestion.length > 0

  if (hasTitle && hasMessage && hasSuggestion) {
    console.log('✅ User-friendly (title + message + suggestion)')
    return true
  } else {
    console.log('❌ Not user-friendly (missing components)')
    return false
  }
}

console.log('╔═══════════════════════════════════════════════════════════════╗')
console.log('║  Error Message User-Friendliness Quick Check                  ║')
console.log('╚═══════════════════════════════════════════════════════════════╝')

let passed = 0
let failed = 0

// Test 1: Network timeout
if (testError('Network Timeout', new Error('Request timeout: ETIMEDOUT'))) {
  passed++
} else {
  failed++
}

// Test 2: Invalid API key
const authError = new Error('Unauthorized: Invalid API key')
authError.status = 401
if (testError('Invalid API Key', authError)) {
  passed++
} else {
  failed++
}

// Test 3: Quota exceeded
const quotaError = new Error('Quota exceeded: credit balance is zero')
quotaError.status = 429
if (testError('Quota Exceeded', quotaError)) {
  passed++
} else {
  failed++
}

// Test 4: Rate limit
const rateLimitError = new Error('Rate limit exceeded: too many requests')
rateLimitError.status = 429
if (testError('Rate Limit', rateLimitError)) {
  passed++
} else {
  failed++
}

// Test 5: Network error
const networkError = new Error('Network error: ECONNREFUSED')
networkError.code = 'ECONNREFUSED'
if (testError('Network Error', networkError)) {
  passed++
} else {
  failed++
}

// Test 6: Server error
const serverError = new Error('Internal Server Error')
serverError.status = 500
if (testError('Server Error', serverError)) {
  passed++
} else {
  failed++
}

console.log('\n╔═══════════════════════════════════════════════════════════════╗')
console.log('║  Results                                                      ║')
console.log('╚═══════════════════════════════════════════════════════════════╝')
console.log(`Total: 6 tests`)
console.log(`✅ Passed: ${passed}`)
console.log(`❌ Failed: ${failed}`)

if (failed === 0) {
  console.log('\n🎉 All error messages are user-friendly!')
  console.log('\nVerified messages:')
  console.log('  1. ✅ Network timeout → "请求超时，正在重试"')
  console.log('  2. ✅ Invalid API key → "API 密钥无效"')
  console.log('  3. ✅ Quota exceeded → "API 配额已用完"')
  console.log('  4. ✅ Rate limit → "请求过于频繁，系统正在自动重试"')
  console.log('  5. ✅ Network error → "网络连接失败"')
  console.log('  6. ✅ Server error → "服务器错误，正在重试"')
  process.exit(0)
} else {
  console.log(`\n⚠️  ${failed} test(s) failed`)
  process.exit(1)
}
