import { describe, expect, it } from 'vitest'
import { createLocalConversationRepository } from '@/services/conversation-repository'
import { CONVERSATION_SCHEMA_VERSION, type Conversation } from '@/types/conversation'

const INDEX_KEY = 'ai-campus-agent.conversations.v1.index'

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

  keys() {
    return [...this.store.keys()]
  }
}

const makeConversation = (overrides: Partial<Conversation> = {}): Conversation => {
  const now = Date.now()
  return {
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    conversationId: 'conv_1',
    ownerScope: 'guest:local',
    title: '补考怎么报名',
    createdAt: now,
    updatedAt: now,
    draft: '',
    messages: [
      {
        messageId: 'msg_1',
        role: 'user',
        content: '补考怎么报名？',
        status: 'done',
        createdAt: now,
      },
    ],
    ...overrides,
  }
}

describe('会话仓库', () => {
  it('按 ownerScope 隔离列表与读取', () => {
    const storage = new MemoryStorage()
    const repository = createLocalConversationRepository(storage)

    expect(repository.save(makeConversation({ ownerScope: 'user:a' }))).toEqual({ ok: true })

    expect(repository.list('user:a')).toHaveLength(1)
    expect(repository.list('user:b')).toHaveLength(0)
    expect(repository.load('conv_1', 'user:b')).toBeNull()
    expect(repository.load('conv_1', 'user:a')?.title).toBe('补考怎么报名')
  })

  it('达到会话数量上限后拒绝新增', () => {
    const repository = createLocalConversationRepository(new MemoryStorage(), { maxConversations: 1 })

    expect(repository.save(makeConversation({ conversationId: 'conv_1' }))).toEqual({ ok: true })
    expect(repository.save(makeConversation({ conversationId: 'conv_2' }))).toEqual({
      ok: false,
      reason: 'capacity',
    })

    // 已存在的会话仍可更新。
    expect(repository.save(makeConversation({ conversationId: 'conv_1', title: '改过标题' }))).toEqual({ ok: true })
  })

  it('写入抛配额错误时返回 quota 且不留下孤儿会话', () => {
    class QuotaStorage extends MemoryStorage {
      override setItem() {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }
    }

    const storage = new QuotaStorage()
    const repository = createLocalConversationRepository(storage)

    expect(repository.save(makeConversation())).toEqual({ ok: false, reason: 'quota' })
    expect(storage.keys()).toHaveLength(0)
  })

  it('存储不可用时读写都安全降级', () => {
    const repository = createLocalConversationRepository(null)

    expect(repository.list('guest:local')).toEqual([])
    expect(repository.load('conv_1', 'guest:local')).toBeNull()
    expect(repository.save(makeConversation())).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('索引损坏时按空列表处理，不抛异常', () => {
    const storage = new MemoryStorage()
    storage.setItem(INDEX_KEY, '{not-json')

    const repository = createLocalConversationRepository(storage)

    expect(repository.list('guest:local')).toEqual([])
  })

  it('结构或版本不合法时拒绝写入', () => {
    const repository = createLocalConversationRepository(new MemoryStorage())
    const broken = { ...makeConversation(), schemaVersion: 99 } as unknown as Conversation

    expect(repository.save(broken)).toEqual({ ok: false, reason: 'invalid' })
  })
})
