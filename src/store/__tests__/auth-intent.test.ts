import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { AUTH_INTENT_TTL_MS, useAuthIntentStore } from '@/store/auth-intent'

const newStore = () => {
  setActivePinia(createPinia())
  return useAuthIntentStore()
}

beforeEach(() => {
  localStorage.clear()
})

describe('登录意图 store', () => {
  it('排队后只能消费一次', () => {
    const store = newStore()
    const intent = store.queue('open-post', 'post_1', 1_000)

    expect(store.peek(1_000)?.intentId).toBe(intent.intentId)
    expect(store.consume(intent.intentId, 1_100)?.consumedAt).toBe(1_100)
    expect(store.consume(intent.intentId, 1_200)).toBeNull()
    expect(store.peek(1_200)).toBeNull()
  })

  it('相同动作重复排队复用同一意图，不同动作覆盖', () => {
    const store = newStore()
    const first = store.queue('send-question', '补考怎么报名？', 1_000)
    const second = store.queue('send-question', '补考怎么报名？', 1_100)
    expect(second.intentId).toBe(first.intentId)

    const other = store.queue('enter-admin', '/admin/review', 1_200)
    expect(other.intentId).not.toBe(first.intentId)
    expect(store.peek(1_200)?.type).toBe('enter-admin')
  })

  it('刷新后仍能恢复未消费意图', () => {
    const store = newStore()
    const intent = store.queue('open-post', 'post_9', 1_000)

    const restored = newStore()
    expect(restored.peek(1_100)?.intentId).toBe(intent.intentId)
    expect(restored.peek(1_100)?.target).toBe('post_9')
  })

  it('已消费的意图刷新后不再返回', () => {
    const store = newStore()
    const intent = store.queue('enter-admin', '/admin/review', 1_000)
    store.consume(intent.intentId, 1_100)

    const restored = newStore()
    expect(restored.peek(1_200)).toBeNull()
  })

  it('超过 24 小时的意图被丢弃', () => {
    const store = newStore()
    store.queue('send-question', '旧问题', 1_000)

    expect(store.peek(1_000 + AUTH_INTENT_TTL_MS)).not.toBeNull()
    const expired = newStore()
    expect(expired.peek(1_000 + AUTH_INTENT_TTL_MS + 1)).toBeNull()
  })

  it('清除后刷新不再恢复', () => {
    const store = newStore()
    store.queue('open-post', 'post_2', 1_000)
    store.clear()

    expect(newStore().peek(1_100)).toBeNull()
  })
})
