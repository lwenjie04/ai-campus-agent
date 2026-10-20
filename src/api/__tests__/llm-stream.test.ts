import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loadLlm = async (mockMode = false) => {
  vi.resetModules()
  vi.stubEnv('VITE_USE_MOCK_CHAT', mockMode ? 'true' : 'false')
  return import('@/api/llm')
}

const ndjson = [
  JSON.stringify({ type: 'start', requestId: 'req-1' }),
  JSON.stringify({ type: 'delta', delta: '你' }),
  JSON.stringify({ type: 'delta', delta: '好' }),
  JSON.stringify({ type: 'meta', requestId: 'req-1', content: '你好', sources: [] }),
  JSON.stringify({ type: 'done', requestId: 'req-1' }),
].join('\n')

beforeEach(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('streamChat 取消信号', () => {
  it('把 AbortSignal 传给 /api/chat/stream 的 fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(ndjson, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { streamChat } = await loadLlm()

    const controller = new AbortController()
    const deltas: string[] = []
    const result = await streamChat(
      [{ role: 'user', content: '补考怎么报名？' }],
      { onDelta: (delta) => deltas.push(delta) },
      controller.signal,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/chat/stream')
    expect(init.signal).toBe(controller.signal)
    expect(deltas.join('')).toBe('你好')
    expect(result.content).toBe('你好')
  })

  it('Mock 模式在已取消时直接抛 AbortError', async () => {
    const { streamChat } = await loadLlm(true)
    const controller = new AbortController()
    controller.abort()

    await expect(
      streamChat([{ role: 'user', content: '你好' }], {}, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
