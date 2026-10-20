import { findRequestReceipt } from './request-receipts.mjs'
import { query } from './mysql.mjs'

const memoryFeedback = new Map()

const storageError = (cause) => {
  const error = new Error('Feedback storage is unavailable', { cause })
  error.code = 'FEEDBACK_STORAGE_UNAVAILABLE'
  return error
}

const ownerKey = ({ ownerType, ownerId }) => `${ownerType}:${ownerId}`
const feedbackKey = ({ requestId, ownerType, ownerId }) => `${ownerKey({ ownerType, ownerId })}:${requestId}`

const readOwner = ({ ownerType, ownerId }) => {
  if (!['user', 'guest'].includes(ownerType) || typeof ownerId !== 'string' || !ownerId.trim()) {
    const error = new Error('A verified user or guest owner is required')
    error.code = 'INVALID_FEEDBACK_OWNER'
    throw error
  }
  return { ownerType, ownerId: ownerId.trim() }
}

const useMemoryStore = () => process.env.FEEDBACK_TEST_MEMORY === 'true'

export const upsertFeedback = async ({ requestId, ownerType, ownerId, value }) => {
  const owner = readOwner({ ownerType, ownerId })
  if (typeof requestId !== 'string' || !requestId.trim() || !['helpful', 'none'].includes(value)) {
    const error = new Error('A valid requestId and feedback value are required')
    error.code = 'INVALID_FEEDBACK'
    throw error
  }
  const normalizedRequestId = requestId.trim()
  const receipt = await findRequestReceipt({ requestId: normalizedRequestId, ...owner })
  if (!receipt || receipt.status !== 'completed') {
    const error = new Error('Feedback is not eligible for this request')
    error.code = 'FEEDBACK_NOT_ELIGIBLE'
    throw error
  }

  const updatedAt = new Date().toISOString()
  const feedback = { requestId: normalizedRequestId, ...owner, value, updatedAt }
  if (useMemoryStore()) {
    memoryFeedback.set(feedbackKey(feedback), feedback)
    return { ...feedback }
  }

  try {
    await query(
      `INSERT INTO chat_feedback (request_id, owner_type, owner_id, value)
       SELECT request_id, owner_type, owner_id, ?
       FROM chat_request_receipts
       WHERE request_id = ? AND owner_type = ? AND owner_id = ? AND status = 'completed'
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP(3)`,
      [value, normalizedRequestId, owner.ownerType, owner.ownerId],
    )
    const rows = await query(
      `SELECT request_id, owner_type, owner_id, value, updated_at
       FROM chat_feedback
       WHERE request_id = ? AND owner_type = ? AND owner_id = ?
       LIMIT 1`,
      [normalizedRequestId, owner.ownerType, owner.ownerId],
    )
    const row = rows[0]
    if (!row) {
      const error = new Error('Feedback is not eligible for this request')
      error.code = 'FEEDBACK_NOT_ELIGIBLE'
      throw error
    }
    return {
      requestId: row.request_id,
      ...owner,
      value: row.value,
      updatedAt: row.updated_at,
    }
  } catch (error) {
    if (error?.code === 'FEEDBACK_NOT_ELIGIBLE') throw error
    throw storageError(error)
  }
}

export const findFeedback = async ({ requestId, ownerType, ownerId }) => {
  const owner = readOwner({ ownerType, ownerId })
  if (typeof requestId !== 'string' || !requestId.trim()) return null
  const normalizedRequestId = requestId.trim()

  if (useMemoryStore()) {
    const feedback = memoryFeedback.get(feedbackKey({ requestId: normalizedRequestId, ...owner }))
    return feedback ? { ...feedback } : null
  }

  try {
    const rows = await query(
      `SELECT request_id, owner_type, owner_id, value, updated_at
       FROM chat_feedback
       WHERE request_id = ? AND owner_type = ? AND owner_id = ?
       LIMIT 1`,
      [normalizedRequestId, owner.ownerType, owner.ownerId],
    )
    const row = rows[0]
    return row
      ? { requestId: row.request_id, ...owner, value: row.value, updatedAt: row.updated_at }
      : null
  } catch (error) {
    throw storageError(error)
  }
}

export const resetFeedbackForTests = () => {
  if (!useMemoryStore()) throw new Error('FEEDBACK_TEST_MEMORY=true is required to reset test feedback')
  memoryFeedback.clear()
}
