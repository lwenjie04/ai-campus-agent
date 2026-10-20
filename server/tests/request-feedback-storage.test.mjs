import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

process.env.FEEDBACK_TEST_MEMORY = 'true'
const { findRequestReceipt, resetRequestReceiptsForTests, saveRequestReceipt } = await import(
  '../request-receipts.mjs'
)
const { findFeedback, resetFeedbackForTests, upsertFeedback } = await import('../feedback.mjs')

test('feedback migration only adds receipt and feedback tables with owner/request uniqueness', async () => {
  const migration = await readFile(new URL('../sql/migrations/20261020-chat-feedback.sql', import.meta.url), 'utf8')
  assert.match(migration, /CREATE TABLE IF NOT EXISTS chat_request_receipts/i)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS chat_feedback/i)
  assert.match(migration, /UNIQUE KEY uq_chat_feedback_owner_request \(owner_type, owner_id, request_id\)/i)
  assert.match(migration, /FOREIGN KEY \(request_id\) REFERENCES chat_request_receipts/i)
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i)
})

test('request receipts are minimal, owner-scoped, and reject requestId takeover', async () => {
  resetRequestReceiptsForTests()
  const receipt = await saveRequestReceipt({
    requestId: 'receipt-1',
    ownerType: 'guest',
    ownerId: 'guest-1',
    sourceIds: ['policy-1', 'policy-1', '', 4],
  })

  assert.equal(receipt.status, 'completed')
  assert.deepEqual(receipt.sourceIds, ['policy-1'])
  assert.deepEqual(await findRequestReceipt({
    requestId: 'receipt-1', ownerType: 'guest', ownerId: 'guest-1',
  })?.then((found) => found?.sourceIds), ['policy-1'])
  assert.equal(await findRequestReceipt({
    requestId: 'receipt-1', ownerType: 'guest', ownerId: 'guest-2',
  }), null)
  await assert.rejects(
    saveRequestReceipt({ requestId: 'receipt-1', ownerType: 'user', ownerId: 'user-1' }),
    { code: 'REQUEST_RECEIPT_CONFLICT' },
  )
})

test('feedback upsert is idempotent per owner and request and requires an eligible receipt', async () => {
  resetRequestReceiptsForTests()
  resetFeedbackForTests()
  await saveRequestReceipt({ requestId: 'receipt-2', ownerType: 'user', ownerId: 'user-1' })

  const helpful = await upsertFeedback({
    requestId: 'receipt-2', ownerType: 'user', ownerId: 'user-1', value: 'helpful',
  })
  assert.equal(helpful.value, 'helpful')
  assert.equal((await upsertFeedback({
    requestId: 'receipt-2', ownerType: 'user', ownerId: 'user-1', value: 'helpful',
  })).value, 'helpful')
  assert.equal((await upsertFeedback({
    requestId: 'receipt-2', ownerType: 'user', ownerId: 'user-1', value: 'none',
  })).value, 'none')
  assert.equal((await findFeedback({
    requestId: 'receipt-2', ownerType: 'user', ownerId: 'user-1',
  })).value, 'none')
  assert.equal(await findFeedback({
    requestId: 'receipt-2', ownerType: 'user', ownerId: 'user-2',
  }), null)
  await assert.rejects(
    upsertFeedback({ requestId: 'receipt-2', ownerType: 'user', ownerId: 'user-2', value: 'helpful' }),
    { code: 'FEEDBACK_NOT_ELIGIBLE' },
  )
  await assert.rejects(
    upsertFeedback({ requestId: 'missing', ownerType: 'user', ownerId: 'user-1', value: 'helpful' }),
    { code: 'FEEDBACK_NOT_ELIGIBLE' },
  )
  await assert.rejects(
    upsertFeedback({ requestId: 'receipt-2', ownerType: 'user', ownerId: 'user-1', value: 'bad' }),
    { code: 'INVALID_FEEDBACK' },
  )
})

test('in-memory feedback storage cannot be reset unless explicitly enabled for tests', () => {
  process.env.FEEDBACK_TEST_MEMORY = 'false'
  assert.throws(resetRequestReceiptsForTests, /FEEDBACK_TEST_MEMORY=true/)
  assert.throws(resetFeedbackForTests, /FEEDBACK_TEST_MEMORY=true/)
  process.env.FEEDBACK_TEST_MEMORY = 'true'
})
