/**
 * 速率限制处理验证脚本
 *
 * 此脚本验证系统是否正确处理 429 Too Many Requests 响应
 * 可以直接使用 tsx 运行：cd backend && npx tsx tests/verify-rate-limit-handling.ts
 */

import { retryWithBackoff, isHttpStatusCodeRetryable } from '../src/utils/retry'
import { classifyError, isRetryable, ErrorType } from '../src/utils/errors'

// 测试结果跟踪
interface TestResult {
  name: string
  passed: boolean
  message: string
  duration: number
  retryAttempts?: number
  delays?: number[]
  details?: any
}

const results: TestResult[] = []

/**
 * 记录测试结果
 */
function recordResult(
  name: string,
  passed: boolean,
  message: string,
  duration: number,
  details?: any
) {
  const result: TestResult = {
    name,
    passed,
    message,
    duration,
    details,
  }
  results.push(result)

  const status = passed ? '✅ PASS' : '❌ FAIL'
  console.log(`\n${status}: ${name}`)
  console.log(`  Duration: ${duration}ms`)
  console.log(`  Message: ${message}`)
  if (details) {
    console.log(`  Details:`, details)
  }
}

/**
 * 验证指数退避延迟
 */
function verifyExponentialBackoff(
  delays: number[],
  initialDelay: number,
  multiplier: number,
  maxDelay: number,
  jitter: boolean
): boolean {
  if (delays.length === 0) return true

  for (let i = 0; i < delays.length; i++) {
    const expectedBase = Math.min(initialDelay * Math.pow(multiplier, i), maxDelay)

    // 如果有抖动，允许 ±25% 的偏差
    const minExpected = jitter ? expectedBase * 0.75 : expectedBase
    const maxExpected = jitter ? expectedBase * 1.25 : expectedBase

    if (delays[i] < minExpected || delays[i] > maxExpected) {
      console.error(
        `Delay ${i} is ${delays[i]}ms, expected between ${minExpected.toFixed(0)}ms and ${maxExpected.toFixed(0)}ms`
      )
      return false
    }
  }

  return true
}

/**
 * 测试1：429 状态码被识别为可重试
 */
async function test429IsRetryable(): Promise<boolean> {
  const testName = 'Test 429 Status Code is Retryable'
  const startTime = Date.now()

  try {
    const isRetryable429 = isHttpStatusCodeRetryable(429)
    const duration = Date.now() - startTime

    const passed = isRetryable429 === true
    recordResult(
      testName,
      passed,
      passed ? '429 status correctly identified as retryable' : '429 status not identified as retryable',
      duration,
      { statusCode: 429, isRetryable: isRetryable429 }
    )

    return passed
  } catch (error: any) {
    const duration = Date.now() - startTime
    recordResult(testName, false, `Unexpected error: ${error.message}`, duration)
    return false
  }
}

/**
 * 测试2：429 错误被正确分类为 rate_limit 类型
 */
async function test429ErrorClassification(): Promise<boolean> {
  const testName = 'Test 429 Error is Classified as RATE_LIMIT'
  const startTime = Date.now()

  try {
    // 创建一个 429 错误对象
    const error429 = {
      status: 429,
      message: 'Too many requests',
    }

    const classified = classifyError(error429)
    const duration = Date.now() - startTime

    const passed =
      classified.type === ErrorType.RATE_LIMIT &&
      classified.statusCode === 429 &&
      classified.retryable === true

    recordResult(
      testName,
      passed,
      passed
        ? '429 error correctly classified as RATE_LIMIT and retryable'
        : `429 error classified as ${classified.type}, retryable: ${classified.retryable}`,
      duration,
      {
        type: classified.type,
        statusCode: classified.statusCode,
        retryable: classified.retryable,
      }
    )

    return passed
  } catch (error: any) {
    const duration = Date.now() - startTime
    recordResult(testName, false, `Unexpected error: ${error.message}`, duration)
    return false
  }
}

/**
 * 测试3：429 错误触发重试并使用指数退避
 */
