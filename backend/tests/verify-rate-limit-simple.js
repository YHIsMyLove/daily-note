/**
 * 速率限制处理快速验证脚本
 *
 * 简化版测试，用于快速验证 429 错误处理
 * 运行：cd backend && node tests/verify-rate-limit-simple.js
 */

// 模拟重试函数（简化版）
async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 100,
    backoffMultiplier = 2,
    jitter = false,
    isRetryable = () => true,
  } = options

  let lastError
  let currentDelay = initialDelay

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt >= maxAttempts) {
        throw error
      }

      if (!isRetryable(error)) {
        throw error
      }

      const delay = Math.min(currentDelay, 10000)
      await sleep(delay)
      currentDelay = Math.min(currentDelay * backoffMultiplier, 10000)
    }
  }

  throw lastError
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isHttpStatusCodeRetryable(statusCode) {
  return statusCode === 429 || (statusCode >= 500 && statusCode < 600) || statusCode === 408
}

// 测试结果
const results = []

function test(name, fn) {
  return fn()
    .then((result) => {
      results.push({ name, passed: result.passed, message: result.message })
      const status = result.passed ? '✅' : '❌'
      console.log(`${status} ${name}`)
      if (!result.passed) {
        console.log(`   ${result.message}`)
      }
      return result.passed
    })
    .catch((error) => {
      results.push({ name, passed: false, message: error.message })
      console.log(`❌ ${name}`)
      console.log(`   Error: ${error.message}`)
      return false
    })
}

// 测试 1: 429 是可重试的
async function test1() {
  const isRetryable = isHttpStatusCodeRetryable(429)
  return {
    passed: isRetryable === true,
    message: isRetryable ? '429 is retryable' : '429 is not retryable',
  }
}

// 测试 2: 429 错误触发重试
async function test2() {
  let attempts = 0
  const delays = []
  const timestamps = []

  try {
    await retryWithBackoff(
      async () => {
        attempts++
        timestamps.push(Date.now())

        if (timestamps.length > 1) {
          delays.push(timestamps[timestamps.length - 1] - timestamps[timestamps.length - 2])
        }

        if (attempts < 3) {
          const error = new Error('Too many requests')
          error.status = 429
          throw error
        }
        return 'success'
      },
      {
        maxAttempts: 3,
        initialDelay: 100,
        jitter: false,
        isRetryable: (error) => error.status === 429,
      }
    )

    const correctAttempts = attempts === 3
    const correctDelays =
      delays.length === 2 &&
      delays[0] >= 90 &&
      delays[0] <= 115 &&
      delays[1] >= 190 &&
      delays[1] <= 220

    return {
      passed: correctAttempts && correctDelays,
      message: `Attempts: ${attempts}, Delays: [${delays.join(', ')}]ms`,
    }
  } catch (error) {
    return {
      passed: false,
      message: `Unexpected error: ${error.message}`,
    }
  }
}

// 测试 3: 429 在最大重试次数后失败
async function test3() {
  let attempts = 0
  const delays = []
  const timestamps = []

  try {
    await retryWithBackoff(
      async () => {
        attempts++
        timestamps.push(Date.now())

        if (timestamps.length > 1) {
          delays.push(timestamps[timestamps.length - 1] - timestamps[timestamps.length - 2])
        }

        const error = new Error('Too many requests')
        error.status = 429
        throw error
      },
      {
        maxAttempts: 3,
        initialDelay: 100,
        jitter: false,
        isRetryable: (error) => error.status === 429,
      }
    )

    return {
      passed: false,
      message: 'Should have thrown error after max retries',
    }
  } catch (error) {
    const correctAttempts = attempts === 3
    const correctDelays =
      delays.length === 2 &&
      delays[0] >= 90 &&
      delays[0] <= 115 &&
      delays[1] >= 190 &&
      delays[1] <= 220

    return {
      passed: correctAttempts && correctDelays,
      message: `Failed after ${attempts} attempts with delays [${delays.join(', ')}]ms`,
    }
  }
}

