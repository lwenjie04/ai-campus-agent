import {
  CONVERSATION_SCHEMA_VERSION,
  type Conversation,
  type ConversationMessage,
  type ConversationMessageStatus,
} from '@/types/conversation'
import type { MessageSource } from '@/types/agent'
import {
  getDefaultConversationStorage,
  type ConversationRepository,
  type StorageLike,
} from '@/services/conversation-repository'
import { createId } from '@/utils/id'

export const LEGACY_SESSION_KEY = 'ai-campus-agent.session.v2'
export const LEGACY_MIGRATION_MARKER_KEY = 'ai-campus-agent.conversations.v1.legacy-migration'
// 旧缓存没有可靠的账号归属：单独放进待确认空间，不自动归给当前登录账号。
export const LEGACY_OWNER_SCOPE = 'legacy:pending'

export type LegacyMigrationResult =
  | { status: 'skipped'; reason: 'no-legacy' | 'already-migrated' | 'empty' }
  | { status: 'migrated'; conversationId: string }
  | { status: 'failed'; reason: 'corrupt' | 'storage-error' }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// 用旧缓存的原始内容生成稳定 conversationId：即使迁移标记写入失败，
// 重复启动也只会覆盖同一条会话，而不是生成重复历史。
const hashString = (value: string): string => {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0
  }
  return (hash >>> 0).toString(36)
}

const toConversationMessage = (value: unknown, index: number): ConversationMessage | null => {
  if (!isRecord(value)) return null

  const role = value.role
  if (role !== 'user' && role !== 'assistant') return null

  const content = typeof value.content === 'string' ? value.content : ''
  // 旧缓存里的 pending 占位通常没有正文；刷新后应显示为中断，而不是丢掉这条记录。
  const status: ConversationMessageStatus =
    value.status === 'pending' ? 'interrupted' : value.status === 'error' ? 'error' : 'done'
  if (!content.trim() && status !== 'interrupted') return null

  const createdAt = typeof value.createdAt === 'number' ? value.createdAt : Date.now() + index
  const message: ConversationMessage = {
    messageId: typeof value.id === 'string' && value.id ? value.id : createId('msg'),
    role,
    content,
    status,
    createdAt,
  }

  if (typeof value.requestId === 'string') message.requestId = value.requestId
  if (Array.isArray(value.sources)) message.sources = value.sources as MessageSource[]
  if (typeof value.errorCode === 'string') message.errorCode = value.errorCode

  return message
}

const normalizeTitle = (content: string) => {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (!compact) return '旧会话'
  return compact.length > 20 ? `${compact.slice(0, 20)}…` : compact
}

// 把旧的单会话缓存迁成一条 legacy 历史；原 key 保留不动，便于用户确认或回退。
export const migrateLegacySession = (
  repository: ConversationRepository,
  storage: StorageLike | null = getDefaultConversationStorage(),
): LegacyMigrationResult => {
  if (!storage) return { status: 'failed', reason: 'storage-error' }

  try {
    if (storage.getItem(LEGACY_MIGRATION_MARKER_KEY)) {
      return { status: 'skipped', reason: 'already-migrated' }
    }
  } catch {
    return { status: 'failed', reason: 'storage-error' }
  }

  let raw: string | null = null
  try {
    raw = storage.getItem(LEGACY_SESSION_KEY)
  } catch {
    return { status: 'failed', reason: 'storage-error' }
  }
  if (!raw) return { status: 'skipped', reason: 'no-legacy' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // 损坏缓存不删除、不猜测；保留原数据等待人工处理。
    return { status: 'failed', reason: 'corrupt' }
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.messages)) {
    return { status: 'failed', reason: 'corrupt' }
  }

  const messages = parsed.messages
    .map((message, index) => toConversationMessage(message, index))
    .filter((message): message is ConversationMessage => message !== null)

  if (!messages.some((message) => message.role === 'user')) {
    return { status: 'skipped', reason: 'empty' }
  }

  const firstUser = messages.find((message) => message.role === 'user')
  const now = Date.now()
  const conversation: Conversation = {
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    conversationId: `conv_legacy_${hashString(raw)}`,
    ownerScope: LEGACY_OWNER_SCOPE,
    title: normalizeTitle(firstUser?.content || ''),
    createdAt: messages[0]?.createdAt ?? now,
    updatedAt: now,
    draft: '',
    messages,
  }

  const outcome = repository.save(conversation)
  if (!outcome.ok) return { status: 'failed', reason: 'storage-error' }

  try {
    storage.setItem(
      LEGACY_MIGRATION_MARKER_KEY,
      JSON.stringify({ conversationId: conversation.conversationId, migratedAt: now }),
    )
  } catch {
    // 标记写失败不阻断迁移；稳定 ID 保证下次覆盖同一条。
  }

  return { status: 'migrated', conversationId: conversation.conversationId }
}
