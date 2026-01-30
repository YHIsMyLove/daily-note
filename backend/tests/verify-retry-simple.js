/**
 * Simple verification script for retry logic
 * Run with: cd backend && node tests/verify-retry-simple.js
 */

const { retryWithBackoff } = require('../dist/utils/retry');

async function testRetry() {
  console.log('🧪 Testing transient error recovery...\n');

  let attempts = 0;
  const delays = [];
  const timestamps = [];

  try {
    const result = await retryWithBackoff(
      async () => {
        attempts++;
        const now = Date.now();
        timestamps.push(now);

        if (attempts < 3) {
          console.log(`  Attempt ${attempts}: Simulating timeout...`);
          const error = new Error('ETIMEDOUT');
          throw error;
        }

        console.log(`  Attempt ${attempts}: Success!`);

        // Calculate delays
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

    console.log('\n📊 Test Results:');
    console.log(`  Total attempts: ${attempts}`);
    console.log(`  Delays: [${delays.map((d) => d + 'ms').join(', ')}]`);
    console.log(`  Expected: [~100ms, ~200ms]`);

    // Verify exponential backoff
    const delay1Ok = delays[0] >= 90 && delays[0] <= 110;
    const delay2Ok = delays[1] >= 190 && delays[1] <= 210;
    const backoffCorrect = delay1Ok && delay2Ok;

    console.log('\n✅ Verification:');
    console.log(`  ${delay1Ok ? '✅' : '❌'} First delay ~100ms (actual: ${delays[0]}ms)`);
    console.log(`  ${delay2Ok ? '✅' : '❌'} Second delay ~200ms (actual: ${delays[1]}ms)`);
    console.log(`  ${attempts === 3 ? '✅' : '❌'} Exactly 3 attempts`);
    console.log(`  ${result.success ? '✅' : '❌'} Final result successful`);

    if (backoffCorrect && attempts === 3 && result.success) {
      console.log('\n🎉 All tests passed! Transient error recovery is working correctly.\n');
      return true;
    } else {
      console.log('\n⚠️  Some tests failed.\n');
      return false;
    }
  } catch (error) {
    console.log('\n❌ Test failed with error:', error.message);
    return false;
  }
}

testRetry()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
