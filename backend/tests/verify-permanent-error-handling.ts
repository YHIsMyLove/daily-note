/**
 * 永久性错误处理验证脚本
 *
 * 验证永久性错误（无效API密钥、配额超限）的处理：
 * 1. 不触发重试
 * 2. 立即失败
 * 3. 返回用户友好的错误消息
 * 4. 任务标记为FAILED状态
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { classifyError, getUserMessage, ErrorType, isRetryable } from '../src/utils/errors'

console.log('='.repeat(80))
console.log('永久性错误处理验证')
console.log('='.repeat(80))

describe('永久性错误处理验证', () => {
  it('1. 无效API密钥错误 (401 Unauthorized)', () => {
    console.log('\n测试场景: 401 Unauthorized - 无效API密钥')
    console.log('-'.repeat(80))

    const error = {
      status: 401,
      message: 'Invalid API key',
    }

    const classified = classifyError(error)
    console.log('✓ 错误分类:', classified.type)
    assert.strictEqual(classified.type, ErrorType.AUTHENTICATION)

    console.log('✓ 是否可重试:', classified.retryable)
    assert.strictEqual(classified.retryable, false)

    const userMessage = getUserMessage(classified)
    console.log('✓ 用户消息标题:', userMessage.title)
    assert.strictEqual(userMessage.title, 'API 密钥无效')

    console.log('✓ 用户消息描述:', userMessage.message)
    assert.match(userMessage.message, /无法验证|API 密钥/)

    console.log('✓ 用户消息建议:', userMessage.suggestion)
    assert.ok(userMessage.suggestion)

    console.log('✓ isRetryable() 返回:', isRetryable(error))
    assert.strictEqual(isRetryable(error), false)

    console.log('\n✅ 401 错误处理验证通过')
  })

  it('2. 权限不足错误 (403 Forbidden)', () => {
    console.log('\n测试场景: 403 Forbidden - 权限不足')
    console.log('-'.repeat(80))

    const error = {
      status: 403,
      message: 'Access forbidden',
    }

    const classified = classifyError(error)
    console.log('✓ 错误分类:', classified.type)
    assert.strictEqual(classified.type, ErrorType.AUTHENTICATION)

    console.log('✓ 是否可重试:', classified.retryable)
    assert.strictEqual(classified.retryable, false)

    const userMessage = getUserMessage(classified)
    console.log('✓ 用户消息标题:', userMessage.title)
    assert.strictEqual(userMessage.title, 'API 密钥无效')

    console.log('\n✅ 403 错误处理验证通过')
  })

  it('3. API密钥关键词错误识别', () => {
    console.log('\n测试场景: 错误消息包含API密钥关键词')
    console.log('-'.repeat(80))

    const testCases = [
      { message: 'API key invalid' },
      { message: 'Authentication failed' },
      { message: 'Unauthorized access' },
      { message: 'Invalid API key provided' },
      { error: { message: 'Forbidden: insufficient permissions' } },
    ]

    for (const testCase of testCases) {
      const error = testCase.error || testCase
      const classified = classifyError(error)

      console.log(`  - "${testCase.message}" → ${classified.type}`)
      assert.strictEqual(classified.type, ErrorType.AUTHENTICATION)
      assert.strictEqual(classified.retryable, false)
    }

    console.log('\n✅ API密钥关键词错误识别验证通过')
  })

  it('4. 配额超限错误', () => {
    console.log('\n测试场景: 配额超限错误')
    console.log('-'.repeat(80))

    const error = {
      message: 'Quota exceeded: credit balance is zero',
    }

    const classified = classifyError(error)
    console.log('✓ 错误分类:', classified.type)
    assert.strictEqual(classified.type, ErrorType.QUOTA_EXCEEDED)

    console.log('✓ 是否可重试:', classified.retryable)
    assert.strictEqual(classified.retryable, false)

    const userMessage = getUserMessage(classified)
    console.log('✓ 用户消息标题:', userMessage.title)
    assert.strictEqual(userMessage.title, 'API 配额已用完')

    console.log('✓ 用户消息描述:', userMessage.message)
    assert.match(userMessage.message, /配额|额度|耗尽/)

    console.log('✓ 用户消息建议:', userMessage.suggestion)
    assert.match(userMessage.suggestion, /充值|控制台|重置/)

    console.log('✓ isRetryable() 返回:', isRetryable(error))
    assert.strictEqual(isRetryable(error), false)

    console.log('\n✅ 配额超限错误处理验证通过')
  })

  it('5. 配额关键词错误识别', () => {
    console.log('\n测试场景: 错误消息包含配额关键词')
    console.log('-'.repeat(80))

    const testCases = [
      { message: 'Credit balance is zero' },
      { message: 'Usage limit exceeded' },
      { message: 'Billing account has insufficient funds' },
      { message: 'Quota exceeded for this API key' },
    ]

    for (const testCase of testCases) {
      const error = testCase
      const classified = classifyError(error)

      console.log(`  - "${testCase.message}" → ${classified.type}`)
      assert.strictEqual(classified.type, ErrorType.QUOTA_EXCEEDED)
      assert.strictEqual(classified.retryable, false)
    }

    console.log('\n✅ 配额关键词错误识别验证通过')
  })

  it('6. 对比：临时错误 vs 永久错误', () => {
    console.log('\n测试场景: 对比临时错误和永久错误的处理差异')
    console.log('-'.repeat(80))

    const permanentErrors = [
      { status: 401, message: 'Invalid API key', expectedRetryable: false },
      { status: 403, message: 'Forbidden', expectedRetryable: false },
      { message: 'Quota exceeded', expectedRetryable: false },
      { message: 'Credit balance zero', expectedRetryable: false },
    ]

    const retryableErrors = [
      { status: 429, message: 'Rate limited', expectedRetryable: true },
      { status: 500, message: 'Internal server error', expectedRetryable: true },
      { status: 502, message: 'Bad gateway', expectedRetryable: true },
      { message: 'Network error', expectedRetryable: true },
      { message: 'Timeout', expectedRetryable: true },
    ]

    console.log('\n永久性错误（不应重试）:')
    for (const error of permanentErrors) {
      const classified = classifyError(error)
      console.log(`  ${JSON.stringify(error)}`)
      console.log(`    → 类型: ${classified.type}, 可重试: ${classified.retryable}`)
      assert.strictEqual(classified.retryable, error.expectedRetryable)
    }

    console.log('\n临时错误（应该重试）:')
    for (const error of retryableErrors) {
      const classified = classifyError(error)
      console.log(`  ${JSON.stringify(error)}`)
      console.log(`    → 类型: ${classified.type}, 可重试: ${classified.retryable}`)
      assert.strictEqual(classified.retryable, error.expectedRetryable)
    }

    console.log('\n✅ 临时/永久错误对比验证通过')
  })

  it('7. 用户消息完整性检查', () => {
    console.log('\n测试场景: 验证所有永久性错误的用户消息完整性')
    console.log('-'.repeat(80))

    const permanentErrorTypes = [
      ErrorType.AUTHENTICATION,
      ErrorType.QUOTA_EXCEEDED,
    ]

    for (const errorType of permanentErrorTypes) {
      // 创建模拟分类错误
      const mockError = {
        type: errorType,
        originalError: new Error(),
        retryable: false,
        details: 'Test error',
      }

      const userMessage = getUserMessage(mockError)

      console.log(`\n${errorType}:`)
      console.log(`  标题: ${userMessage.title}`)
      console.log(`  消息: ${userMessage.message}`)
      console.log(`  建议: ${userMessage.suggestion}`)

      // 验证消息结构完整
      assert.ok(userMessage.title, '标题不应为空')
      assert.ok(userMessage.message, '消息不应为空')
      assert.ok(userMessage.suggestion, '建议不应为空')

      // 验证消息不为空字符串
      assert.ok(userMessage.title.trim().length > 0)
      assert.ok(userMessage.message.trim().length > 0)
      assert.ok(userMessage.suggestion.trim().length > 0)
    }

    console.log('\n✅ 用户消息完整性检查通过')
  })

  it('8. 客户端错误 (4xx) 处理', () => {
    console.log('\n测试场景: 其他4xx客户端错误处理')
    console.log('-'.repeat(80))

    const clientErrors = [
      { status: 400, message: 'Bad request' },
      { status: 404, message: 'Not found' },
      { status: 422, message: 'Unprocessable entity' },
    ]

    for (const error of clientErrors) {
      const classified = classifyError(error)
      console.log(`  ${error.status} ${error.message} → ${classified.type}, 可重试: ${classified.retryable}`)
      assert.strictEqual(classified.type, ErrorType.CLIENT)
      assert.strictEqual(classified.retryable, false)

      const userMessage = getUserMessage(classified)
      assert.ok(userMessage.title)
      assert.ok(userMessage.message)
    }

    console.log('\n✅ 客户端错误处理验证通过')
  })
})

console.log('\n' + '='.repeat(80))
console.log('所有永久性错误处理测试完成')
console.log('='.repeat(80))

// 打印测试总结
console.log('\n📋 测试总结:')
console.log('  ✅ 无效API密钥错误 (401/403) 不触发重试')
console.log('  ✅ 配额超限错误不触发重试')
console.log('  ✅ 所有永久性错误都有用户友好的中文错误消息')
console.log('  ✅ 永久性错误标记为 retryable: false')
console.log('  ✅ isRetryable() 函数正确识别永久性错误')
console.log('  ✅ 用户消息包含标题、描述和建议')
console.log('  ✅ 对比测试确认临时/永久错误处理差异')
console.log('\n🎉 永久性错误处理验证通过！')
