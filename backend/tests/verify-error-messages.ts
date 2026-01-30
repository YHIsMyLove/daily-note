/**
 * Verify error messages are user-friendly across all failure scenarios
 *
 * This test verifies that:
 * 1. Network timeout errors show "Network timeout, retrying..." message
 * 2. Invalid API key errors show "API key invalid" message
 * 3. Quota exceeded errors show "API quota exceeded" message
 * 4. Rate limit errors show "Rate limited, waiting before retry" message
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { classifyError, getUserMessage, formatUserMessage, ErrorType } from '../src/utils/errors'

/**
 * Test 1: Network timeout error message verification
 */
function testNetworkTimeoutMessage() {
  console.log('\n=== Test 1: Network Timeout Error Message ===')

  // Simulate network timeout error
  const timeoutError = new Error('Request timeout: ETIMEDOUT')
  ;(timeoutError as any).code = 'ETIMEDOUT'

  const classified = classifyError(timeoutError)
  const userMessage = getUserMessage(classified)
  const formattedMessage = formatUserMessage(classified)

  console.log('Error Type:', classified.type)
  console.log('Retryable:', classified.retryable)
  console.log('User Message Title:', userMessage.title)
  console.log('User Message:', userMessage.message)
  console.log('Suggestion:', userMessage.suggestion)
  console.log('Formatted Message:', formattedMessage)

  // Verify error classification
  assert.strictEqual(classified.type, ErrorType.TIMEOUT, 'Should be classified as timeout error')
  assert.strictEqual(classified.retryable, true, 'Timeout errors should be retryable')

  // Verify user-friendly messages (in Chinese)
  assert.strictEqual(userMessage.title, '请求超时', 'Title should indicate timeout')
  assert.ok(
    userMessage.message.includes('重试') || userMessage.message.includes('retry'),
    'Message should mention retry'
  )
  assert.ok(
    userMessage.suggestion && userMessage.suggestion.length > 0,
    'Should have a helpful suggestion'
  )

  console.log('✅ Network timeout message is user-friendly')
  return true
}

/**
 * Test 2: Invalid API key error message verification
 */
function testInvalidAPIKeyMessage() {
  console.log('\n=== Test 2: Invalid API Key Error Message ===')

  // Simulate 401 Unauthorized error
  const authError = new Error('Unauthorized: Invalid API key')
  ;(authError as any).status = 401

  const classified = classifyError(authError)
  const userMessage = getUserMessage(classified)
  const formattedMessage = formatUserMessage(classified)

  console.log('Error Type:', classified.type)
  console.log('Retryable:', classified.retryable)
  console.log('User Message Title:', userMessage.title)
  console.log('User Message:', userMessage.message)
  console.log('Suggestion:', userMessage.suggestion)
  console.log('Formatted Message:', formattedMessage)

  // Verify error classification
  assert.strictEqual(classified.type, ErrorType.AUTHENTICATION, 'Should be classified as authentication error')
  assert.strictEqual(classified.retryable, false, 'Authentication errors should not be retryable')

  // Verify user-friendly messages (in Chinese)
  assert.strictEqual(userMessage.title, 'API 密钥无效', 'Title should indicate invalid API key')
  assert.ok(
    userMessage.message.includes('验证') || userMessage.message.includes('API'),
    'Message should mention API key verification'
  )
  assert.ok(
    userMessage.suggestion && userMessage.suggestion.includes('设置'),
    'Should suggest checking settings'
  )

  console.log('✅ Invalid API key message is user-friendly')
  return true
}

/**
 * Test 3: Quota exceeded error message verification
 */
function testQuotaExceededMessage() {
  console.log('\n=== Test 3: Quota Exceeded Error Message ===')

  // Simulate quota exceeded error
  const quotaError = new Error('Quota exceeded: credit balance is zero')
  ;(quotaError as any).status = 429
  ;(quotaError as any).message = 'Quota exceeded: credit balance is zero'

  const classified = classifyError(quotaError)
  const userMessage = getUserMessage(classified)
  const formattedMessage = formatUserMessage(classified)

  console.log('Error Type:', classified.type)
  console.log('Retryable:', classified.retryable)
  console.log('User Message Title:', userMessage.title)
  console.log('User Message:', userMessage.message)
  console.log('Suggestion:', userMessage.suggestion)
  console.log('Formatted Message:', formattedMessage)

  // Verify error classification
  assert.strictEqual(classified.type, ErrorType.QUOTA_EXCEEDED, 'Should be classified as quota exceeded error')
  assert.strictEqual(classified.retryable, false, 'Quota errors should not be retryable')

  // Verify user-friendly messages (in Chinese)
  assert.strictEqual(userMessage.title, 'API 配额已用完', 'Title should indicate quota exceeded')
  assert.ok(
    userMessage.message.includes('额度') || userMessage.message.includes('耗尽'),
    'Message should mention quota exhaustion'
  )
  assert.ok(
    userMessage.suggestion && (userMessage.suggestion.includes('充值') || userMessage.suggestion.includes('控制台')),
    'Should suggest recharging or checking console'
  )

  console.log('✅ Quota exceeded message is user-friendly')
  return true
}

/**
 * Test 4: Rate limit error message verification
 */
