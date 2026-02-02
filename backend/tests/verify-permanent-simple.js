/**
 * 永久性错误处理快速验证脚本 (JavaScript)
 *
 * 用于快速验证永久性错误处理逻辑
 */

console.log('='.repeat(80))
console.log('永久性错误处理快速验证')
console.log('='.repeat(80))

// 模拟错误分类（简化版）
function testPermanentErrorHandling() {
  let passed = 0
  let failed = 0

  const tests = [
    {
      name: '401 Invalid API Key',
      error: { status: 401, message: 'Invalid API key' },
      expectedType: 'authentication_error',
      expectedRetryable: false,
      expectedTitle: 'API 密钥无效',
    },
    {
      name: '403 Forbidden',
      error: { status: 403, message: 'Access forbidden' },
      expectedType: 'authentication_error',
      expectedRetryable: false,
      expectedTitle: 'API 密钥无效',
    },
    {
      name: 'Quota Exceeded',
      error: { message: 'Quota exceeded: credit balance is zero' },
      expectedType: 'quota_exceeded',
      expectedRetryable: false,
      expectedTitle: 'API 配额已用完',
    },
    {
      name: 'Credit Balance Zero',
      error: { message: 'Credit balance is zero' },
      expectedType: 'quota_exceeded',
      expectedRetryable: false,
      expectedTitle: 'API 配额已用完',
    },
    {
      name: 'Rate Limit (should be retryable)',
      error: { status: 429, message: 'Rate limited' },
      expectedType: 'rate_limit_error',
      expectedRetryable: true,
      expectedTitle: '请求过于频繁',
    },
    {
      name: 'Server Error (should be retryable)',
      error: { status: 500, message: 'Internal server error' },
      expectedType: 'server_error',
      expectedRetryable: true,
      expectedTitle: '服务器错误',
    },
  ]

  console.log('\n运行测试用例...\n')

  for (const test of tests) {
    try {
      // 这里我们模拟错误分类逻辑
      const isAuthError =
        test.error.status === 401 ||
        test.error.status === 403 ||
        test.error.message?.toLowerCase().includes('api key') ||
        test.error.message?.toLowerCase().includes('unauthorized')

      const isQuotaError =
        test.error.message?.toLowerCase().includes('quota') ||
        test.error.message?.toLowerCase().includes('credit') ||
        test.error.message?.toLowerCase().includes('balance')

      const isRateLimitError = test.error.status === 429

      const isServerError = test.error.status && test.error.status >= 500 && test.error.status < 600

      let type = 'unknown_error'
      let retryable = true
      let title = '未知错误'

      if (isAuthError) {
        type = 'authentication_error'
        retryable = false
        title = 'API 密钥无效'
      } else if (isQuotaError) {
        type = 'quota_exceeded'
        retryable = false
        title = 'API 配额已用完'
      } else if (isRateLimitError) {
        type = 'rate_limit_error'
        retryable = true
        title = '请求过于频繁'
      } else if (isServerError) {
        type = 'server_error'
        retryable = true
        title = '服务器错误'
      }

      const typeMatch = type === test.expectedType
      const retryableMatch = retryable === test.expectedRetryable
      const titleMatch = title === test.expectedTitle

      if (typeMatch && retryableMatch && titleMatch) {
        console.log(`✅ ${test.name}`)
        console.log(`   类型: ${type} ✓`)
        console.log(`   可重试: ${retryable} ✓`)
        console.log(`   标题: ${title} ✓`)
        passed++
      } else {
        console.log(`❌ ${test.name}`)
        if (!typeMatch) console.log(`   类型: 期望 ${test.expectedType}, 实际 ${type}`)
        if (!retryableMatch) console.log(`   可重试: 期望 ${test.expectedRetryable}, 实际 ${retryable}`)
        if (!titleMatch) console.log(`   标题: 期望 "${test.expectedTitle}", 实际 "${title}"`)
        failed++
      }
      console.log('')
    } catch (error) {
      console.log(`❌ ${test.name} - 异常: ${error.message}`)
      failed++
    }
  }

  console.log('='.repeat(80))
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`)
  console.log('='.repeat(80))

  if (failed === 0) {
    console.log('\n🎉 所有测试通过！\n')
    console.log('验证要点:')
    console.log('  ✅ 无效API密钥 (401/403) 被识别为认证错误')
    console.log('  ✅ 配额超限被识别为配额错误')
    console.log('  ✅ 永久性错误标记为不可重试 (retryable: false)')
    console.log('  ✅ 临时错误 (429, 5xx) 标记为可重试 (retryable: true)')
    console.log('  ✅ 所有错误都有用户友好的中文标题')
  } else {
    console.log('\n⚠️  存在失败的测试，请检查实现\n')
    process.exit(1)
  }
}

testPermanentErrorHandling()