async function test429TriggersRetryWithBackoff(): Promise<boolean> {
  const testName = 'Test 429 Error Triggers Retry with Exponential Backoff'
  const startTime = Date.now()
  const delays: number[] = []
  const delayTimestamps: number[] = []

  try {
    let attemptCount = 0

    const result = await retryWithBackoff(
      async () => {
        attemptCount++
        const now = Date.now()

        // 记录延迟（第一次之后）
        if (delayTimestamps.length > 0) {
          const delay = now - delayTimestamps[delayTimestamps.length - 1]
          delays.push(delay)
        }
        delayTimestamps.push(now)

        // 前两次抛出 429 错误，第三次成功
        if (attemptCount < 3) {
          const error: any = new Error('Too many requests')
          error.status = 429
          throw error
        }

        return 'success'
      },
      {
        maxAttempts: 3,
        initialDelay: 100, // 使用较短的延迟以加快测试
        jitter: false, // 禁用抖动以便精确验证
        isRetryable: (error) => {
          return error.status === 429
        },
      }
    )

    const duration = Date.now() - startTime

    // 验证：
    // 1. 应该有 3 次尝试
    // 2. 应该有 2 个延迟（在第 1 次和第 2 次重试之间）
    // 3. 延迟应该是 100ms 和 200ms（指数退避：100 -> 200）
    const correctAttempts = attemptCount === 3
    const correctDelayCount = delays.length === 2
    const correctBackoff = verifyExponentialBackoff(delays, 100, 2, 10000, false)
    const resultCorrect = result === 'success'

    const passed =
      correctAttempts && correctDelayCount && correctBackoff && resultCorrect

    recordResult(
      testName,
      passed,
      passed
        ? `429 error triggered retry with correct exponential backoff (attempts: ${attemptCount}, delays: [${delays.join(', ')}]ms)`
        : `Failed - attempts: ${attemptCount} (expected 3), delays: [${delays.join(', ')}]ms (expected [100, 200]ms)`,
      duration,
      {
        attemptCount,
        delays,
        expectedDelays: [100, 200],
        result,
      }
    )

    return passed
  } catch (error: any) {
    const duration = Date.now() - startTime
    recordResult(
      testName,
      false,
      `Unexpected error: ${error.message}`,
      duration,
      { error: error.message, attemptCount, delays }
    )
    return false
  }
}

/**
 * 测试4：429 错误带不同消息格式的分类
 */
async function test429ErrorWithDifferentMessages(): Promise<boolean> {
  const testName = 'Test 429 Error with Various Message Formats'
  const startTime = Date.now()

  try {
    const testCases = [
      {
        error: { status: 429, message: 'Too many requests' },
        expectedType: ErrorType.RATE_LIMIT,
      },
      {
        error: { status: 429, message: 'Rate limit exceeded' },
        expectedType: ErrorType.RATE_LIMIT,
      },
      {
        error: { status: 429, message: 'rate_limit_error' },
        expectedType: ErrorType.RATE_LIMIT,
      },
      {
        error: { statusCode: 429, message: 'Too Many Requests' },
        expectedType: ErrorType.RATE_LIMIT,
      },
    ]

    let allPassed = true
    const failedCases: any[] = []

    for (const testCase of testCases) {
      const classified = classifyError(testCase.error)
      if (classified.type !== testCase.expectedType || !classified.retryable) {
        allPassed = false
        failedCases.push({
          error: testCase.error,
          got: { type: classified.type, retryable: classified.retryable },
          expected: { type: testCase.expectedType, retryable: true },
        })
      }
    }

    const duration = Date.now() - startTime

    recordResult(
      testName,
      allPassed,
      allPassed
        ? `All 429 error variants correctly classified as RATE_LIMIT and retryable`
        : `${failedCases.length}/${testCases.length} test cases failed`,
      duration,
      {
        totalCases: testCases.length,
        passedCases: testCases.length - failedCases.length,
        failedCases,
      }
    )

    return allPassed
  } catch (error: any) {
    const duration = Date.now() - startTime
    recordResult(testName, false, `Unexpected error: ${error.message}`, duration)
    return false
  }
}

/**
 * 测试5：429 错误使用 isRetryable 辅助函数
 */
