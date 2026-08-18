import assert from 'node:assert/strict'
import test from 'node:test'

// 必须在动态导入 tts.mjs 前设置环境变量，因为模块加载时会读取这些配置。
process.env.AUTH_SESSION_SECRET = 'competition-test-session-secret-32-chars'
process.env.TTS_AUTH_TOKEN = ''
process.env.TTS_PROVIDER = 'disabled'
process.env.TTS_MAX_TEXT_LENGTH = '2000'
process.env.TTS_IP_LIMIT = '1'
process.env.TTS_USER_LIMIT = '2'
process.env.TTS_RATE_WINDOW_MINUTES = '60'

const { issueSessionToken } = await import('../session.mjs')
const { handleTtsRoute } = await import('../tts.mjs')

const buildTools = () => {
  const responses = []
  const tools = {
    responses,
    json(res, statusCode, payload) {
      responses.push({ statusCode, payload })
      return payload
    },
    async parseJsonBody() {
      return { text: '你好，请合成这段测试语音。' }
    },
    allowOrigin: 'http://localhost:5173',
  }
  return tools
}

const buildReq = (options = {}) => ({
  method: 'POST',
  url: '/tts',
  headers: options.headers || {},
  socket: { remoteAddress: options.remoteAddress || '203.0.113.30' },
  connection: { remoteAddress: options.remoteAddress || '203.0.113.30' },
})

test('H1: anonymous TTS call is rejected when TTS_AUTH_TOKEN is not configured', async () => {
  const tools = buildTools()
  const res = {}

  await handleTtsRoute(buildReq({ remoteAddress: '203.0.113.31' }), res, tools)

  assert.equal(tools.responses.length, 1)
  assert.equal(tools.responses[0].statusCode, 401)
  assert.equal(tools.responses[0].payload.error.code, 'AUTH_REQUIRED')
})

test('H1: authenticated TTS call passes auth and reaches provider', async () => {
  const tools = buildTools()
  const res = {}
  const { accessToken } = issueSessionToken({
    id: 'tts-user-1',
    username: 'tts-user@example.com',
    displayName: 'TTS 测试用户',
    role: 'user',
  })

  await handleTtsRoute(
    buildReq({
      headers: { authorization: `Bearer ${accessToken}` },
      remoteAddress: '203.0.113.32',
    }),
    res,
    tools,
  )

  assert.equal(tools.responses.length, 1)
  assert.equal(tools.responses[0].statusCode, 503)
  assert.equal(tools.responses[0].payload.error.code, 'TTS_DISABLED')
})

test('H1: per-IP rate limit blocks the second call in the same window', async () => {
  const tools = buildTools()
  const res = {}
  const { accessToken } = issueSessionToken({
    id: 'tts-user-2',
    username: 'tts-user-2@example.com',
    displayName: 'TTS 测试用户 2',
    role: 'user',
  })

  const req = () =>
    buildReq({
      headers: { authorization: `Bearer ${accessToken}` },
      remoteAddress: '203.0.113.33',
    })

  await handleTtsRoute(req(), res, tools)
  await handleTtsRoute(req(), res, tools)

  assert.equal(tools.responses.length, 2)
  assert.equal(tools.responses[0].statusCode, 503)
  assert.equal(tools.responses[0].payload.error.code, 'TTS_DISABLED')
  assert.equal(tools.responses[1].statusCode, 429)
  assert.equal(tools.responses[1].payload.error.code, 'TTS_RATE_LIMITED')
})

test('H1: overlong TTS text is rejected before synthesis', async () => {
  const tools = {
    ...buildTools(),
    async parseJsonBody() {
      return { text: '长'.repeat(2001) }
    },
  }
  const res = {}
  const { accessToken } = issueSessionToken({
    id: 'tts-user-3',
    username: 'tts-user-3@example.com',
    displayName: 'TTS 测试用户 3',
    role: 'user',
  })

  await handleTtsRoute(
    buildReq({
      headers: { authorization: `Bearer ${accessToken}` },
      remoteAddress: '203.0.113.34',
    }),
    res,
    tools,
  )

  assert.equal(tools.responses.length, 1)
  assert.equal(tools.responses[0].statusCode, 400)
  assert.equal(tools.responses[0].payload.error.code, 'TTS_TEXT_TOO_LONG')
})