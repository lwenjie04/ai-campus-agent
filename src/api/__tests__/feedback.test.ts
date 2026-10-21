import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackError, submitAnswerFeedback } from '../feedback'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('submitAnswerFeedback', () => {
  it('只提交 requestId 与 value，并携带会话凭据', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { requestId: 'req-1', value: 'helpful', updatedAt: '2026-10-21T00:00:00.000Z' } }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await submitAnswerFeedback({ requestId: 'req-1', value: 'helpful' })

    expect(result.requestId).toBe('req-1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(JSON.parse(init.body)).toEqual({ requestId: 'req-1', value: 'helpful' })
  })

  it('409 不可反馈映射为 FEEDBACK_NOT_ELIGIBLE', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers(),
      json: async () => ({ error: { code: 'FEEDBACK_NOT_ELIGIBLE', message: '该回答没有可用反馈凭据' } }),
    }) as unknown as typeof fetch

    await expect(submitAnswerFeedback({ requestId: 'req-2', value: 'none' })).rejects.toMatchObject({
      name: 'FeedbackError',
      code: 'FEEDBACK_NOT_ELIGIBLE',
      status: 409,
    })
  })

  it('429 保留 Retry-After 秒数供界面提示重试', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '12' }),
      json: async () => ({ error: { code: 'RATE_LIMITED', message: '反馈操作过于频繁' } }),
    }) as unknown as typeof fetch

    const error = await submitAnswerFeedback({ requestId: 'req-3', value: 'helpful' }).catch((cause) => cause)
    expect(error).toBeInstanceOf(FeedbackError)
    expect(error.code).toBe('RATE_LIMITED')
    expect(error.retryAfterSeconds).toBe(12)
  })

  it('非 JSON 错误响应也抛出可重试错误', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: new Headers(),
      json: async () => {
        throw new Error('invalid json')
      },
    }) as unknown as typeof fetch

    await expect(submitAnswerFeedback({ requestId: 'req-4', value: 'helpful' })).rejects.toMatchObject({
      code: 'FEEDBACK_REQUEST_FAILED',
      status: 502,
    })
  })
})
