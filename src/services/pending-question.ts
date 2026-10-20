import { getDefaultConversationStorage, type StorageLike } from '@/services/conversation-repository'

export const PENDING_QUESTION_KEY = 'ai-campus-agent.pending-question.v1'
// 待问只在 24 小时内有效；过期必须明确丢弃，不能悄悄重发。
export const PENDING_QUESTION_TTL_MS = 24 * 60 * 60 * 1000

export type PendingQuestion = {
  text: string
  savedAt: number
}

export const readPendingQuestion = (
  storage: StorageLike | null = getDefaultConversationStorage(),
  now = Date.now(),
): PendingQuestion | null => {
  if (!storage) return null

  try {
    const raw = storage.getItem(PENDING_QUESTION_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<PendingQuestion>
    const text = typeof parsed.text === 'string' ? parsed.text.trim() : ''
    const savedAt = Number(parsed.savedAt)
    const invalid =
      !text || !Number.isFinite(savedAt) || savedAt > now || now - savedAt > PENDING_QUESTION_TTL_MS

    if (invalid) {
      storage.removeItem(PENDING_QUESTION_KEY)
      return null
    }

    return { text, savedAt }
  } catch {
    try {
      storage.removeItem(PENDING_QUESTION_KEY)
    } catch {
      // 存储不可用时无需额外处理。
    }
    return null
  }
}

export const writePendingQuestion = (
  text: string,
  storage: StorageLike | null = getDefaultConversationStorage(),
  now = Date.now(),
): PendingQuestion | null => {
  const normalized = text.trim()
  if (!normalized || !storage) return null

  const payload: PendingQuestion = { text: normalized, savedAt: now }
  try {
    storage.setItem(PENDING_QUESTION_KEY, JSON.stringify(payload))
    return payload
  } catch {
    // 无痕或禁用存储时只在当前标签页内保留。
    return null
  }
}

export const clearPendingQuestion = (storage: StorageLike | null = getDefaultConversationStorage()) => {
  try {
    storage?.removeItem(PENDING_QUESTION_KEY)
  } catch {
    // 存储不可用时无需额外处理。
  }
}
