import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '@/types/agent'

vi.mock('@/api/llm', () => ({
  streamChat: vi.fn(),
}))

const { streamChat } = await import('@/api/llm')
const { useAgentStore } = await import('@/store/agent')

const streamChatMock = vi.mocked(streamChat)

const message = (overrides: Partial<Message> & Pick<Message, 'role' | 'content'>): Message => ({
  id: `${overrides.role}-test`,
  status: 'sent',
  createdAt: 1,
  ...overrides,
})

beforeEach(() => {
  setActivePinia(createPinia())
  streamChatMock.mockReset()
  localStorage.clear()
})

afterEach(() => {
  // 确保没有跨用例遗留的运行态。
  const store = useAgentStore()
  store.cancelGeneration()
})

describe('生成运行身份与取消', () => {
  it('停止生成后保留已生成文本并忽略迟到 delta', async () => {
    let handlers: { onDelta?: (delta: string) => void } = {}
    streamChatMock.mockImplementation(
      (_messages, h, signal) =>
        new Promise((_resolve, reject) => {
          handlers = h
          signal?.addEventListener('abort', () => reject(new DOMException('取消', 'AbortError')))
        }),
    )

    const store = useAgentStore()
    void store.sendMessage('补考怎么报名？')
    await Promise.resolve()

    handlers.onDelta?.('部分回答')
    const assistant = store.messages[store.messages.length - 1]
    expect(assistant.content).toBe('部分回答')
    expect(store.loading).toBe(true)

    expect(store.cancelGeneration()).toBe(true)
    expect(assistant.status).toBe('interrupted')
    expect(store.loading).toBe(false)
    await store.whenIdle()

    handlers.onDelta?.('迟到内容')
    expect(assistant.content).toBe('部分回答')

    expect(store.messages.filter((item) => item.role === 'user')).toHaveLength(1)
  })

  it('没有进行中的生成时取消返回 false', () => {
    const store = useAgentStore()
    expect(store.cancelGeneration()).toBe(false)
  })

  it('重试复用原问题与回答位置，不追加用户消息', async () => {
    streamChatMock.mockImplementation(async (_messages, handlers) => {
      handlers.onMeta?.({ content: '重新生成的回答', sources: [] })
      return { content: '重新生成的回答', sources: [] }
    })

    const store = useAgentStore()
    store.messages = [
      message({ id: 'sys', role: 'system', content: 'prompt' }),
      message({ id: 'u1', role: 'user', content: '转专业需要什么条件？' }),
      message({ id: 'a1', role: 'assistant', content: '旧回答', status: 'error', errorCode: 'MODEL_ERROR' }),
    ]
    const before = store.messages.length

    const result = await store.retryGeneration('a1')

    expect(result).toEqual({ ok: true })
    expect(store.messages).toHaveLength(before)
    expect(store.messages.filter((item) => item.role === 'user')).toHaveLength(1)
    expect(store.messages[2].content).toBe('重新生成的回答')
    expect(store.messages[2].status).toBe('sent')
    expect(store.messages[2].errorCode).toBeUndefined()

    const sentMessages = streamChatMock.mock.calls[0][0] as Message[]
    expect(sentMessages.filter((item) => item.role === 'user')).toHaveLength(1)
  })

  it('找不到对应回答时拒绝重试', async () => {
    const store = useAgentStore()
    store.messages = [message({ id: 'u1', role: 'user', content: '问题' })]

    await expect(store.retryGeneration('missing')).resolves.toEqual({
      ok: false,
      errorCode: 'RETRY_NOT_FOUND',
    })
  })

  it('刷新恢复时把遗留 pending 转成 interrupted', () => {
    localStorage.setItem(
      'ai-campus-agent.session.v2',
      JSON.stringify({
        messages: [
          { id: 'u1', role: 'user', content: '问题', status: 'sent', createdAt: 1 },
          { id: 'a1', role: 'assistant', content: '部分', status: 'pending', createdAt: 2 },
        ],
      }),
    )

    const store = useAgentStore()
    store.hydrateSession()

    expect(store.messages[1].status).toBe('interrupted')
    expect(store.messages[1].content).toBe('部分')
  })
})
