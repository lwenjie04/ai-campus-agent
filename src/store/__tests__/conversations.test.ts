import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalConversationRepository } from '@/services/conversation-repository'
import {
  resolveOwnerScope,
  setConversationRepository,
  useConversationsStore,
} from '@/store/conversations'
import type { ConversationMessage } from '@/types/conversation'

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

const makeMessage = (
  role: ConversationMessage['role'],
  content: string,
  status: ConversationMessage['status'] = 'done',
): ConversationMessage => ({
  messageId: `${role}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  status,
  createdAt: Date.now(),
})

const newStore = () => {
  setActivePinia(createPinia())
  const store = useConversationsStore()
  store.openScope('guest:local')
  return store
}

beforeEach(() => {
  setConversationRepository(createLocalConversationRepository(new MemoryStorage(), { maxConversations: 5 }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('会话 store', () => {
  it('空对话不进入历史', () => {
    const store = newStore()
    store.createDraft()

    expect(store.flush()).toEqual({ ok: true })
    expect(store.summaries).toHaveLength(0)
  })

  it('完整回答、标题与草稿可恢复', () => {
    const store = newStore()
    const draft = store.createDraft()
    store.appendMessage(makeMessage('user', '补考怎么报名？'))
    store.appendMessage(makeMessage('assistant', '先在教务系统报名，再等待排考。'))
    store.setDraft('还有个问题想问')
    expect(store.flush()).toEqual({ ok: true })

    expect(store.summaries).toHaveLength(1)
    expect(store.summaries[0].title).toBe('补考怎么报名？')

    const restored = newStore()
    expect(restored.summaries).toHaveLength(1)
    expect(restored.loadConversation(draft.conversationId)).toBe(true)
    expect(restored.active?.messages).toHaveLength(2)
    expect(restored.active?.messages[1].content).toContain('教务系统')
    expect(restored.active?.draft).toBe('还有个问题想问')
  })

  it('刷新恢复时把 generating 改成 interrupted 并落盘', () => {
    const store = newStore()
    const draft = store.createDraft()
    store.appendMessage(makeMessage('user', '转专业什么时候申请？'))
    store.appendMessage(makeMessage('assistant', '部分回答', 'generating'))
    store.flush()

    const restored = newStore()
    expect(restored.loadConversation(draft.conversationId)).toBe(true)
    expect(restored.active?.messages[1].status).toBe('interrupted')

    // 再开一个 store 读取同一份存储，确认中断状态已写回，而不是只改了内存。
    const second = newStore()
    expect(second.loadConversation(draft.conversationId)).toBe(true)
    expect(second.active?.messages[1].status).toBe('interrupted')
  })

  it('存储不可用时保留内存会话并暴露错误原因', () => {
    setConversationRepository(createLocalConversationRepository(null))
    const store = newStore()
    store.createDraft()
    store.appendMessage(makeMessage('user', '宿舍报修怎么申请？'))

    expect(store.flush()).toEqual({ ok: false, reason: 'unavailable' })
    expect(store.storageError).toBe('unavailable')
    expect(store.active?.messages).toHaveLength(1)
  })

  it('草稿写入按 400ms 节流', () => {
    vi.useFakeTimers()
    const store = newStore()
    store.createDraft()
    store.appendMessage(makeMessage('user', '奖学金怎么申请？'))

    expect(store.summaries).toHaveLength(0)
    vi.advanceTimersByTime(399)
    expect(store.summaries).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(store.summaries).toHaveLength(1)
  })

  it('切换 ownerScope 后看不到其他空间的会话', () => {
    const store = newStore()
    store.openScope('user:a')
    const draft = store.createDraft()
    store.appendMessage(makeMessage('user', 'A 的问题'))
    store.flush()

    store.openScope('user:b')
    expect(store.summaries).toHaveLength(0)
    expect(store.loadConversation(draft.conversationId)).toBe(false)

    store.openScope('user:a')
    expect(store.summaries).toHaveLength(1)
  })

  it('ownerScope 由登录身份派生', () => {
    expect(resolveOwnerScope()).toBe('guest:local')
    expect(resolveOwnerScope('u_1')).toBe('user:u_1')
  })
})
