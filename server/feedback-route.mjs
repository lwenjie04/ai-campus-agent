import { randomUUID } from 'node:crypto'
import { readRequestClientIp } from './client-ip.mjs'
import { resolveFeedbackOwners } from './guest-quota.mjs'
import { upsertFeedback } from './feedback.mjs'

const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const RATE_WINDOW_MS = 60_000
const OWNER_RATE_LIMIT = positiveInteger(process.env.FEEDBACK_RATE_LIMIT_PER_OWNER, 30)
const IP_RATE_LIMIT = positiveInteger(process.env.FEEDBACK_RATE_LIMIT_PER_IP, 120)
const MAX_RATE_BUCKETS = 10_000
const rateBuckets = new Map()

const errorPayload = (code, message, requestId) => ({
  error: { code, message },
  requestId,
})

const parseOrigin = (origin) => {
  try {
    return new URL(origin).origin
  } catch {
    return ''
  }
}

const checkOrigin = (req, allowOrigin) => {
  const origin = String(req.headers?.origin || '').trim()
  if (!origin) return true
  return parseOrigin(origin) !== '' && parseOrigin(origin) === parseOrigin(allowOrigin)
}

const rateLimitKeys = (owners, ipAddress) => {
  const keys = owners.map(({ ownerType, ownerId }) => ({
    key: `owner:${ownerType}:${ownerId}`,
    limit: OWNER_RATE_LIMIT,
  }))
  if (ipAddress) keys.push({ key: `ip:${ipAddress}`, limit: IP_RATE_LIMIT })
  return keys
}

const consumeRateLimit = (keys, now = Date.now()) => {
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key)
  }

  for (const { key, limit } of keys) {
    const bucket = rateBuckets.get(key)
    if (bucket && bucket.count >= limit) {
      return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    }
  }

  for (const { key } of keys) {
    const bucket = rateBuckets.get(key)
    if (bucket) bucket.count += 1
    else rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
  }

  while (rateBuckets.size > MAX_RATE_BUCKETS) {
    const oldestKey = rateBuckets.keys().next().value
    if (!oldestKey) break
    rateBuckets.delete(oldestKey)
  }
  return 0
}

const validateFeedbackBody = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const keys = Object.keys(body)
  if (keys.length !== 2 || !keys.includes('requestId') || !keys.includes('value')) return null
  if (
    typeof body.requestId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId) ||
    !['helpful', 'none'].includes(body.value)
  ) {
    return null
  }
  return { requestId: body.requestId, value: body.value }
}

export const resetFeedbackRateLimitForTests = () => rateBuckets.clear()

export const handleFeedbackRoute = async (req, res, requestUrl, { json, parseJsonBody, allowOrigin }) => {
  const path = requestUrl.pathname.replace(/^\/api/, '')
  if (req.method !== 'POST' || path !== '/feedback') return false

  const operationRequestId = randomUUID()
  if (!checkOrigin(req, allowOrigin)) {
    return json(res, 403, errorPayload('ORIGIN_NOT_ALLOWED', '请求来源不允许', operationRequestId))
  }

  let body
  try {
    body = await parseJsonBody(req)
  } catch (error) {
    const tooLarge = error?.message === 'BODY_TOO_LARGE'
    const statusCode = tooLarge ? 413 : 400
    const code = tooLarge ? 'BODY_TOO_LARGE' : 'INVALID_JSON'
    const message = tooLarge ? '请求体过大' : '请求体不是有效 JSON'
    return json(res, statusCode, errorPayload(code, message, operationRequestId))
  }

  const feedbackBody = validateFeedbackBody(body)
  if (!feedbackBody) {
    return json(
      res,
      400,
      errorPayload('INVALID_FEEDBACK', '反馈请求必须只包含有效 requestId 和 helpful/none value', operationRequestId),
    )
  }

  const owners = resolveFeedbackOwners(req)
  if (owners.length === 0) {
    return json(
      res,
      401,
      errorPayload('FEEDBACK_IDENTITY_REQUIRED', '请使用有效登录会话或游客凭据提交反馈', operationRequestId),
    )
  }

  const ipAddress = readRequestClientIp(req, {
    trustProxy: process.env.FEEDBACK_TRUST_PROXY === 'true',
  })
  const retryAfter = consumeRateLimit(rateLimitKeys(owners, ipAddress))
  if (retryAfter) {
    return json(
      res,
      429,
      errorPayload('RATE_LIMITED', '反馈操作过于频繁，请稍后再试', operationRequestId),
      { 'Retry-After': String(retryAfter) },
    )
  }

  try {
    let storedFeedback = null
    for (const owner of owners) {
      try {
        storedFeedback = await upsertFeedback({ ...feedbackBody, ...owner })
        break
      } catch (error) {
        if (error?.code !== 'FEEDBACK_NOT_ELIGIBLE') throw error
      }
    }

    if (!storedFeedback) {
      return json(
        res,
        409,
        errorPayload('FEEDBACK_NOT_ELIGIBLE', '该回答没有可用反馈凭据', operationRequestId),
      )
    }

    return json(res, 200, {
      data: {
        requestId: storedFeedback.requestId,
        value: storedFeedback.value,
        updatedAt: storedFeedback.updatedAt,
      },
    })
  } catch (error) {
    if (error?.code === 'INVALID_FEEDBACK') {
      return json(res, 400, errorPayload('INVALID_FEEDBACK', '反馈值无效', operationRequestId))
    }
    if (error?.code === 'FEEDBACK_STORAGE_UNAVAILABLE') {
      return json(
        res,
        503,
        errorPayload('FEEDBACK_STORAGE_UNAVAILABLE', '反馈服务暂不可用，请稍后重试', operationRequestId),
      )
    }

    console.error(
      JSON.stringify({
        level: 'error',
        requestId: operationRequestId,
        path: '/feedback',
        code: error?.code || 'INTERNAL_ERROR',
      }),
    )
    return json(res, 500, errorPayload('INTERNAL_ERROR', '服务暂时不可用，请稍后重试', operationRequestId))
  }
}
