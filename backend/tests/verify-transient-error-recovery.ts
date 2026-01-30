/**
 * 瞬态错误恢复验证脚本
 *
 * 此脚本验证重试逻辑和指数退避是否正常工作
 * 可以直接使用 tsx 运行：cd backend && npx tsx tests/verify-transient-error-recovery.ts
 */

import { retryWithBackoff, isNetworkError, isTimeoutError, isHttpStatusCodeRetryable } from '../src/utils/retry'

// 测试结果跟踪
interface TestResult {
  name: string
  passed: boolean
  message: string
  duration: number
  retryAttempts: number
  delays: number[]
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
  retryAttempts = 0,
  delays: number[] = []
) {
  const result: TestResult = {
    name,
    passed,
    message,
    duration,
    retryAttempts,
    delays,
  }
  results.push(result)

  const status = passed ? '✅ PASS' : '❌ FAIL'
  console.log(`\n${status}: ${name}`)
  console.log(`  Duration: ${duration}ms`)
  if (retryAttempts > 0) {
    console.log(`  Retry Attempts: ${retryAttempts}`)
    console.log(`  Delays: [${delays.map((d) => `${d}ms`).join(', ')}]`)
  }
  console.log(`  Message: ${message}`)
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
 * 测试1：网络超时后成功重试
 */
async function testRetryWithNetworkTimeout(): Promise<boolean> {
  const testName = 'Retry with Network Timeout (Eventual Success)'
  const startTime = Date.now()
  const delays: number[] = []
  let attemptCount = 0

  try {
    let attempts = 0
    const delayTimestamps: number[] = []

    const result = await retryWithBackoff(
      async () => {
        attempts++
        const now = Date.now()

        if (attempts === 1) {
          // 第一次调用：抛出超时错误
          delayTimestamps.push(now)
          throw new Error('ETIMEDOUT')
        } else if (attempts === 2) {
          // 第二次调用：记录延迟并再次抛出超时错误
          const delay = now - delayTimestamps[0]
          delays.push(delay)
          delayTimestamps.push(now)
          throw new Error('ETIMEDOUT')
        } else {
          // 第三次调用：记录延迟并返回成功
          const delay = now - delayTimestamps[1]
          delays.push(delay)
          return { success: true, attempts }
        }
      },
      {
        maxAttempts: 3,
        initialDelay: 100, // 100ms 用于快速测试
        backoffMultiplier: 2,
        maxDelay: 500,
        jitter: false, // 禁用抖动以便验证
        isRetryable: (error) => {
          return error.message === 'ETIMEDOUT'
        },
      }
    )

    const duration = Date.now() - startTime
    attemptCount = attempts

    // 验证结果
    if (!result.success) {
      recordResult(testName, false, 'Result should be successful', duration, attempts, delays)
      return false
    }

    if (attempts !== 3) {
      recordResult(testName, false, `Expected 3 attempts, got ${attempts}`, duration, attempts, delays)
      return false
    }

    if (delays.length !== 2) {
      recordResult(testName, false, `Expected 2 delays, got ${delays.length}`, duration, attempts, delays)
      return false
    }

    // 验证指数退避：第一次 ~100ms, 第二次 ~200ms
    const backoffValid = verifyExponentialBackoff(delays, 100, 2, 500, false)

    recordResult(
      testName,
      backoffValid,
      backoffValid
        ? 'Successfully retried with exponential backoff after network timeout'
        : 'Exponential backoff delays are incorrect',
      duration,
      attempts,
      delays
    )

    return backoffValid
  } catch (error: any) {
    const duration = Date.now() - startTime
    recordResult(testName, false, `Unexpected error: ${error.message}`, duration, attemptCount, delays)
    return false
  }
}

/**
 * 测试2：速率限制（429）后成功重试
 */
async function testRetryWithRateLimit(): Promise<boolean> {
  const testName = 'Retry with Rate Limit 429 (Eventual Success)'
  const startTime = Date.now()
  const delays: number[] = []
  let attemptCount = 0

  try {
    let attempts = 0
    const delayTimestamps: number[] = []

    const result = await retryWithBackoff(
      async () => {
        attempts++
        const now = Date.now()

        if (attempts < 3) {
          // 前两次调用：抛出 429 错误
          if (attempts > 1) {
            const delay = now - delayTimestamps[delayTimestamps.length - 1]
            delays.push(delay)
          }
          delayTimestamps.push(now)

          const error: any = new Error('Rate limit exceeded')
          error.statusCode = 429
          throw error
        } else {
          // 第三次调用：记录延迟并返回成功
          const delay = now - delayTimestamps[delayTimestamps.length - 1]
          delays.push(delay)
          return { success: true, attempts }
        }
      },
      {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
        maxDelay: 500,
        jitter: false,
        isRetryable: (error) => {
          return error.statusCode === 429
        },
      }
    )

    const duration = Date.now() - startTime
    attemptCount = attempts

    // 验证结果
    if (!result.success) {
      recordResult(testName, false, 'Result should be successful', duration, attempts, delays)
      return false
    }

    if (attempts !== 3) {
      recordResult(testName, false, `Expected 3 attempts, got ${attempts}`, duration, attempts, delays)
      return false
    }

    if (delays.length !== 2) {
      recordResult(testName, false, `Expected 2 delays, got ${delays.length}`, duration, attempts, delays)
      return false
    }

    // 验证指数退避
    const backoffValid = verifyExponentialBackoff(delays, 100, 2, 500, false)

    recordResult(
      testName,
      backoffValid,
      backoffValid
        ? 'Successfully retried with exponential backoff after rate limit'
        : 'Exponential backoff delays are incorrect',
      duration,
      attempts,
      delays
    )

    return backoffValid
  } catch (error: any) {
    const duration = Date.now() - startTime
    recordResult(testName, false, `Unexpected error: ${error.message}`, duration, attemptCount, delays)
    return false
  }
}

/**
 * 测试3：超过最大重试次数后失败
 */
async function testRetryMaxAttemptsExceeded(): Promise<boolean> {
  const testName = 'Retry Max Attempts Exceeded (Final Failure)'
  const startTime = Date.now()
  const delays: number[] = []
  let attemptCount = 0

  try {
    let attempts = 0
    const delayTimestamps: number[] = []

    await retryWithBackoff(
      async () => {
        attempts++
        const now = Date.now()

        if (attempts > 1) {
          const delay = now - delayTimestamps[delayTimestamps.length - 1]
          delays.push(delay)
        }
        delayTimestamps.push(now)

        // 总是抛出错误，强制重试
        const error: any = new Error('ECONNREFUSED')
        error.code = 'ECONNREFUSED'
        throw error
      },
      {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
        maxDelay: 500,
        jitter: false,
        isRetryable: () => true,
      }
    )

    // 不应该到达这里
    const duration = Date.now() - startTime
    recordResult(
      testName,
      false,
      'Expected function to throw after max attempts, but it succeeded',
      duration,
      attempts,
      delays
    )
    return false
  } catch (error: any) {
    const duration = Date.now() - startTime
    attemptCount = attempts

    // 验证结果
    const passed =
      attempts === 3 &&
      error.message === 'ECONNREFUSED' &&
      delays.length === 2 &&
      verifyExponentialBackoff(delays, 100, 2, 500, false)

    recordResult(
      testName,
      passed,
      passed
        ? 'Correctly failed after max retry attempts with exponential backoff'
        : `Failed attempts: ${attempts}, expected 3. Delays: [${delays.join(', ')}]`,
      duration,
      attempts,
      delays
    )

    return passed
  }
}

/**
 * 测试4：不可重试的错误立即失败
 */
async function testNonRetryableError(): Promise<boolean> {
  const testName = 'Non-Retryable Error (Immediate Failure)'
  const startTime = Date.now()
  const delays: number[] = []
  let attemptCount = 0

  try {
    let attempts = 0

    await retryWithBackoff(
      async () => {
        attempts++
        // 抛出认证错误（不可重试）
        const error: any = new Error('API key invalid')
        error.statusCode = 401
        throw error
      },
      {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
        maxDelay: 500,
        jitter: false,
        isRetryable: (error) => {
          // 认证错误不可重试
          return error.statusCode !== 401 && error.statusCode !== 403
        },
      }
    )

    // 不应该到达这里
    const duration = Date.now() - startTime
    recordResult(
      testName,
      false,
      'Expected function to throw immediately for non-retryable error',
      duration,
      attempts,
      delays
    )
    return false
  } catch (error: any) {
    const duration = Date.now() - startTime
    attemptCount = attempts

    // 验证结果：应该只尝试1次，没有延迟
    const passed =
      attempts === 1 &&
      error.statusCode === 401 &&
      delays.length === 0 &&
      duration < 50 // 应该很快失败

    recordResult(
      testName,
      passed,
      passed
        ? 'Correctly failed immediately without retry for non-retryable error'
        : `Attempts: ${attempts}, expected 1. Duration: ${duration}ms, expected < 50ms`,
      duration,
      attempts,
      delays
    )

    return passed
  }
}

/**
 * 测试5：带抖动的指数退避
 */
async function testRetryWithJitter(): Promise<boolean> {
  const testName = 'Retry with Jitter (Randomized Delays)'
  const startTime = Date.now()
  const delays: number[] = []
  let attemptCount = 0

  try {
    let attempts = 0
    const delayTimestamps: number[] = []

    const result = await retryWithBackoff(
      async () => {
        attempts++
        const now = Date.now()

        if (attempts < 3) {
          if (attempts > 1) {
            const delay = now - delayTimestamps[delayTimestamps.length - 1]
            delays.push(delay)
          }
          delayTimestamps.push(now)
          throw new Error('ETIMEDOUT')
        } else {
          const delay = now - delayTimestamps[delayTimestamps.length - 1]
          delays.push(delay)
          return { success: true, attempts }
        }
      },
      {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
        maxDelay: 500,
        jitter: true, // 启用抖动
        isRetryable: (error) => error.message === 'ETIMEDOUT',
      }
    )

    const duration = Date.now() - startTime
    attemptCount = attempts

    // 验证结果
    if (!result.success) {
      recordResult(testName, false, 'Result should be successful', duration, attempts, delays)
      return false
    }

    if (attempts !== 3) {
      recordResult(testName, false, `Expected 3 attempts, got ${attempts}`, duration, attempts, delays)
      return false
    }

    if (delays.length !== 2) {
      recordResult(testName, false, `Expected 2 delays, got ${delays.length}`, duration, attempts, delays)
      return false
    }

    // 验证抖动：延迟应该在 ±25% 范围内
    // 第一次延迟：75-125ms (100 ± 25%)
    // 第二次延迟：150-250ms (200 ± 25%)
    const firstDelayInRange = delays[0] >= 75 && delays[0] <= 125
    const secondDelayInRange = delays[1] >= 150 && delays[1] <= 250

    const passed = firstDelayInRange && secondDelayInRange

    recordResult(
      testName,
      passed,
      passed
        ? `Delays with jitter: [${delays.map((d) => `${d}ms`).join(', ')}]`
        : `Delays out of expected range: [${delays.map((d) => `${d}ms`).join(', ')}]`,
      duration,
      attempts,
      delays
    )

    return passed
  } catch (error: any) {
    const duration = Date.now() - startTime
    recordResult(testName, false, `Unexpected error: ${error.message}`, duration, attemptCount, delays)
    return false
  }
}

/**
 * 测试6：错误分类工具函数
 */
function testErrorClassificationUtilities(): boolean {
  const testName = 'Error Classification Utilities'
  const startTime = Date.now()

  try {
    // 测试网络错误检测
    const networkError1: any = new Error('ECONNREFUSED')
    networkError1.code = 'ECONNREFUSED'
    if (!isNetworkError(networkError1)) {
      recordResult(testName, false, 'isNetworkError failed for ECONNREFUSED', Date.now() - startTime)
      return false
    }

    const networkError2: any = new Error('Network request failed')
    if (!isNetworkError(networkError2)) {
      recordResult(testName, false, 'isNetworkError failed for network error message', Date.now() - startTime)
      return false
    }

    // 测试超时错误检测
    const timeoutError1: any = new Error('ETIMEDOUT')
    timeoutError1.code = 'ETIMEDOUT'
    if (!isTimeoutError(timeoutError1)) {
      recordResult(testName, false, 'isTimeoutError failed for ETIMEDOUT', Date.now() - startTime)
      return false
    }

    const timeoutError2 = new Error('Request timeout')
    if (!isTimeoutError(timeoutError2)) {
      recordResult(testName, false, 'isTimeoutError failed for timeout message', Date.now() - startTime)
      return false
    }

    // 测试 HTTP 状态码重试判断
    if (!isHttpStatusCodeRetryable(429)) {
      recordResult(testName, false, 'isHttpStatusCodeRetryable failed for 429', Date.now() - startTime)
      return false
    }

    if (!isHttpStatusCodeRetryable(500)) {
      recordResult(testName, false, 'isHttpStatusCodeRetryable failed for 500', Date.now() - startTime)
      return false
    }

    if (!isHttpStatusCodeRetryable(503)) {
      recordResult(testName, false, 'isHttpStatusCodeRetryable failed for 503', Date.now() - startTime)
      return false
    }

    if (isHttpStatusCodeRetryable(401)) {
      recordResult(testName, false, 'isHttpStatusCodeRetryable should return false for 401', Date.now() - startTime)
      return false
    }

    const duration = Date.now() - startTime
    recordResult(testName, true, 'All error classification utilities work correctly', duration)
    return true
  } catch (error: any) {
    const duration = Date.now() - startTime
    recordResult(testName, false, `Unexpected error: ${error.message}`, duration)
    return false
  }
}

/**
 * 打印测试结果摘要
 */
function printSummary() {
  console.log('\n' + '='.repeat(80))
  console.log('TRANSIENT ERROR RECOVERY VERIFICATION SUMMARY')
  console.log('='.repeat(80))

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const total = results.length

  console.log(`\nTotal Tests: ${total}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`)

  if (failed > 0) {
    console.log('\nFailed Tests:')
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}`)
        console.log(`    ${r.message}`)
      })
  }

  console.log('\n' + '='.repeat(80))
}

/**
 * 运行所有测试
 */
async function runAllTests(): Promise<boolean> {
  console.log('\n🧪 Starting Transient Error Recovery Verification...\n')
  console.log('Testing retry utility with exponential backoff and jitter')
  console.log('Simulating network timeouts, rate limits, and other transient errors\n')

  // 运行所有测试
  const testResults = await Promise.all([
    testRetryWithNetworkTimeout(),
    testRetryWithRateLimit(),
    testRetryMaxAttemptsExceeded(),
    testNonRetryableError(),
    testRetryWithJitter(),
  ])

  // 运行同步测试
  const errorClassificationTest = testErrorClassificationUtilities()
  testResults.push(errorClassificationTest)

  printSummary()

  const allPassed = testResults.every((r) => r)

  if (allPassed) {
    console.log('\n🎉 All tests passed! Transient error recovery is working correctly.\n')
    console.log('Key findings:')
    console.log('  ✅ Network timeouts trigger automatic retry with exponential backoff')
    console.log('  ✅ Rate limits (429) trigger automatic retry with exponential backoff')
    console.log('  ✅ Max retry attempts are respected')
    console.log('  ✅ Non-retryable errors fail immediately')
    console.log('  ✅ Jitter is applied to prevent thundering herd')
    console.log('  ✅ Error classification utilities work correctly')
  } else {
    console.log('\n⚠️  Some tests failed. Please review the results above.\n')
  }

  return allPassed
}

// 运行所有测试
runAllTests()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error('Fatal error running tests:', error)
    process.exit(1)
  })