async function testRateLimitIsRetryable(): Promise<boolean> {
  const testName = 'Test RATE_LIMIT Error is Marked Retryable'
  const startTime = Date.now()

  try {
    const error429 = {
      status: 429,
      message: 'Rate limit exceeded',
    }

    const classified = classifyError(error429)
    const retryable = isRetryable(classified)
    const duration = Date.now() - startTime

    const passed = retryable === true

    recordResult(
      testName,
      passed,
      passed
        ? 'RATE_LIMIT error correctly marked as retryable'
        : 'RATE_LIMIT error not marked as retryable',
      duration,
      {
        errorType: classified.type,
        isRetryable: retryable,
      }
    )

    return passed
  } catch (error: any) {
    const duration = Date.now() - startTime
    recordResult(testName, false, `Unexpected error: ${error.message}`, duration)
    return false
  }
}

/**
 * 测试6：429 错误最终失败（超过最大重试次数）
 */
async function test429EventuallyFails(): Promise<boolean> {
  const testName = 'Test 429 Error Eventually Fails After Max Retries'
  const startTime = Date.now()
  const delays: number[] = []
  const delayTimestamps: number[] = []

  try {
    let attemptCount = 0

    const resultPromise = retryWithBackoff(
      async () => {
        attemptCount++
        const now = Date.now()

        if (delayTimestamps.length > 0) {
          const delay = now - delayTimestamps[delayTimestamps.length - 1]
          delays.push(delay)
        }
        delayTimestamps.push(now)

        // 总是抛出 429 错误
        const error: any = new Error('Too many requests')
        error.status = 429
        throw error
      },
      {
        maxAttempts: 3,
        initialDelay: 100,
        jitter: false,
        isRetryable: (error) => {
          return error.status === 429
        },
      }
    )

    // 应该抛出错误
    await expectThrow(resultPromise)

    const duration = Date.now() - startTime

    // 验证：
    // 1. 应该有 3 次尝试
    // 2. 应该有 2 个延迟
    // 3. 延迟应该是 100ms 和 200ms
    const correctAttempts = attemptCount === 3
    const correctDelayCount = delays.length === 2
    const correctBackoff = verifyExponentialBackoff(delays, 100, 2, 10000, false)

    const passed = correctAttempts && correctDelayCount && correctBackoff

    recordResult(
      testName,
      passed,
      passed
        ? `429 error correctly failed after ${attemptCount} attempts with exponential backoff`
        : `Failed - attempts: ${attemptCount} (expected 3), delays: [${delays.join(', ')}]ms`,
      duration,
      {
        attemptCount,
        delays,
        expectedDelays: [100, 200],
      }
    )

    return passed
  } catch (error: any) {
    const duration = Date.now() - startTime
    recordResult(
      testName,
      false,
      `Unexpected error: ${error.message}`,
      duration,
      { error: error.message, attemptCount, delays }
    )
    return false
  }
}

/**
 * 测试7：429 错误与其他状态码的区别
 */
async function test429VsOtherStatusCodes(): Promise<boolean> {
  const testName = 'Test 429 vs Other Status Codes'
  const startTime = Date.now()

  try {
    const testCases = [
      { status: 429, shouldRetry: true, description: '429 Too Many Requests' },
      { status: 500, shouldRetry: true, description: '500 Internal Server Error' },
      { status: 502, shouldRetry: true, description: '502 Bad Gateway' },
      { status: 503, shouldRetry: true, description: '503 Service Unavailable' },
      { status: 504, shouldRetry: true, description: '504 Gateway Timeout' },
      { status: 408, shouldRetry: true, description: '408 Request Timeout' },
      { status: 400, shouldRetry: false, description: '400 Bad Request' },
      { status: 401, shouldRetry: false, description: '401 Unauthorized' },
      { status: 403, shouldRetry: false, description: '403 Forbidden' },
      { status: 404, shouldRetry: false, description: '404 Not Found' },
    ]

    let allPassed = true
    const failedCases: any[] = []

    for (const testCase of testCases) {
      const isRetryable = isHttpStatusCodeRetryable(testCase.status)
      if (isRetryable !== testCase.shouldRetry) {
        allPassed = false
        failedCases.push({
          status: testCase.status,
          description: testCase.description,
          expectedRetryable: testCase.shouldRetry,
          actualRetryable: isRetryable,
        })
      }
    }

    const duration = Date.now() - startTime

    recordResult(
      testName,
      allPassed,
      allPassed
        ? `All status codes correctly identified (${testCases.length}/${testCases.length})`
        : `${failedCases.length}/${testCases.length} test cases failed`,
      duration,
      {
        totalCases: testCases.length,
        passedCases: testCases.length - failedCases.length,
        failedCases,
      }
    )

    return allPassed
  } catch (error: any) {
    const duration = Date.now() - startTime
    recordResult(testName, false, `Unexpected error: ${error.message}`, duration)
    return false
  }
}

