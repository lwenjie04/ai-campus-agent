import { describe, expect, it } from 'vitest'
import { createLocalConversationRepository } from '@/services/conversation-repository'
import {
  LEGACY_MIGRATION_MARKER_KEY,
  LEGACY_OWNER_SCOPE,
  LEGACY_SESSION_KEY,
  migrateLegacySession,
} from '@/services/migrate-conversations'

class MemoryStorage {
  private readonly store = new Map<string, string>()

  getItem(key: string) {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.store.set(key, value)
  }

  removeItem(key: string) {
    this.store.delete(key)
  }
}

const legacySession = (messages: unknown[]) => JSON.stringify({ userProfile: { role: 'student' }, messages })

const userMessage = (content: string, extra: Record<string, unknown> = {}) => ({
  id: 'legacy-user-1',
  role: 'user',
  content,
  status: 'sent',
  createdAt: 1_700_000_000_000,
  ...extra,
})

const assistantMessage = (content: string, extra: Record<string, unknown> = {}) => ({
  id: 'legacy-assistant-1',
  role: 'assistant',
  content,
  status: 'sent',
  createdAt: 1_700_000_001_000,
  ...extra,
})

describe('旧单会话缓存迁移', () => {
  it('迁移为一条 legacy 会话，并保留原缓存与迁移标记', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_SESSION_KEY, legacySession([userMessage('补考怎么报名？'), assistantMessage('先去教务系统报名。')]))
    const repository = createLocalConversationRepository(storage)

    const result = migrateLegacySession(repository, storage)

    expect(result.status).toBe('migrated')
    const conversations = repository.list(LEGACY_OWNER_SCOPE)
    expect(conversations).toHaveLength(1)
    expect(conversations[0].title).toBe('补考怎么报名？')
    expect(repository.load(conversations[0].conversationId, LEGACY_OWNER_SCOPE)?.messages).toHaveLength(2)
    expect(storage.getItem(LEGACY_SESSION_KEY)).not.toBeNull()
    expect(storage.getItem(LEGACY_MIGRATION_MARKER_KEY)).not.toBeNull()
  })

  it('重复执行不会生成重复历史', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_SESSION_KEY, legacySession([userMessage('奖学金怎么申请？')]))
    const repository = createLocalConversationRepository(storage)

    expect(migrateLegacySession(repository, storage).status).toBe('migrated')
    expect(migrateLegacySession(repository, storage)).toEqual({
      status: 'skipped',
      reason: 'already-migrated',
    })
    expect(repository.list(LEGACY_OWNER_SCOPE)).toHaveLength(1)

    // 即使标记丢失，稳定 conversationId 也会覆盖同一条而不是新增。
    storage.removeItem(LEGACY_MIGRATION_MARKER_KEY)
    expect(migrateLegacySession(repository, storage).status).toBe('migrated')
    expect(repository.list(LEGACY_OWNER_SCOPE)).toHaveLength(1)
  })

  it('旧记录不会自动出现在游客或登录账号空间', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_SESSION_KEY, legacySession([userMessage('宿舍报修怎么申请？')]))
    const repository = createLocalConversationRepository(storage)

    migrateLegacySession(repository, storage)

    expect(repository.list('guest:local')).toHaveLength(0)
    expect(repository.list('user:u_1')).toHaveLength(0)
  })

  it('把旧 pending 回答迁成 interrupted', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      LEGACY_SESSION_KEY,
      legacySession([userMessage('转专业什么时候申请？'), assistantMessage('', { status: 'pending' })]),
    )
    const repository = createLocalConversationRepository(storage)

    const result = migrateLegacySession(repository, storage)

    expect(result.status).toBe('migrated')
    const conversation = repository.list(LEGACY_OWNER_SCOPE)[0]
    const loaded = repository.load(conversation.conversationId, LEGACY_OWNER_SCOPE)
    expect(loaded?.messages[1].status).toBe('interrupted')
  })

  it('损坏缓存不删除原数据', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_SESSION_KEY, '{broken-json')
    const repository = createLocalConversationRepository(storage)

    expect(migrateLegacySession(repository, storage)).toEqual({ status: 'failed', reason: 'corrupt' })
    expect(repository.list(LEGACY_OWNER_SCOPE)).toHaveLength(0)
    expect(storage.getItem(LEGACY_SESSION_KEY)).toBe('{broken-json')
  })

  it('没有用户消息时不生成历史', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_SESSION_KEY, legacySession([assistantMessage('你好，有什么可以帮你？')]))
    const repository = createLocalConversationRepository(storage)

    expect(migrateLegacySession(repository, storage)).toEqual({ status: 'skipped', reason: 'empty' })
    expect(repository.list(LEGACY_OWNER_SCOPE)).toHaveLength(0)
  })

  it('没有旧缓存时直接跳过', () => {
    const repository = createLocalConversationRepository(new MemoryStorage())

    expect(migrateLegacySession(repository, new MemoryStorage())).toEqual({
      status: 'skipped',
      reason: 'no-legacy',
    })
  })
})