// 测试 4: 429 vs 其他状态码
async function test4() {
  const testCases = [
    { status: 429, shouldRetry: true },
    { status: 500, shouldRetry: true },
    { status: 502, shouldRetry: true },
    { status: 503, shouldRetry: true },
    { status: 504, shouldRetry: true },
    { status: 408, shouldRetry: true },
    { status: 400, shouldRetry: false },
    { status: 401, shouldRetry: false },
    { status: 403, shouldRetry: false },
    { status: 404, shouldRetry: false },
  ]

  let allPassed = true
  const failed = []

  for (const tc of testCases) {
    const isRetryable = isHttpStatusCodeRetryable(tc.status)
    if (isRetryable !== tc.shouldRetry) {
      allPassed = false
      failed.push(`${tc.status} (expected: ${tc.shouldRetry}, got: ${isRetryable})`)
    }
  }

  return {
    passed: allPassed,
    message: allPassed
      ? `${testCases.length}/${testCases.length} status codes correct`
      : `${failed.length} failed: ${failed.join(', ')}`,
  }
}

// 测试 5: 指数退避验证
async function test5() {
  const delays = []
  const timestamps = []

  try {
    await retryWithBackoff(
      async () => {
        timestamps.push(Date.now())

        if (timestamps.length > 1) {
          delays.push(timestamps[timestamps.length - 1] - timestamps[timestamps.length - 2])
        }

        if (timestamps.length < 4) {
          const error = new Error('Too many requests')
          error.status = 429
          throw error
        }
        return 'success'
      },
      {
        maxAttempts: 4,
        initialDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
        isRetryable: (error) => error.status === 429,
      }
    )

    // 验证指数退避: 100 -> 200 -> 400
    const expected = [100, 200, 400]
    const correct =
      delays.length === 3 &&
      delays[0] >= 90 &&
      delays[0] <= 115 &&
      delays[1] >= 190 &&
      delays[1] <= 220 &&
      delays[2] >= 390 &&
      delays[2] <= 420

    return {
      passed: correct,
      message: correct
        ? `Exponential backoff verified: [${delays.join(', ')}]ms`
        : `Expected [${expected.join(', ')}]ms, got [${delays.join(', ')}]ms`,
    }
  } catch (error) {
    return {
      passed: false,
      message: `Unexpected error: ${error.message}`,
    }
  }
}

// 测试 6: 429 错误不立即失败
async function test6() {
  let attemptCount = 0

  try {
    await retryWithBackoff(
      async () => {
        attemptCount++
        const error = new Error('Too many requests')
        error.status = 429
        throw error
      },
      {
        maxAttempts: 3,
        initialDelay: 50,
        isRetryable: (error) => error.status === 429,
      }
    )

    return {
      passed: false,
      message: 'Should have failed after retries',
    }
  } catch (error) {
    // 应该有 3 次尝试，而不是立即失败
    const retried = attemptCount === 3
    return {
      passed: retried,
      message: retried
        ? `429 error correctly retried ${attemptCount} times before failing`
        : `Attempted ${attemptCount} times, expected 3`,
    }
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('\n🧪 Rate Limit Handling Quick Tests\n')
  console.log('Testing 429 Too Many Requests error handling\n')

  await test('Test 1: 429 is retryable', test1)
  await test('Test 2: 429 triggers retry with exponential backoff', test2)
  await test('Test 3: 429 fails after max retries', test3)
  await test('Test 4: 429 vs other status codes', test4)
  await test('Test 5: Exponential backoff pattern', test5)
  await test('Test 6: 429 does not fail immediately', test6)

  const passed = results.filter((r) => r.passed).length
  const total = results.length

  console.log('\n' + '='.repeat(60))
  console.log(`Results: ${passed}/${total} tests passed`)
  console.log('='.repeat(60))

  if (passed === total) {
    console.log('\n✅ ALL TESTS PASSED!\n')
    process.exit(0)
  } else {
    console.log('\n❌ SOME TESTS FAILED\n')
    process.exit(1)
  }
}

runAllTests().catch((error) => {
  console.error('Test suite error:', error)
  process.exit(1)
})
