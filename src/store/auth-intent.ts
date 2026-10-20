import { defineStore } from 'pinia'
import { createId } from '@/utils/id'

const STORAGE_KEY = 'ai-campus-agent.auth-intent.v1'
// 待执行动作只保留 24 小时；过期必须丢弃，不能被下次登录误执行。
export const AUTH_INTENT_TTL_MS = 24 * 60 * 60 * 1000

export type AuthIntentType = 'send-question' | 'open-post' | 'play-answer' | 'enter-admin'

export type AuthIntent = {
  intentId: string
  type: AuthIntentType
  target: string
  createdAt: number
  consumedAt?: number
}

const isIntentType = (value: unknown): value is AuthIntentType =>
  value === 'send-question' ||
  value === 'open-post' ||
  value === 'play-answer' ||
  value === 'enter-admin'

const parseIntent = (raw: string | null, now: number): AuthIntent | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AuthIntent>
    if (
      typeof parsed.intentId !== 'string' ||
      !isIntentType(parsed.type) ||
      typeof parsed.target !== 'string' ||
      typeof parsed.createdAt !== 'number'
    ) {
      return null
    }
    if (parsed.createdAt > now || now - parsed.createdAt > AUTH_INTENT_TTL_MS) return null
    return {
      intentId: parsed.intentId,
      type: parsed.type,
      target: parsed.target,
      createdAt: parsed.createdAt,
      ...(typeof parsed.consumedAt === 'number' ? { consumedAt: parsed.consumedAt } : {}),
    }
  } catch {
    return null
  }
}

export const useAuthIntentStore = defineStore('authIntent', {
  state: () => ({
    intent: null as AuthIntent | null,
    hydrated: false,
  }),

  actions: {
    hydrate(now = Date.now()) {
      if (this.hydrated) return this.intent
      this.hydrated = true
      try {
        const storage = typeof window !== 'undefined' ? window.localStorage : null
        const raw = storage?.getItem(STORAGE_KEY) ?? null
        this.intent = parseIntent(raw, now)
        if (!this.intent && raw) storage?.removeItem(STORAGE_KEY)
      } catch {
        this.intent = null
      }
      return this.intent
    },

    // 同一动作重复触发时复用未消费的意图，避免登录后执行两次。
    queue(type: AuthIntentType, target: string, now = Date.now()): AuthIntent {
      this.hydrate(now)
      const normalized = target.trim()
      if (
        this.intent &&
        !this.intent.consumedAt &&
        this.intent.type === type &&
        this.intent.target === normalized
      ) {
        return this.intent
      }

      const intent: AuthIntent = {
        intentId: createId('intent'),
        type,
        target: normalized,
        createdAt: now,
      }
      this.intent = intent
      this.persist()
      return intent
    },

    // 只返回尚未消费且未过期的意图；刷新后调用方应先确认再执行。
    peek(now = Date.now()): AuthIntent | null {
      this.hydrate(now)
      if (!this.intent) return null
      if (this.intent.consumedAt) return null
      if (now - this.intent.createdAt > AUTH_INTENT_TTL_MS) {
        this.clear()
        return null
      }
      return this.intent
    },

    consume(intentId: string, now = Date.now()): AuthIntent | null {
      this.hydrate(now)
      if (!this.intent || this.intent.intentId !== intentId || this.intent.consumedAt) return null
      this.intent = { ...this.intent, consumedAt: now }
      this.persist()
      return this.intent
    },

    clear() {
      this.intent = null
      try {
        if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // 存储不可用时仅清内存。
      }
    },

    persist() {
      try {
        if (typeof window === 'undefined') return
        if (this.intent) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.intent))
        else window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // 无痕或禁用存储时保持内存态。
      }
    },
  },
})