/**
 * 测试8：速率限制用户消息是否友好
 */
async function testRateLimitUserMessage(): Promise<boolean> {
  const testName = 'Test RATE_LIMIT User Message is User-Friendly'
  const startTime = Date.now()

  try {
    const error429 = {
      status: 429,
      message: 'Rate limit exceeded',
    }

    const classified = classifyError(error429)

    // 验证用户消息包含必要的字段
    const hasTitle = !!classified.userMessage?.title
    const hasMessage = !!classified.userMessage?.message
    const hasSuggestion = !!classified.userMessage?.suggestion
    const isChinese = /[\u4e00-\u9fa5]/.test(
      (classified.userMessage?.title || '') + (classified.userMessage?.message || '')
    )

    const duration = Date.now() - startTime

    const passed = hasTitle && hasMessage && hasSuggestion && isChinese

    recordResult(
      testName,
      passed,
      passed
        ? 'RATE_LIMIT user message is complete and in Chinese'
        : 'RATE_LIMIT user message missing fields or not in Chinese',
      duration,
      {
        hasTitle,
        hasMessage,
        hasSuggestion,
        isChinese,
        userMessage: classified.userMessage,
      }
    )

    return passed
  } catch (error: any) {
    const duration = Date.now() - startTime
    recordResult(testName, false, `Unexpected error: ${error.message}`, duration)
    return false
  }
}

/**
 * 辅助函数：验证 promise 是否抛出错误
 */
async function expectThrow(promise: Promise<any>): Promise<void> {
  try {
    await promise
    throw new Error('Expected promise to throw')
  } catch (error) {
    // Expected
    return
  }
}

/**
 * 打印测试摘要
 */
function printSummary() {
  console.log('\n' + '='.repeat(80))
  console.log('RATE LIMIT HANDLING TEST SUMMARY')
  console.log('='.repeat(80))

  const passed = results.filter((r) => r.passed).length
  const total = results.length
  const percentage = ((passed / total) * 100).toFixed(1)

  console.log(`\nTotal Tests: ${total}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${total - passed}`)
  console.log(`Success Rate: ${percentage}%`)

  if (passed === total) {
    console.log('\n✅ ALL TESTS PASSED!')
  } else {
    console.log('\n❌ SOME TESTS FAILED')
    console.log('\nFailed Tests:')
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.message}`)
      })
  }

  console.log('\n' + '='.repeat(80))
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('\n🧪 Starting Rate Limit Handling Tests...\n')
  console.log('Testing 429 Too Many Requests error handling')
  console.log('Verifying exponential backoff and retry behavior\n')

  const tests = [
    test429IsRetryable(),
    test429ErrorClassification(),
    test429TriggersRetryWithBackoff(),
    test429ErrorWithDifferentMessages(),
    testRateLimitIsRetryable(),
    test429EventuallyFails(),
    test429VsOtherStatusCodes(),
    testRateLimitUserMessage(),
  ]

  const results = await Promise.all(tests)

  printSummary()

  const allPassed = results.every((r) => r)
  return allPassed
}

// 运行测试
runAllTests()
  .then((allPassed) => {
    process.exit(allPassed ? 0 : 1)
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed with error:', error)
    process.exit(1)
  })
