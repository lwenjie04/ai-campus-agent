import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { test } from 'node:test'

const sessionSecret = 'feedback-route-test-secret-at-least-32-characters'
process.env.AUTH_SESSION_SECRET = sessionSecret
const { issueSessionToken } = await import('../session.mjs')

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const waitForHealth = async (baseUrl, child, timeoutMilliseconds = 10_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMilliseconds) {
    if (child.exitCode !== null) throw new Error(`backend exited early with code ${child.exitCode}`)
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {
      // Retry until the child backend is accepting requests.
    }
    await sleep(100)
  }
  throw new Error('backend /api/health check timed out')
}

const parseEvents = async (response) =>
  (await response.text())
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))

test('POST /api/feedback requires a matching receipt, trusts only verified credentials, and rate limits', async (t) => {
  const port = 38_000 + Math.floor(Math.random() * 1_000)
  const baseUrl = `http://127.0.0.1:${port}`
  let output = ''
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      LLM_PROVIDER_MODE: 'mock',
      LIGHTRAG_PRIMARY: 'false',
      MYSQL_HOST: '127.0.0.1',
      MYSQL_PORT: '1',
      MYSQL_USER: 'feedback-test',
      MYSQL_PASSWORD: 'feedback-test',
      MYSQL_DATABASE: 'feedback_test',
      AUTH_SESSION_SECRET: sessionSecret,
      GUEST_COOKIE_SECRET: 'feedback-route-guest-secret-at-least-32-chars',
      FEEDBACK_TEST_MEMORY: 'true',
      FEEDBACK_RATE_LIMIT_PER_OWNER: '30',
      FEEDBACK_RATE_LIMIT_PER_IP: '120',
      CORS_ORIGIN: 'http://localhost:5173',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  child.stdout.on('data', (chunk) => {
    output += String(chunk)
  })
  child.stderr.on('data', (chunk) => {
    output += String(chunk)
  })
  t.after(() => {
    if (child.exitCode === null) child.kill()
  })

  const ask = async (authorization = '') => {
    const response = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: '如何查询校园办事信息？' }] }),
    })
    const cookie = response.headers.get('set-cookie')?.split(';')[0] || ''
    return { response, cookie, events: await parseEvents(response) }
  }

  const sendFeedback = async ({ requestId, value = 'helpful', cookie = '', authorization = '', extra = {}, origin }) => {
    const response = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify({ requestId, value, ...extra }),
    })
    return { status: response.status, headers: response.headers, body: await response.json() }
  }

  try {
    await waitForHealth(baseUrl, child)

    const guestAnswer = await ask()
    assert.equal(guestAnswer.response.status, 200)
    const guestMeta = guestAnswer.events.find((event) => event.type === 'meta')
    assert.equal(guestMeta?.feedbackEligible, true)
    assert.ok(guestAnswer.cookie.startsWith('campus_guest_id='))
    const guestRequestId = guestMeta.requestId

    const helpful = await sendFeedback({ requestId: guestRequestId, cookie: guestAnswer.cookie })
    assert.equal(helpful.status, 200)
    assert.equal(helpful.body.data.requestId, guestRequestId)
    assert.equal(helpful.body.data.value, 'helpful')
    assert.ok(helpful.body.data.updatedAt)
    assert.equal((await sendFeedback({ requestId: guestRequestId, cookie: guestAnswer.cookie })).status, 200)
    const withdrawn = await sendFeedback({ requestId: guestRequestId, value: 'none', cookie: guestAnswer.cookie })
    assert.equal(withdrawn.status, 200)
    assert.equal(withdrawn.body.data.value, 'none')

    const fakeId = '00000000-0000-4000-8000-000000000000'
    const forged = await sendFeedback({ requestId: fakeId, cookie: guestAnswer.cookie })
    assert.equal(forged.status, 409)
    assert.equal(forged.body.error.code, 'FEEDBACK_NOT_ELIGIBLE')

    const ownerInjection = await sendFeedback({
      requestId: guestRequestId,
      cookie: guestAnswer.cookie,
      extra: { ownerId: 'victim' },
    })
    assert.equal(ownerInjection.status, 400)
    assert.equal(ownerInjection.body.error.code, 'INVALID_FEEDBACK')

    const invalidValue = await sendFeedback({
      requestId: guestRequestId,
      value: 'dislike',
      cookie: guestAnswer.cookie,
    })
    assert.equal(invalidValue.status, 400)
    assert.equal(invalidValue.body.error.code, 'INVALID_FEEDBACK')

    const malformedJsonResponse = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guestAnswer.cookie },
      body: '{invalid-json',
    })
    assert.equal(malformedJsonResponse.status, 400)
    assert.equal((await malformedJsonResponse.json()).error.code, 'INVALID_JSON')

    const invalidOrigin = await sendFeedback({
      requestId: guestRequestId,
      cookie: guestAnswer.cookie,
      origin: 'https://untrusted.example',
    })
    assert.equal(invalidOrigin.status, 403)
    assert.equal(invalidOrigin.body.error.code, 'ORIGIN_NOT_ALLOWED')

    const noIdentity = await sendFeedback({ requestId: guestRequestId })
    assert.equal(noIdentity.status, 401)
    assert.equal(noIdentity.body.error.code, 'FEEDBACK_IDENTITY_REQUIRED')

    const [cookieName, cookieValue] = guestAnswer.cookie.split('=')
    const changedSignature = cookieValue.endsWith('a') ? 'b' : 'a'
    const tamperedCookie = `${cookieName}=${cookieValue.slice(0, -1)}${changedSignature}`
    const invalidGuestCredential = await sendFeedback({ requestId: guestRequestId, cookie: tamperedCookie })
    assert.equal(invalidGuestCredential.status, 401)
    assert.equal(invalidGuestCredential.body.error.code, 'FEEDBACK_IDENTITY_REQUIRED')

    const secondGuest = await ask()
    assert.ok(secondGuest.cookie)
    const crossGuest = await sendFeedback({ requestId: guestRequestId, cookie: secondGuest.cookie })
    assert.equal(crossGuest.status, 409)
    assert.equal(crossGuest.body.error.code, 'FEEDBACK_NOT_ELIGIBLE')

    // A logged-in browser can still operate a guest answer only if it presents that answer's valid signed cookie.
    const guestWithLogin = await sendFeedback({
      requestId: guestRequestId,
      cookie: guestAnswer.cookie,
      authorization: `Bearer ${issueSessionToken({ id: 'feedback-user', username: 'user', role: 'user' }).accessToken}`,
    })
    assert.equal(guestWithLogin.status, 200)

    const userA = `Bearer ${issueSessionToken({ id: 'feedback-user-a', username: 'a', role: 'user' }).accessToken}`
    const userB = `Bearer ${issueSessionToken({ id: 'feedback-user-b', username: 'b', role: 'user' }).accessToken}`
    const userAnswer = await ask(userA)
    const userRequestId = userAnswer.events.find((event) => event.type === 'meta')?.requestId
    assert.ok(userRequestId)
    assert.equal(userAnswer.events.find((event) => event.type === 'meta')?.feedbackEligible, true)
    assert.equal((await sendFeedback({ requestId: userRequestId, authorization: userA })).status, 200)
    const crossAccount = await sendFeedback({ requestId: userRequestId, authorization: userB })
    assert.equal(crossAccount.status, 409)
    assert.equal(crossAccount.body.error.code, 'FEEDBACK_NOT_ELIGIBLE')

    let rateLimited = false
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const result = await sendFeedback({ requestId: guestRequestId, cookie: guestAnswer.cookie })
      if (result.status === 429) {
        rateLimited = true
        assert.equal(result.body.error.code, 'RATE_LIMITED')
        assert.ok(Number(result.headers.get('retry-after')) >= 1)
        break
      }
      assert.equal(result.status, 200)
    }
    assert.equal(rateLimited, true)
  } catch (error) {
    throw new Error(`${error.message}\nbackend output:\n${output}`)
  }
})

