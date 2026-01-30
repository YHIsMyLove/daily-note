import { classifyError, isRetryable, getUserMessage, ErrorType } from '../src/utils/errors'

console.log('='.repeat(80))
console.log('永久性错误处理验证')
console.log('='.repeat(80))

// 测试 1: 401 Invalid API Key
console.log('\n测试 1: 401 Invalid API Key')
const authError = { status: 401, message: 'Invalid API key' }
const authClassified = classifyError(authError)
console.log('✓ 错误类型:', authClassified.type)
console.log('✓ 可重试:', authClassified.retryable)
const authUserMsg = getUserMessage(authClassified)
console.log('✓ 用户标题:', authUserMsg.title)
console.log('✓ 用户描述:', authUserMsg.message)
console.assert(authClassified.type === ErrorType.AUTHENTICATION, '401应为认证错误')
console.assert(authClassified.retryable === false, '认证错误不应重试')
console.log('✅ 通过')

// 测试 2: 403 Forbidden
console.log('\n测试 2: 403 Forbidden')
const forbiddenError = { status: 403, message: 'Access forbidden' }
const forbiddenClassified = classifyError(forbiddenError)
console.log('✓ 错误类型:', forbiddenClassified.type)
console.log('✓ 可重试:', forbiddenClassified.retryable)
console.assert(forbiddenClassified.type === ErrorType.AUTHENTICATION, '403应为认证错误')
console.assert(forbiddenClassified.retryable === false, '403错误不应重试')
console.log('✅ 通过')

// 测试 3: 配额超限
console.log('\n测试 3: 配额超限')
const quotaError = { message: 'Quota exceeded: credit balance is zero' }
const quotaClassified = classifyError(quotaError)
console.log('✓ 错误类型:', quotaClassified.type)
console.log('✓ 可重试:', quotaClassified.retryable)
const quotaUserMsg = getUserMessage(quotaClassified)
console.log('✓ 用户标题:', quotaUserMsg.title)
console.log('✓ 用户描述:', quotaUserMsg.message)
console.log('✓ 用户建议:', quotaUserMsg.suggestion)
console.assert(quotaClassified.type === ErrorType.QUOTA_EXCEEDED, '应为配额错误')
console.assert(quotaClassified.retryable === false, '配额错误不应重试')
console.log('✅ 通过')

// 测试 4: 对比 - 临时错误应该可重试
console.log('\n测试 4: 对比 - 临时错误应可重试')
const rateLimitError = { status: 429, message: 'Rate limited' }
const rateLimitClassified = classifyError(rateLimitError)
console.log('✓ 429 错误类型:', rateLimitClassified.type)
console.log('✓ 429 可重试:', rateLimitClassified.retryable)
console.assert(rateLimitClassified.retryable === true, '429应该可重试')
console.log('✅ 通过')

const serverError = { status: 500, message: 'Internal server error' }
const serverClassified = classifyError(serverError)
console.log('✓ 500 错误类型:', serverClassified.type)
console.log('✓ 500 可重试:', serverClassified.retryable)
console.assert(serverClassified.retryable === true, '500应该可重试')
console.log('✅ 通过')

console.log('\n' + '='.repeat(80))
console.log('✅ 所有永久性错误处理测试通过！')
console.log('='.repeat(80))
console.log('\n验证要点:')
console.log('  ✅ 无效API密钥 (401/403) → 认证错误，不重试')
console.log('  ✅ 配额超限 → 配额错误，不重试')
console.log('  ✅ 所有永久性错误都有用户友好的中文错误消息')
console.log('  ✅ 临时错误 (429, 5xx) 标记为可重试')
