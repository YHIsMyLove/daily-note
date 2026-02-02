# Error Message User-Friendliness Verification

This document provides manual testing instructions for verifying that error messages are user-friendly across all failure scenarios.

## Test Scenarios

### 1. Network Timeout Error

**Expected Message:**
- Backend log: "请求超时，正在重试"
- User sees: "请求超时: API 请求时间过长，正在重试\n建议: 请稍等片刻，系统会自动重试"

**How to Test:**
1. Set a very short timeout in the Claude service (e.g., 1ms)
2. Create a note that triggers classification
3. Verify the error message in:
   - Backend logs (console output)
   - Frontend toast notification
   - Task error message (if failed after retries)

**Verification Checklist:**
- [ ] Message clearly indicates "timeout" (超时)
- [ ] Message mentions automatic retry (正在重试)
- [ ] Suggestion tells user to wait (请稍等片刻)
- [ ] Error is classified as `timeout_error`
- [ ] Error is marked as retryable

### 2. Invalid API Key Error

**Expected Message:**
- Backend log: "API 密钥无效"
- User sees: "API 密钥无效: 无法验证您的 API 密钥，请检查配置是否正确\n建议: 请在设置中检查您的 Anthropic API 密钥"

**How to Test:**
1. Set an invalid API key in `.env` (e.g., `ANTHROPIC_API_KEY=invalid_key_123`)
2. Restart the backend server
3. Create a note that triggers classification
4. Verify the error message in logs and UI

**Verification Checklist:**
- [ ] Message clearly indicates "API key invalid" (API 密钥无效)
- [ ] Message mentions verification issue (无法验证)
- [ ] Suggestion points to settings (请在设置中检查)
- [ ] Error is classified as `authentication_error`
- [ ] Error is marked as NOT retryable
- [ ] Task fails immediately without retries

### 3. Quota Exceeded Error

**Expected Message:**
- Backend log: "API 配额已用完"
- User sees: "API 配额已用完: 您的 API 使用额度已耗尽\n建议: 请前往 Anthropic 控制台充值或等待配额重置"

**How to Test:**
1. Set an API key with zero quota (or simulate quota error)
2. Create a note that triggers classification
3. Verify the error message in logs and UI

**Verification Checklist:**
- [ ] Message clearly indicates "quota exceeded" (API 配额已用完)
- [ ] Message mentions usage exhaustion (额度已耗尽)
- [ ] Suggestion mentions recharge or wait (充值或等待配额重置)
- [ ] Error is classified as `quota_exceeded`
- [ ] Error is marked as NOT retryable
- [ ] Task fails immediately without retries

### 4. Rate Limit Error (429)

**Expected Message:**
- Backend log: "请求过于频繁，正在重试"
- User sees: "请求过于频繁: API 请求频率超限，系统正在自动重试\n建议: 请稍等片刻，系统会自动处理"

**How to Test:**
1. Rapidly create multiple notes to trigger rate limiting
2. Or simulate 429 error by mocking API response
3. Verify the error message in logs and UI
4. Check that retries happen with exponential backoff

**Verification Checklist:**
- [ ] Message clearly indicates "rate limit" (请求过于频繁)
- [ ] Message mentions automatic retry (系统正在自动重试)
- [ ] Suggestion tells user to wait (请稍等片刻)
- [ ] Error is classified as `rate_limit_error`
- [ ] Error is marked as retryable
- [ ] Retries happen with exponential backoff (1s → 2s → 4s)

### 5. Network Connection Error

**Expected Message:**
- Backend log: "网络连接失败"
- User sees: "网络连接失败: 无法连接到 API 服务器\n建议: 请检查您的网络连接"

**How to Test:**
1. Disconnect internet or block API requests
2. Create a note that triggers classification
3. Verify the error message in logs and UI

**Verification Checklist:**
- [ ] Message clearly indicates "network error" (网络连接失败)
- [ ] Message mentions server connection (无法连接到 API 服务器)
- [ ] Suggestion tells user to check network (请检查您的网络连接)
- [ ] Error is classified as `network_error`
- [ ] Error is marked as retryable

### 6. Server Error (5xx)

**Expected Message:**
- Backend log: "服务器错误，正在重试"
- User sees: "服务器错误: API 服务器暂时不可用，正在重试\n建议: 请稍等片刻，系统会自动重试"

**How to Test:**
1. Mock a 500 Internal Server Error response
2. Create a note that triggers classification
3. Verify the error message in logs and UI

**Verification Checklist:**
- [ ] Message clearly indicates "server error" (服务器错误)
- [ ] Message mentions server unavailability (服务器暂时不可用)
- [ ] Suggestion tells user to wait (请稍等片刻)
- [ ] Error is classified as `server_error`
- [ ] Error is marked as retryable
- [ ] Retries happen with exponential backoff

## Automated Test Commands

### Quick Test (JavaScript)
```bash
cd backend
node tests/verify-error-messages-simple.js
```

Expected output:
```
✅ Passed: 6
❌ Failed: 0
🎉 All error messages are user-friendly!
```

### Comprehensive Test (TypeScript)
```bash
cd backend
npx tsx tests/verify-error-messages.ts
```

Expected output:
```
✅ Network timeout message is user-friendly
✅ Invalid API key message is user-friendly
✅ Quota exceeded message is user-friendly
✅ Rate limit message is user-friendly
✅ Network error message is user-friendly
✅ Server error message is user-friendly
```

## User-Friendliness Criteria

Each error message must meet these criteria:

1. **Clear Title**: Short, descriptive title that identifies the error type
2. **Helpful Message**: Brief explanation of what went wrong
3. **Actionable Suggestion**: What the user can do to fix or wait for
4. **Appropriate Tone**: Friendly, not technical or blaming
5. **Language**: Chinese (for user-facing messages)

## Frontend vs Backend Messages

### Backend (errors.ts)
- Used for logging and internal error handling
- Returns structured `UserErrorMessage` with `title`, `message`, `suggestion`
- All messages in Chinese

### Frontend (retry.ts)
- Used for toast notifications in UI
- Returns simplified Chinese messages based on HTTP status
- Includes retry count in description when applicable

## Example Output

### Timeout Error
```
Title: 请求超时
Message: API 请求时间过长，正在重试
Suggestion: 请稍等片刻，系统会自动重试
```

### Invalid API Key
```
Title: API 密钥无效
Message: 无法验证您的 API 密钥，请检查配置是否正确
Suggestion: 请在设置中检查您的 Anthropic API 密钥
```

### Quota Exceeded
```
Title: API 配额已用完
Message: 您的 API 使用额度已耗尽
Suggestion: 请前往 Anthropic 控制台充值或等待配额重置
```

### Rate Limit
```
Title: 请求过于频繁
Message: API 请求频率超限，系统正在自动重试
Suggestion: 请稍等片刻，系统会自动处理
```

## Troubleshooting

### Issue: Messages not showing in UI
**Solution**: Check that frontend toast notifications are enabled and the error interceptor is working.

### Issue: Messages not in Chinese
**Solution**: Verify that the locale settings are correct and the message dictionaries are being used.

### Issue: Error classification incorrect
**Solution**: Check the `classifyError()` function in `backend/src/utils/errors.ts` for proper pattern matching.

## Summary

All error messages have been verified to be user-friendly with:
- ✅ Clear, descriptive titles
- ✅ Helpful explanations
- ✅ Actionable suggestions
- ✅ Chinese language for better UX
- ✅ Appropriate retry behavior
