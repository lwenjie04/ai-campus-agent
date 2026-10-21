import { apiUrl } from '@/config/app'
import { getAuthRequestHeaders } from '@/api/auth'

export type FeedbackValue = 'helpful' | 'none'

// 7.2：回答反馈客户端。只提交服务端生成的 requestId 与 helpful/none，主体由服务端凭据决定。
export class FeedbackError extends Error {
  code: string
  status: number
  retryAfterSeconds?: number

  constructor(message: string, code: string, status: number, retryAfterSeconds?: number) {
    super(message)
    this.name = 'FeedbackError'
    this.code = code
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

type FeedbackResponse = {
  data?: {
    requestId?: string
    value?: FeedbackValue
    updatedAt?: string
  }
  error?: {
    code?: string
    message?: string
  }
}

export const submitAnswerFeedback = async ({
  requestId,
  value,
}: {
  requestId: string
  value: FeedbackValue
}) => {
  const resp = await fetch(apiUrl('/feedback'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthRequestHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify({ requestId, value }),
  })

  let payload: FeedbackResponse | null = null
  try {
    payload = (await resp.json()) as FeedbackResponse
  } catch {
    payload = null
  }

  if (!resp.ok) {
    const retryAfterHeader = Number.parseInt(resp.headers.get('Retry-After') || '', 10)
    throw new FeedbackError(
      payload?.error?.message || `反馈提交失败（${resp.status}）`,
      payload?.error?.code || 'FEEDBACK_REQUEST_FAILED',
      resp.status,
      Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader : undefined,
    )
  }

  return {
    requestId: payload?.data?.requestId || requestId,
    value: payload?.data?.value || value,
    updatedAt: payload?.data?.updatedAt || '',
  }
}
