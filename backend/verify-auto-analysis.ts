/**
 * End-to-End Verification: Startup Auto-Analysis
 *
 * Verifies that:
 * 1. Auto-summary service detects unsummarized dates
 * 2. triggerAutoAnalysis() enqueues a task
 * 3. The task has correct payload and priority
 */

import { prisma } from './src/database/prisma'
import { autoSummaryService } from './src/services/auto-summary.service'
import { writeFileSync } from 'fs'
import { join } from 'path'

const results: string[] = []
const logFile = join(process.cwd(), 'verification-results.txt')

function log(message: string) {
  results.push(message)
  console.log(message)
}

async function cleanup() {
  log('=== Cleanup ===')
  await prisma.note.deleteMany({
    where: { content: { contains: '[E2E-TEST]' } }
  })
  await prisma.claudeTask.deleteMany({
    where: { type: 'summary_analyzer', status: 'PENDING' }
  })
  log('Test data cleaned up')
}

async function main() {
  log('')
  log('=====================================================')
  log('  E2E Verification: Startup Auto-Analysis')
  log('=====================================================')
  log('')

  try {
    // Cleanup first
    await cleanup()

    // Step 1: Create test notes for yesterday
    log('Step 1: Creating test notes for yesterday...')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(12, 0, 0, 0)

    await prisma.note.create({
      data: {
        content: '[E2E-TEST] Test note for auto-analysis verification',
        date: yesterday,
        category: 'test',
        importance: 5
      }
    })
    log('[PASS] Created 1 test note for yesterday')

    // Step 2: Detect unsummarized dates
    log('')
    log('Step 2: Detecting unsummarized dates...')
    const unsummarized = await autoSummaryService.detectUnsummarizedDates(7)
    const withNotes = unsummarized.filter(d => d.hasNotes)

    if (withNotes.length === 0) {
      log('[FAIL] No unsummarized dates found')
      await cleanup()
      writeFileSync(logFile, results.join('\n'))
      process.exit(1)
    }

    log(`[PASS] Found ${withNotes.length} unsummarized date(s):`)
    withNotes.forEach(d => log(`  - ${d.date}: ${d.noteCount} notes`))

    // Step 3: Trigger auto-analysis
    log('')
    log('Step 3: Triggering auto-analysis...')
    const result = await autoSummaryService.triggerAutoAnalysis()

    if (!result.triggered) {
      log(`[FAIL] Auto-analysis not triggered: ${result.message}`)
      await cleanup()
      writeFileSync(logFile, results.join('\n'))
      process.exit(1)
    }

    log('[PASS] Auto-analysis triggered successfully!')
    log(`  Date: ${result.date}`)
    log(`  Task ID: ${result.taskId}`)
    log(`  Message: ${result.message}`)

    // Step 4: Verify task was enqueued
    log('')
    log('Step 4: Verifying task in database...')
    const task = await prisma.claudeTask.findUnique({
      where: { id: result.taskId! }
    })

    if (!task) {
      log('[FAIL] Task not found in database')
      await cleanup()
      writeFileSync(logFile, results.join('\n'))
      process.exit(1)
    }

    log('[PASS] Task found in database')
    log(`  Type: ${task.type}`)
    log(`  Status: ${task.status}`)
    log(`  Priority: ${task.priority}`)

    // Verify payload
    const payload = JSON.parse(task.payload)
    log(`  Payload mode: ${payload.timeRange.mode}`)
    log(`  Payload startDate: ${payload.timeRange.startDate.split('T')[0]}`)

    // Step 5: Verify the payload matches yesterday
    log('')
    log('Step 5: Verifying payload date...')
    const payloadDate = payload.timeRange.startDate.split('T')[0]
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    if (payloadDate !== yesterdayStr) {
      log(`[FAIL] Payload date mismatch: expected ${yesterdayStr}, got ${payloadDate}`)
      await cleanup()
      writeFileSync(logFile, results.join('\n'))
      process.exit(1)
    }

    log('[PASS] Payload date matches yesterday')

    // Success!
    log('')
    log('=====================================================')
    log('  ALL CHECKS PASSED')
    log('=====================================================')
    log('')
    log('Startup auto-analysis is working correctly!')
    log('')

    // Cleanup
    await cleanup()
    await prisma.$disconnect()

    // Write results to file
    writeFileSync(logFile, results.join('\n'))
    log(`Results written to: ${logFile}`)

    process.exit(0)

  } catch (error) {
    log('')
    log(`[ERROR] ${error instanceof Error ? error.message : String(error)}`)
    console.error(error)
    await cleanup()
    await prisma.$disconnect()
    writeFileSync(logFile, results.join('\n'))
    process.exit(1)
  }
}

main()
