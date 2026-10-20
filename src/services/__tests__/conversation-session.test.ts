import { describe, expect, it } from 'vitest'
import {
  applyMessagesToConversation,
  buildConversationTitle,
  conversationToMessages,
  toAgentMessage,
  toConversationMessage,
} from '@/services/conversation-session'
import { CONVERSATION_SCHEMA_VERSION, type Conversation } from '@/types/conversation'
import type { Message } from '@/types/agent'

const conversation = (messages: Conversation['messages'] = []): Conversation => ({
  schemaVersion: CONVERSATION_SCHEMA_VERSION,
  conversationId: 'conv_1',
  ownerScope: 'guest:local',
  title: '',
  createdAt: 1,
  updatedAt: 1,
  draft: '',
  messages,
})

describe('会话与消息互转', () => {
  it('pending/sent/error/interrupted 与持久化状态对应', () => {
    expect(toConversationMessage({ role: 'assistant', content: 'a', status: 'pending' }, 0)?.status).toBe('generating')
    expect(toConversationMessage({ role: 'assistant', content: 'a', status: 'sent' }, 0)?.status).toBe('done')
    expect(toConversationMessage({ role: 'assistant', content: 'a', status: 'error' }, 0)?.status).toBe('error')
    expect(toConversationMessage({ role: 'assistant', content: 'a', status: 'interrupted' }, 0)?.status).toBe('interrupted')

    expect(toAgentMessage({ messageId: 'm', role: 'assistant', content: 'a', status: 'generating', createdAt: 1 }).status).toBe('pending')
    expect(toAgentMessage({ messageId: 'm', role: 'assistant', content: 'a', status: 'interrupted', createdAt: 1 }).status).toBe('interrupted')
  })

  it('跳过 system 提示词与空消息', () => {
    const messages: Message[] = [
      { role: 'system', content: 'prompt' },
      { role: 'assistant', content: '   ', status: 'sent' },
      { role: 'user', content: '补考怎么报名？' },
    ]

    const converted = messages.map((message, index) => toConversationMessage(message, index))

    expect(converted.filter(Boolean)).toHaveLength(1)
    expect(converted[1]).toBeNull()
  })

  it('标题取首条用户问题且不超过 20 字', () => {
    expect(buildConversationTitle([{ role: 'assistant', content: 'hi' }, { role: 'user', content: '转专业需要什么条件？' }])).toBe('转专业需要什么条件？')
    expect(buildConversationTitle([{ role: 'user', content: '一'.repeat(30) }])).toBe(`${'一'.repeat(20)}…`)
    expect(buildConversationTitle([{ role: 'assistant', content: 'hi' }])).toBe('')
  })

  it('回写会话时保留已有标题并过滤 system', () => {
    const base = conversation()
    const next = applyMessagesToConversation(base, [
      { role: 'system', content: 'prompt' },
      { role: 'user', content: '宿舍报修怎么申请？' },
      { role: 'assistant', content: '在后勤系统提交。', status: 'sent' },
    ])

    expect(next.title).toBe('宿舍报修怎么申请？')
    expect(next.messages).toHaveLength(2)
    expect(conversationToMessages(next)).toHaveLength(2)
  })

  it('读取会话时过滤 system 并保留来源与错误码', () => {
    const messages = conversationToMessages(
      conversation([
        { messageId: 'm1', role: 'user', content: '问题', status: 'done', createdAt: 1 },
        {
          messageId: 'm2',
          role: 'assistant',
          content: '回答',
          status: 'error',
          createdAt: 2,
          errorCode: 'MODEL_ERROR',
          sources: [{ title: '来源' }],
        },
      ]),
    )

    expect(messages[1].id).toBe('m2')
    expect(messages[1].status).toBe('error')
    expect(messages[1].errorCode).toBe('MODEL_ERROR')
    expect(messages[1].sources?.[0].title).toBe('来源')
  })
})