function testRateLimitMessage() {
  console.log('\n=== Test 4: Rate Limit Error Message ===')

  // Simulate 429 Rate Limit error
  const rateLimitError = new Error('Rate limit exceeded: too many requests')
  ;(rateLimitError as any).status = 429

  const classified = classifyError(rateLimitError)
  const userMessage = getUserMessage(classified)
  const formattedMessage = formatUserMessage(classified)

  console.log('Error Type:', classified.type)
  console.log('Retryable:', classified.retryable)
  console.log('User Message Title:', userMessage.title)
  console.log('User Message:', userMessage.message)
  console.log('Suggestion:', userMessage.suggestion)
  console.log('Formatted Message:', formattedMessage)

  // Verify error classification
  assert.strictEqual(classified.type, ErrorType.RATE_LIMIT, 'Should be classified as rate limit error')
  assert.strictEqual(classified.retryable, true, 'Rate limit errors should be retryable')

  // Verify user-friendly messages (in Chinese)
  assert.strictEqual(userMessage.title, '请求过于频繁', 'Title should indicate rate limiting')
  assert.ok(
    userMessage.message.includes('自动重试') || userMessage.message.includes('频率'),
    'Message should mention automatic retry or rate limiting'
  )
  assert.ok(
    userMessage.suggestion && userMessage.suggestion.includes('稍等'),
    'Should suggest waiting'
  )

  console.log('✅ Rate limit message is user-friendly')
  return true
}

/**
 * Test 5: Network error message verification
 */
function testNetworkErrorMessage() {
  console.log('\n=== Test 5: Network Error Message ===')

  // Simulate network error
  const networkError = new Error('Network error: ECONNREFUSED')
  ;(networkError as any).code = 'ECONNREFUSED'

  const classified = classifyError(networkError)
  const userMessage = getUserMessage(classified)
  const formattedMessage = formatUserMessage(classified)

  console.log('Error Type:', classified.type)
  console.log('Retryable:', classified.retryable)
  console.log('User Message Title:', userMessage.title)
  console.log('User Message:', userMessage.message)
  console.log('Suggestion:', userMessage.suggestion)
  console.log('Formatted Message:', formattedMessage)

  // Verify error classification
  assert.strictEqual(classified.type, ErrorType.NETWORK, 'Should be classified as network error')
  assert.strictEqual(classified.retryable, true, 'Network errors should be retryable')

  // Verify user-friendly messages (in Chinese)
  assert.strictEqual(userMessage.title, '网络连接失败', 'Title should indicate network failure')
  assert.ok(
    userMessage.message.includes('连接') || userMessage.message.includes('服务器'),
    'Message should mention connection or server'
  )
  assert.ok(
    userMessage.suggestion && userMessage.suggestion.includes('网络'),
    'Should suggest checking network'
  )

  console.log('✅ Network error message is user-friendly')
  return true
}

/**
 * Test 6: Server error message verification (5xx)
 */
function testServerErrorMessage() {
  console.log('\n=== Test 6: Server Error Message (5xx) ===')

  // Simulate 500 Internal Server Error
  const serverError = new Error('Internal Server Error')
  ;(serverError as any).status = 500

  const classified = classifyError(serverError)
  const userMessage = getUserMessage(classified)
  const formattedMessage = formatUserMessage(classified)

  console.log('Error Type:', classified.type)
  console.log('Retryable:', classified.retryable)
  console.log('User Message Title:', userMessage.title)
  console.log('User Message:', userMessage.message)
  console.log('Suggestion:', userMessage.suggestion)
  console.log('Formatted Message:', formattedMessage)

  // Verify error classification
  assert.strictEqual(classified.type, ErrorType.SERVER, 'Should be classified as server error')
  assert.strictEqual(classified.retryable, true, 'Server errors should be retryable')

  // Verify user-friendly messages (in Chinese)
  assert.strictEqual(userMessage.title, '服务器错误', 'Title should indicate server error')
  assert.ok(
    userMessage.message.includes('不可用') || userMessage.message.includes('重试'),
    'Message should mention server unavailability or retry'
  )
  assert.ok(
    userMessage.suggestion && userMessage.suggestion.includes('稍等'),
    'Should suggest waiting'
  )

  console.log('✅ Server error message is user-friendly')
  return true
}

/**
 * Main test runner
 */
function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║  Error Message User-Friendliness Verification                 ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  const tests = [
    { name: 'Network Timeout', fn: testNetworkTimeoutMessage },
    { name: 'Invalid API Key', fn: testInvalidAPIKeyMessage },
    { name: 'Quota Exceeded', fn: testQuotaExceededMessage },
    { name: 'Rate Limit', fn: testRateLimitMessage },
    { name: 'Network Error', fn: testNetworkErrorMessage },
    { name: 'Server Error', fn: testServerErrorMessage },
  ]

  let passed = 0
  let failed = 0

  for (const test of tests) {
    try {
      test.fn()
      passed++
    } catch (error: any) {
      console.error(`\n❌ ${test.name} test failed:`, error.message)
      failed++
    }
  }

  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║  Test Results                                                 ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')
  console.log(`Total Tests: ${tests.length}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)

  if (failed === 0) {
    console.log('\n🎉 All error messages are user-friendly!')
    console.log('\nSummary of verified messages:')
    console.log('  1. Network timeout: "请求超时" + retry message')
    console.log('  2. Invalid API key: "API 密钥无效" + settings suggestion')
    console.log('  3. Quota exceeded: "API 配额已用完" + recharge suggestion')
    console.log('  4. Rate limit: "请求过于频繁" + wait suggestion')
    console.log('  5. Network error: "网络连接失败" + network check suggestion')
    console.log('  6. Server error: "服务器错误" + retry suggestion')
    return 0
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Please review the errors above.`)
    return 1
  }
}

// Run tests
main()
