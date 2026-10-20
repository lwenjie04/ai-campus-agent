import {
  CONVERSATION_SCHEMA_VERSION,
  isConversationMessageStatus,
  type Conversation,
  type ConversationMessage,
  type ConversationSummary,
} from '@/types/conversation'

const INDEX_KEY = 'ai-campus-agent.conversations.v1.index'
const CONVERSATION_KEY_PREFIX = 'ai-campus-agent.conversations.v1.'
const DEFAULT_MAX_CONVERSATIONS = 40
// localStorage 按 UTF-16 计费，约 5MB 上限；这里留出余量，单项上限按字符数估算。
const DEFAULT_MAX_SERIALIZED_CHARS = 1_500_000

export type StorageFailureReason = 'capacity' | 'quota' | 'unavailable' | 'invalid'

export type SaveOutcome = { ok: true } | { ok: false; reason: StorageFailureReason }

export interface ConversationRepository {
  list(ownerScope: string): ConversationSummary[]
  load(conversationId: string, ownerScope: string): Conversation | null
  save(conversation: Conversation): SaveOutcome
  remove(conversationId: string): void
  count(ownerScope: string): number
}

export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type RepositoryOptions = {
  maxConversations?: number
  maxSerializedChars?: number
}

type StoredIndex = {
  schemaVersion: number
  entries: ConversationSummary[]
}

const getDefaultStorage = (): StorageLike | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

// 供迁移逻辑与 store 使用同一份存储，避免测试与生产出现两套存储。
export const getDefaultConversationStorage = (): StorageLike | null => getDefaultStorage()

const conversationKey = (conversationId: string) => `${CONVERSATION_KEY_PREFIX}${conversationId}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isMessage = (value: unknown): value is ConversationMessage => {
  if (!isRecord(value)) return false
  return (
    typeof value.messageId === 'string' &&
    (value.role === 'system' || value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string' &&
    isConversationMessageStatus(value.status) &&
    typeof value.createdAt === 'number'
  )
}

const isConversation = (value: unknown): value is Conversation => {
  if (!isRecord(value)) return false
  return (
    value.schemaVersion === CONVERSATION_SCHEMA_VERSION &&
    typeof value.conversationId === 'string' &&
    typeof value.ownerScope === 'string' &&
    typeof value.title === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    typeof value.draft === 'string' &&
    Array.isArray(value.messages) &&
    value.messages.every(isMessage)
  )
}

const isSummary = (value: unknown): value is ConversationSummary => {
  if (!isRecord(value)) return false
  return (
    typeof value.conversationId === 'string' &&
    typeof value.ownerScope === 'string' &&
    typeof value.title === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    typeof value.messageCount === 'number' &&
    typeof value.preview === 'string'
  )
}

const toSummary = (conversation: Conversation): ConversationSummary => {
  const last = [...conversation.messages].reverse().find((message) => message.role !== 'system')
  return {
    conversationId: conversation.conversationId,
    ownerScope: conversation.ownerScope,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.filter((message) => message.role !== 'system').length,
    preview: (last?.content || '').replace(/\s+/g, ' ').trim().slice(0, 60),
  }
}

const toFailureReason = (error: unknown): StorageFailureReason => {
  // DOMException 并不总是继承 Error，这里按 name 判断，避免把配额错误误报成不可用。
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name)
      : ''

  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota'
  if (name === 'SecurityError') return 'unavailable'
  return 'unavailable'
}

export const createLocalConversationRepository = (
  storage: StorageLike | null = getDefaultStorage(),
  options: RepositoryOptions = {},
): ConversationRepository => {
  const maxConversations = options.maxConversations ?? DEFAULT_MAX_CONVERSATIONS
  const maxSerializedChars = options.maxSerializedChars ?? DEFAULT_MAX_SERIALIZED_CHARS

  const readIndex = (): ConversationSummary[] => {
    if (!storage) return []

    try {
      const raw = storage.getItem(INDEX_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as StoredIndex
      if (!isRecord(parsed) || !Array.isArray(parsed.entries)) return []
      return parsed.entries.filter(isSummary)
    } catch {
      // 索引损坏时按空处理；具体会话键仍在，后续版本可做修复而不是直接清空。
      return []
    }
  }

  const writeIndex = (entries: ConversationSummary[]) => {
    if (!storage) return
    const sorted = [...entries].sort((a, b) => b.updatedAt - a.updatedAt)
    storage.setItem(INDEX_KEY, JSON.stringify({ schemaVersion: CONVERSATION_SCHEMA_VERSION, entries: sorted }))
  }

  return {
    list(ownerScope) {
      return readIndex()
        .filter((entry) => entry.ownerScope === ownerScope)
        .sort((a, b) => b.updatedAt - a.updatedAt)
    },

    count(ownerScope) {
      return readIndex().filter((entry) => entry.ownerScope === ownerScope).length
    },

    load(conversationId, ownerScope) {
      if (!storage) return null
      try {
        const raw = storage.getItem(conversationKey(conversationId))
        if (!raw) return null
        const parsed = JSON.parse(raw) as unknown
        if (!isConversation(parsed) || parsed.ownerScope !== ownerScope) return null
        return parsed
      } catch {
        return null
      }
    },

    save(conversation) {
      if (!storage) return { ok: false, reason: 'unavailable' }
      if (!isConversation(conversation)) return { ok: false, reason: 'invalid' }

      const serialized = JSON.stringify(conversation)
      if (serialized.length > maxSerializedChars) return { ok: false, reason: 'capacity' }

      const entries = readIndex()
      const existingIndex = entries.findIndex((entry) => entry.conversationId === conversation.conversationId)
      if (existingIndex === -1 && entries.length >= maxConversations) {
        return { ok: false, reason: 'capacity' }
      }

      const nextEntries =
        existingIndex === -1
          ? [...entries, toSummary(conversation)]
          : entries.map((entry, index) => (index === existingIndex ? toSummary(conversation) : entry))

      try {
        storage.setItem(conversationKey(conversation.conversationId), serialized)
        writeIndex(nextEntries)
        return { ok: true }
      } catch (error) {
        // 新会话写入失败时清理可能残留的孤儿键；已有会话保留旧数据。
        if (existingIndex === -1) {
          try {
            storage.removeItem(conversationKey(conversation.conversationId))
          } catch {
            // 清理失败不影响错误上报。
          }
        }
        return { ok: false, reason: toFailureReason(error) }
      }
    },

    remove(conversationId) {
      if (!storage) return
      try {
        storage.removeItem(conversationKey(conversationId))
        writeIndex(readIndex().filter((entry) => entry.conversationId !== conversationId))
      } catch {
        // 删除失败时保留现状，由界面提示用户重试。
      }
    },
  }
}
