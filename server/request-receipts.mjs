import { query } from './mysql.mjs'

const memoryReceipts = new Map()

const storageError = (cause) => {
  const error = new Error('Feedback receipt storage is unavailable', { cause })
  error.code = 'FEEDBACK_STORAGE_UNAVAILABLE'
  return error
}

const readOwner = ({ ownerType, ownerId }) => {
  if (!['user', 'guest'].includes(ownerType) || typeof ownerId !== 'string' || !ownerId.trim()) {
    const error = new Error('A verified user or guest owner is required')
    error.code = 'INVALID_RECEIPT_OWNER'
    throw error
  }
  return { ownerType, ownerId: ownerId.trim() }
}

const normalizeSourceIds = (sourceIds) =>
  [...new Set((Array.isArray(sourceIds) ? sourceIds : []).filter((id) => typeof id === 'string' && id.trim()))]

const parseSourceIds = (value) => {
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const normalizeReceipt = (row) =>
  row
    ? {
        requestId: row.request_id,
        ownerType: row.owner_type,
        ownerId: row.owner_id,
        status: row.status,
        sourceIds: parseSourceIds(row.source_ids),
        createdAt: row.created_at,
        completedAt: row.completed_at,
      }
    : null

const useMemoryStore = () => process.env.FEEDBACK_TEST_MEMORY === 'true'

export const saveRequestReceipt = async ({ requestId, ownerType, ownerId, sourceIds = [] }) => {
  if (typeof requestId !== 'string' || !requestId.trim() || requestId.length > 36) {
    const error = new Error('A valid requestId is required')
    error.code = 'INVALID_REQUEST_RECEIPT'
    throw error
  }
  const owner = readOwner({ ownerType, ownerId })
  const safeSourceIds = normalizeSourceIds(sourceIds)
  const receipt = {
    requestId: requestId.trim(),
    ...owner,
    status: 'completed',
    sourceIds: safeSourceIds,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  }

  if (useMemoryStore()) {
    const existing = memoryReceipts.get(receipt.requestId)
    if (existing && (existing.ownerType !== owner.ownerType || existing.ownerId !== owner.ownerId)) {
      const error = new Error('The requestId is already owned by another subject')
      error.code = 'REQUEST_RECEIPT_CONFLICT'
      throw error
    }
    memoryReceipts.set(receipt.requestId, existing || receipt)
    return { ...memoryReceipts.get(receipt.requestId), sourceIds: [...memoryReceipts.get(receipt.requestId).sourceIds] }
  }

  try {
    await query(
      `INSERT INTO chat_request_receipts
        (request_id, owner_type, owner_id, status, source_ids)
       VALUES (?, ?, ?, 'completed', ?)
       ON DUPLICATE KEY UPDATE request_id = VALUES(request_id)`,
      [receipt.requestId, owner.ownerType, owner.ownerId, JSON.stringify(safeSourceIds)],
    )
    const storedReceipt = await findRequestReceipt({ requestId: receipt.requestId, ...owner })
    if (!storedReceipt) {
      const error = new Error('The requestId is already owned by another subject')
      error.code = 'REQUEST_RECEIPT_CONFLICT'
      throw error
    }
    return storedReceipt
  } catch (error) {
    if (error?.code === 'REQUEST_RECEIPT_CONFLICT') throw error
    if (error?.code === 'ER_DUP_ENTRY') {
      throw Object.assign(new Error('The requestId is already stored'), {
        code: 'REQUEST_RECEIPT_CONFLICT',
        cause: error,
      })
    }
    throw storageError(error)
  }
}

export const findRequestReceipt = async ({ requestId, ownerType, ownerId }) => {
  const owner = readOwner({ ownerType, ownerId })
  if (typeof requestId !== 'string' || !requestId.trim()) return null

  if (useMemoryStore()) {
    const receipt = memoryReceipts.get(requestId.trim())
    if (!receipt || receipt.ownerType !== owner.ownerType || receipt.ownerId !== owner.ownerId) return null
    return { ...receipt, sourceIds: [...receipt.sourceIds] }
  }

  try {
    const rows = await query(
      `SELECT request_id, owner_type, owner_id, status, source_ids, created_at, completed_at
       FROM chat_request_receipts
       WHERE request_id = ? AND owner_type = ? AND owner_id = ? AND status = 'completed'
       LIMIT 1`,
      [requestId.trim(), owner.ownerType, owner.ownerId],
    )
    return normalizeReceipt(rows[0])
  } catch (error) {
    throw storageError(error)
  }
}

export const resetRequestReceiptsForTests = () => {
  if (!useMemoryStore()) throw new Error('FEEDBACK_TEST_MEMORY=true is required to reset test receipts')
  memoryReceipts.clear()
}
