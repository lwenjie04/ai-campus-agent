import { defineStore } from 'pinia'
import {
  CONVERSATION_SCHEMA_VERSION,
  type Conversation,
  type ConversationMessage,
  type ConversationMessageStatus,
  type ConversationSummary,
} from '@/types/conversation'
import {
  createLocalConversationRepository,
  getDefaultConversationStorage,
  type ConversationRepository,
  type SaveOutcome,
  type StorageFailureReason,
  type StorageLike,
} from '@/services/conversation-repository'
import { migrateLegacySession, type LegacyMigrationResult } from '@/services/migrate-conversations'
import { createId } from '@/utils/id'

// 节流写入：输入草稿或流式更新时不每个字符都同步写 localStorage。
const PERSIST_DELAY_MS = 400
const TITLE_MAX_LENGTH = 20

// 仓库可在测试中替换；生产默认使用浏览器 localStorage。
let repository: ConversationRepository = createLocalConversationRepository()
let legacyStorage: StorageLike | null = getDefaultConversationStorage()
let persistTimer: ReturnType<typeof setTimeout> | null = null

export const setConversationRepository = (
  next: ConversationRepository,
  storage: StorageLike | null = getDefaultConversationStorage(),
) => {
  repository = next
  legacyStorage = storage
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
}

export const getConversationRepository = () => repository

// 3.5 会补齐真实的游客标识与账号切换；这里先提供稳定的作用域构造。
export const resolveOwnerScope = (userId?: string) => (userId ? `user:${userId}` : 'guest:local')

