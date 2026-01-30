# Manual Verification Guide: Transient Error Recovery

This guide provides step-by-step instructions to verify that transient error recovery (network timeout, rate limit) is working correctly.

## Prerequisites

1. Backend server must be running
2. Valid Anthropic API key in `.env`
3. Database must be initialized

## Test Scenarios

### 1. Network Timeout Recovery

**Setup:** Temporarily modify the API timeout to a very low value

```bash
# In backend/.env, set:
ANTHROPIC_API_TIMEOUT=1  # 1ms timeout (will definitely timeout)
```

**Steps:**
1. Restart the backend server
2. Create a new note via API
3. Trigger note classification
4. Observe the logs

**Expected Behavior:**
```
[ClaudeService] Error in classifyNote
================================================================================
Timestamp:       2024-01-30T...
Request ID:      req_...
Error Type:      timeout
Retryable:       Yes
Attempt:         1 / 3
...
================================================================================

[ClaudeService] Error in classifyNote
...
Attempt:         2 / 3
...

[ClaudeService] Error in classifyNote
...
Attempt:         3 / 3
Duration:        XXXms
finalFailure:    true
...
```

**Verification:**
- ✅ Error is classified as "timeout" (retryable)
- ✅ Retry happens automatically (attempts 1, 2, 3)
- ✅ Exponential backoff delays are applied (~1s, ~2s, ~4s)
- ✅ After max attempts, task is marked as FAILED
- ✅ Default classification is returned (fallback result)

### 2. Rate Limit (429) Recovery

**Setup:** Simulate rate limit by intercepting API calls

Create a temporary test file `test-rate-limit.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

async function testRateLimit() {
  // Simulate 429 responses
  let callCount = 0

  const originalCreate = Anthropic.prototype.messages.create
  Anthropic.prototype.messages.create = async function(...args: any[]) {
    callCount++

    if (callCount < 3) {
      const error: any = new Error('Rate limit exceeded')
      error.status = 429
      throw error
    }

    // After 2 failures, return success
    return originalCreate.apply(this, args)
  }

  // Test classification
  const { claudeService } = await import('../src/llm/claude.service')
  const result = await claudeService.classifyNote('Test note content')
  console.log('Classification result:', result)
  console.log('Total API calls:', callCount)
}

testRateLimit()
```

**Expected Behavior:**
- ✅ First 2 attempts receive 429 error
- ✅ Both are automatically retried with exponential backoff
- ✅ Third attempt succeeds
- ✅ Total call count: 3

### 3. Permanent Error (No Retry)

**Setup:** Use invalid API key

```bash
# In backend/.env, set:
ANTHROPIC_API_KEY=sk-ant-invalid-key-12345
```

**Expected Behavior:**
```
[ClaudeService] Error in classifyNote
================================================================================
Error Type:      authentication
Retryable:       No
...
```

**Verification:**
- ✅ Error is classified as "authentication" (NOT retryable)
- ✅ Only 1 attempt is made (no retries)
- ✅ Task fails immediately
- ✅ User-friendly error message is logged

### 4. Queue Retry Logic

**Setup:** Create a note with a task that will fail transiently

**Steps:**
1. Set API timeout to very low value (to cause timeout)
2. Create a note via POST /api/notes
3. Check the queue processing logs

**Expected Behavior:**
```
[QueueManager] Task failed with timeout error
[QueueManager] Scheduling retry 1/3 in ~1000ms
[QueueManager] Task retryCount: 1, nextRetryAt: 2024-01-30T...

[QueueManager] Task failed again with timeout error
[QueueManager] Scheduling retry 2/3 in ~2000ms
[QueueManager] Task retryCount: 2, nextRetryAt: 2024-01-30T...

[QueueManager] Task failed again with timeout error
[QueueManager] Max retry attempts exceeded, marking as FAILED
```

**Verification:**
- ✅ Task is automatically scheduled for retry
- ✅ `retryCount` is incremented (1, 2, 3)
- ✅ `nextRetryAt` is set with exponential backoff
- ✅ After max attempts, task status is FAILED
- ✅ Database fields are updated correctly

## Quick Verification Command

Run this to test the retry utility directly:

```bash
cd backend
npx tsx -e "
import { retryWithBackoff } from './src/utils/retry';

async function test() {
  let attempts = 0;
  const delays = [];
  const timestamps = [];

  const result = await retryWithBackoff(
    async () => {
      attempts++;
      const now = Date.now();
      timestamps.push(now);

      if (attempts < 3) {
        throw new Error('ETIMEDOUT');
      }

      for (let i = 1; i < timestamps.length; i++) {
        delays.push(timestamps[i] - timestamps[i - 1]);
      }

      return { success: true, attempts };
    },
    {
      maxAttempts: 3,
      initialDelay: 100,
      backoffMultiplier: 2,
      maxDelay: 500,
      jitter: false,
      isRetryable: (error) => error.message === 'ETIMEDOUT',
    }
  );

  console.log('✅ Test passed!');
  console.log(\`Attempts: \${attempts}, Delays: [\${delays.join(', ')}]ms\`);
}

test().catch(console.error);
"
```

**Expected Output:**
```
✅ Test passed!
Attempts: 3, Delays: [100, 200]ms
```

## Verification Checklist

After running the tests, verify the following:

- [ ] Network timeout errors trigger automatic retry
- [ ] Rate limit (429) errors trigger automatic retry
- [ ] Exponential backoff delays are applied (1s → 2s → 4s...)
- [ ] Maximum retry attempts are respected (default: 3)
- [ ] Non-retryable errors (401, 403, quota) fail immediately
- [ ] User-friendly error messages are logged
- [ ] Queue tasks are automatically retried with exponential backoff
- [ ] Database retry tracking fields are updated correctly
- [ ] Fallback results are returned when all retries are exhausted

## Troubleshooting

**Tests are timing out:**
- Increase the timeout value in the test configuration
- Check if the API server is responding

**No retries happening:**
- Verify `isRetryable` function is returning true for transient errors
- Check error classification in `classifyError` utility

**Incorrect backoff delays:**
- Verify `initialDelay`, `backoffMultiplier`, and `maxDelay` settings
- Check if jitter is affecting expected values (±25%)

## Automated Test Script

For automated testing, use the provided test files:

```bash
# Option 1: Run TypeScript test directly (requires tsx)
cd backend && npx tsx tests/verify-transient-error-recovery.ts

# Option 2: Compile and run
cd backend
npx tsc tests/verify-transient-error-recovery.ts --outDir dist-tests --module commonjs
node dist-tests/tests/verify-transient-error-recovery.js
```

Both test scripts will:
1. Test network timeout recovery
2. Test rate limit recovery
3. Test max attempts enforcement
4. Test non-retryable error handling
5. Test exponential backoff with jitter
6. Provide detailed pass/fail output
