import { describe, expect, it } from 'vitest'
import {
  PENDING_QUESTION_KEY,
  PENDING_QUESTION_TTL_MS,
  clearPendingQuestion,
  readPendingQuestion,
  writePendingQuestion,
} from '@/services/pending-question'

class MemoryStorage {
  readonly store = new Map<string, string>()

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

describe('登录待问（24h TTL）', () => {
  it('写入后可读取，且只保存去空白后的文本', () => {
    const storage = new MemoryStorage()
    writePendingQuestion('  补考怎么报名？ ', storage, 1_000)

    const restored = readPendingQuestion(storage, 2_000)

    expect(restored?.text).toBe('补考怎么报名？')
    expect(JSON.parse(storage.store.get(PENDING_QUESTION_KEY) || '{}').savedAt).toBe(1_000)
  })

  it('超过 24 小时视为过期并清除', () => {
    const storage = new MemoryStorage()
    writePendingQuestion('旧问题', storage, 1_000)

    expect(readPendingQuestion(storage, 1_000 + PENDING_QUESTION_TTL_MS + 1)).toBeNull()
    expect(storage.getItem(PENDING_QUESTION_KEY)).toBeNull()
  })

  it('恰好 24 小时仍可恢复', () => {
    const storage = new MemoryStorage()
    writePendingQuestion('卡点问题', storage, 1_000)

    expect(readPendingQuestion(storage, 1_000 + PENDING_QUESTION_TTL_MS)?.text).toBe('卡点问题')
  })

  it('损坏或未来时间的缓存直接丢弃', () => {
    const storage = new MemoryStorage()
    storage.setItem(PENDING_QUESTION_KEY, '{broken')
    expect(readPendingQuestion(storage, 1_000)).toBeNull()

    storage.setItem(PENDING_QUESTION_KEY, JSON.stringify({ text: '未来问题', savedAt: 10_000 }))
    expect(readPendingQuestion(storage, 1_000)).toBeNull()

    storage.setItem(PENDING_QUESTION_KEY, JSON.stringify({ text: '   ', savedAt: 1_000 }))
    expect(readPendingQuestion(storage, 2_000)).toBeNull()
  })

  it('存储不可用时安全降级', () => {
    expect(writePendingQuestion('问题', null)).toBeNull()
    expect(readPendingQuestion(null)).toBeNull()
    expect(() => clearPendingQuestion(null)).not.toThrow()
  })
})
