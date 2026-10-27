import { getDefaultConversationStorage, type StorageLike } from '@/services/conversation-repository'

// /chat/new 的未发送草稿键：5.3 的“搜索无结果转问”也写到这里。
// 聊天页只恢复草稿并聚焦输入框，不自动发送，因此刷新不会重复请求模型。
export const NEW_CHAT_DRAFT_KEY = 'ai-campus-agent.chat-new-draft.v1'

const resolveStorage = (storage: StorageLike | null | undefined): StorageLike | null =>
  storage === undefined ? getDefaultConversationStorage() : storage

export const readNewChatDraft = (storage?: StorageLike | null): string => {
  try {
    return resolveStorage(storage)?.getItem(NEW_CHAT_DRAFT_KEY) || ''
  } catch {
    return ''
  }
}

export const writeNewChatDraft = (text: string, storage?: StorageLike | null): boolean => {
  try {
    const target = resolveStorage(storage)
    if (!target) return false
    if (text.trim()) target.setItem(NEW_CHAT_DRAFT_KEY, text)
    else target.removeItem(NEW_CHAT_DRAFT_KEY)
    return true
  } catch {
    return false
  }
}

export const clearNewChatDraft = (storage?: StorageLike | null) => {
  try {
    resolveStorage(storage)?.removeItem(NEW_CHAT_DRAFT_KEY)
  } catch {
    // 无痕模式或存储不可用时忽略。
  }
}

// 5.3：无结果转问只预填问题草稿；不排队、不发请求，刷新后仍然只是草稿。
export const prefillChatQuestion = (question: string, storage?: StorageLike | null): boolean => {
  const normalized = question.trim()
  if (!normalized) return false
  return writeNewChatDraft(normalized, storage)
}