const normalizeText = (text: string, maxLength: number) => {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}…` : compact
}

// 刷新或重新打开后，未完成的生成不能继续显示为进行中，也不能自动重发。
const interruptGenerating = (conversation: Conversation): boolean => {
  let changed = false
  conversation.messages = conversation.messages.map((message) => {
    if (message.status !== 'generating') return message
    changed = true
    return { ...message, status: 'interrupted' as ConversationMessageStatus, updatedAt: Date.now() }
  })
  return changed
}

export const useConversationsStore = defineStore('conversations', {
  state: () => ({
    ownerScope: 'guest:local',
    summaries: [] as ConversationSummary[],
    active: null as Conversation | null,
    storageError: '' as '' | StorageFailureReason,
    // 旧单会话缓存的迁移结果：3.3 据此给出“是否导入旧记录”的确认入口。
    legacyMigration: null as LegacyMigrationResult | null,
  }),

  getters: {
    hasPersistedActive(state): boolean {
      if (!state.active) return false
      return state.summaries.some((summary) => summary.conversationId === state.active?.conversationId)
    },
  },

  actions: {
    hasUserContent(conversation?: Conversation | null) {
      const target = conversation ?? this.active
      return Boolean(target?.messages.some((message) => message.role === 'user' && message.content.trim()))
    },

    openScope(ownerScope: string) {
      this.flush()
      // 迁移是幂等的；每次进入新的身份空间都确认一次旧缓存状态。
      this.legacyMigration = migrateLegacySession(repository, legacyStorage)
      this.ownerScope = ownerScope
      this.summaries = repository.list(ownerScope)
      this.active = null
      this.storageError = ''
    },

    createDraft() {
      const now = Date.now()
      const draft: Conversation = {
        schemaVersion: CONVERSATION_SCHEMA_VERSION,
        conversationId: createId('conv'),
        ownerScope: this.ownerScope,
        title: '',
        createdAt: now,
        updatedAt: now,
        draft: '',
        messages: [],
      }
      // 空对话只在内存中存在，首次实际发送后才进入历史。
      this.active = draft
      return draft
    },

    // 页面完成一轮问答后，把整份消息一次性回写；返回保存结果供界面提示。
    replaceActive(conversation: Conversation): SaveOutcome {
      this.active = { ...conversation, ownerScope: this.ownerScope }
      return this.flush()
    },

    // 其他标签页写入后只刷新索引，不覆盖当前正在运行的会话。
    refreshSummaries() {
      this.summaries = repository.list(this.ownerScope)
    },

    loadConversation(conversationId: string) {
      const loaded = repository.load(conversationId, this.ownerScope)
      if (!loaded) return false

      const interrupted = interruptGenerating(loaded)
      this.active = loaded
      if (interrupted) {
        // 中断状态需要落盘，避免下次刷新又恢复成 generating。
        const outcome = repository.save(loaded)
        if (!outcome.ok) this.storageError = outcome.reason
        this.summaries = repository.list(this.ownerScope)
      }
      return true
    },

    appendMessage(message: ConversationMessage) {
      if (!this.active) return
      this.active.messages.push(message)
      this.active.updatedAt = Date.now()

      if (message.role === 'user' && !this.active.title && message.content.trim()) {
        this.active.title = normalizeText(message.content, TITLE_MAX_LENGTH)
      }

      this.schedulePersist()
    },

    updateMessage(messageId: string, patch: Partial<ConversationMessage>) {
      if (!this.active) return
      const target = this.active.messages.find((message) => message.messageId === messageId)
      if (!target) return
      Object.assign(target, patch, { updatedAt: Date.now() })
      this.active.updatedAt = Date.now()
      this.schedulePersist()
    },

    setMessageStatus(messageId: string, status: ConversationMessageStatus) {
      this.updateMessage(messageId, { status })
    },

    interruptActive() {
      if (!this.active) return
      if (!interruptGenerating(this.active)) return
      this.active.updatedAt = Date.now()
      this.schedulePersist()
    },

    setDraft(text: string) {
      if (!this.active) return
      this.active.draft = text
      this.active.updatedAt = Date.now()
      this.schedulePersist()
    },

    schedulePersist() {
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(() => {
        persistTimer = null
        this.saveNow()
      }, PERSIST_DELAY_MS)
    },

    // 主动落盘：切换会话、离开页面或测试断言时调用。
    flush(): SaveOutcome {
      if (persistTimer) {
        clearTimeout(persistTimer)
        persistTimer = null
      }
      return this.saveNow()
    },

    saveNow(): SaveOutcome {
      if (!this.active) return { ok: true }

      if (!this.hasUserContent(this.active)) {
        // 空对话不入历史；若之前已写入（例如被清空），从索引里移除。
        if (this.hasPersistedActive) {
          repository.remove(this.active.conversationId)
          this.summaries = repository.list(this.ownerScope)
        }
        return { ok: true }
      }

      this.active.updatedAt = Date.now()
      if (!this.active.title) {
        const firstUser = this.active.messages.find((message) => message.role === 'user')
        this.active.title = normalizeText(firstUser?.content || '未命名会话', TITLE_MAX_LENGTH)
      }

      const outcome = repository.save(this.active)
      if (outcome.ok) {
        this.storageError = ''
        this.summaries = repository.list(this.ownerScope)
      } else {
        // 保存失败不阻断当前内存会话，界面据此提示“本次可能无法恢复”。
        this.storageError = outcome.reason
      }
      return outcome
    },

    removeConversation(conversationId: string) {
      repository.remove(conversationId)
      if (this.active?.conversationId === conversationId) this.active = null
      this.summaries = repository.list(this.ownerScope)
    },

    renameConversation(conversationId: string, title: string) {
      const nextTitle = normalizeText(title, TITLE_MAX_LENGTH) || '未命名会话'
      if (this.active?.conversationId === conversationId) {
        this.active.title = nextTitle
        this.active.updatedAt = Date.now()
        this.saveNow()
        return
      }

      const loaded = repository.load(conversationId, this.ownerScope)
      if (!loaded) return
      loaded.title = nextTitle
      loaded.updatedAt = Date.now()
      const outcome = repository.save(loaded)
      if (!outcome.ok) this.storageError = outcome.reason
      this.summaries = repository.list(this.ownerScope)
    },
  },
})