test('chat remains successful but feedback is unavailable when receipt persistence fails', async (t) => {
  const port = 39_000 + Math.floor(Math.random() * 1_000)
  const baseUrl = `http://127.0.0.1:${port}`
  let output = ''
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      LLM_PROVIDER_MODE: 'mock',
      LIGHTRAG_PRIMARY: 'false',
      MYSQL_HOST: '127.0.0.1',
      MYSQL_PORT: '1',
      MYSQL_USER: 'feedback-test',
      MYSQL_PASSWORD: 'feedback-test',
      MYSQL_DATABASE: 'feedback_test',
      AUTH_SESSION_SECRET: sessionSecret,
      GUEST_COOKIE_SECRET: 'feedback-route-guest-secret-at-least-32-chars',
      FEEDBACK_TEST_MEMORY: 'false',
      CORS_ORIGIN: 'http://localhost:5173',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  child.stdout.on('data', (chunk) => {
    output += String(chunk)
  })
  child.stderr.on('data', (chunk) => {
    output += String(chunk)
  })
  t.after(() => {
    if (child.exitCode === null) child.kill()
  })

  try {
    await waitForHealth(baseUrl, child)
    const answerResponse = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: '如何查询校园办事信息？' }] }),
    })
    assert.equal(answerResponse.status, 200)
    const cookie = answerResponse.headers.get('set-cookie')?.split(';')[0] || ''
    const events = await parseEvents(answerResponse)
    const meta = events.find((event) => event.type === 'meta')
    assert.equal(meta?.feedbackEligible, false)
    assert.equal(events.at(-1)?.type, 'done')

    const feedbackResponse = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ requestId: meta.requestId, value: 'helpful' }),
    })
    assert.equal(feedbackResponse.status, 503)
    assert.equal((await feedbackResponse.json()).error.code, 'FEEDBACK_STORAGE_UNAVAILABLE')
  } catch (error) {
    throw new Error(`${error.message}\nbackend output:\n${output}`)
  }
})
