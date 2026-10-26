import { beforeEach, describe, expect, it } from 'vitest'
import { readPendingQuestion } from '@/services/pending-question'
import type { StorageLike } from '@/services/conversation-repository'
import {
  NEW_CHAT_DRAFT_KEY,
  clearNewChatDraft,
  prefillChatQuestion,
  readNewChatDraft,
  writeNewChatDraft,
} from '../chat-draft'

const PENDING_QUESTION_KEY = 'ai-campus-agent.pending-question.v1'

beforeEach(() => {
  window.localStorage.clear()
})

describe('聊天草稿与搜索转问预填', () => {
  it('转问只写入 /chat/new 草稿，不进入待发队列', () => {
    expect(prefillChatQuestion('帮我查一下「材料」相关的办事事项和学校最新通知。')).toBe(true)

    expect(readNewChatDraft()).toContain('材料')
    expect(window.localStorage.getItem(NEW_CHAT_DRAFT_KEY)).toContain('材料')
    // 不写“待发送问题”键：刷新后不会自动补发，也不会消耗问答额度。
    expect(readPendingQuestion()).toBeNull()
    expect(window.localStorage.getItem(PENDING_QUESTION_KEY)).toBeNull()
  })

  it('刷新时重复读取草稿是幂等的，不消费草稿', () => {
    prefillChatQuestion('帮我查一下「报修」相关的办事事项和学校最新通知。')
    const stored = window.localStorage.getItem(NEW_CHAT_DRAFT_KEY)

    expect(readNewChatDraft()).toBe(stored)
    expect(readNewChatDraft()).toBe(stored)
    expect(window.localStorage.getItem(NEW_CHAT_DRAFT_KEY)).toBe(stored)
  })

  it('写入空文本或显式清空会删除草稿', () => {
    writeNewChatDraft('未发送草稿')
    expect(readNewChatDraft()).toBe('未发送草稿')

    writeNewChatDraft('')
    expect(readNewChatDraft()).toBe('')

    writeNewChatDraft('另一条草稿')
    clearNewChatDraft()
    expect(readNewChatDraft()).toBe('')
    expect(window.localStorage.getItem(NEW_CHAT_DRAFT_KEY)).toBeNull()
  })

  it('存储不可用时安全降级，不抛出异常', () => {
    const broken: StorageLike = {
      getItem() {
        throw new Error('storage blocked')
      },
      setItem() {
        throw new Error('storage blocked')
      },
      removeItem() {
        throw new Error('storage blocked')
      },
    }

    expect(prefillChatQuestion('帮我查一下「材料」', broken)).toBe(false)
    expect(readNewChatDraft(broken)).toBe('')
    expect(() => clearNewChatDraft(broken)).not.toThrow()
  })
})
