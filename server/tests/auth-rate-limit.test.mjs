import assert from 'node:assert/strict'
import test from 'node:test'

// 在动态导入 auth.mjs 前设置环境变量，因为模块加载时读取这些配置。
process.env.AUTH_SESSION_SECRET = 'competition-test-session-secret-32-chars'
process.env.AUTH_ALLOW_MEMORY_FALLBACK = 'true'
process.env.AUTH_DEFAULT_ADMIN_USERNAME = 'competition-admin'
process.env.AUTH_DEFAULT_ADMIN_PASSWORD = 'competition-memory-admin-2026'
process.env.AUTH_DEFAULT_ADMIN_NAME = '测试管理员'
process.env.AUTH_NOTIFY_EMAIL = 'admin@example.test'
process.env.MYSQL_HOST = '127.0.0.1'
process.env.MYSQL_PORT = '1'
process.env.MYSQL_USER = 'test'
process.env.MYSQL_PASSWORD = 'test'
process.env.MYSQL_DATABASE = 'test'
process.env.AUTH_LOGIN_MAX_FAILURES = '3'
process.env.AUTH_LOGIN_LOCKOUT_SECONDS = '900'
process.env.AUTH_LOGIN_FAILURE_WINDOW_MINUTES = '1'
process.env.AUTH_IP_SEND_LIMIT = '2'
process.env.AUTH_IP_SEND_WINDOW_HOURS = '24'

const { handleAuthRoute, resetAuthRateLimitForTests } = await import('../auth.mjs')

const buildTools = () => {
  const responses = []
  const tools = {
    responses,
    json(res, statusCode, payload) {
      responses.push({ statusCode, payload })
      return payload
    },
    async parseJsonBody(req) {
      return req.body
    },
  }
  return tools
}

const buildReq = (path, body, remoteAddress = '203.0.113.70') => ({
  method: 'POST',
  url: path,
  body,
  headers: {},
  socket: { remoteAddress },
  connection: { remoteAddress },
})

const callAuth = async (tools, path, body, remoteAddress) => {
  const res = {}
  await handleAuthRoute(buildReq(path, body, remoteAddress), res, new URL(path, 'http://localhost'), tools)
  return tools.responses[tools.responses.length - 1]
}

test.beforeEach(() => {
  resetAuthRateLimitForTests()
})

test('H3: login locks the account after repeated failures', async () => {
  const tools = buildTools()

  for (let index = 0; index < 3; index += 1) {
    const response = await callAuth(tools, '/auth/login', {
      account: 'competition-admin',
      password: 'wrong-password',
    })
    assert.equal(response.statusCode, 401)
    assert.equal(response.payload.error.code, 'AUTH_INVALID')
  }

  const lockedResponse = await callAuth(tools, '/auth/login', {
    account: 'competition-admin',
    password: 'competition-memory-admin-2026',
  })

  assert.equal(lockedResponse.statusCode, 429)
  assert.equal(lockedResponse.payload.error.code, 'AUTH_LOGIN_LOCKED')
})

test('H3: a longer lockout is not shortened by the failure-count window', async (t) => {
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-01-01T00:00:00Z'),
  })
  const tools = buildTools()

  for (let index = 0; index < 3; index += 1) {
    await callAuth(tools, '/auth/login', {
      account: 'competition-admin',
      password: 'wrong-password',
    })
  }

  // 失败计数窗口已经过去，但 15 分钟的账号锁定仍应生效。
  t.mock.timers.tick(61_000)
  const stillLocked = await callAuth(tools, '/auth/login', {
    account: 'admin@example.test',
    password: 'competition-memory-admin-2026',
  })
  assert.equal(stillLocked.statusCode, 429)
  assert.equal(stillLocked.payload.error.code, 'AUTH_LOGIN_LOCKED')

  // 锁定时间到期后，同一用户可以通过邮箱别名正常登录。
  t.mock.timers.tick(840_000)
  const unlocked = await callAuth(tools, '/auth/login', {
    account: 'admin@example.test',
    password: 'competition-memory-admin-2026',
  })
  assert.equal(unlocked.statusCode, 200)
})

test('H3: login lockout only affects the failed account', async () => {
  const tools = buildTools()

  for (let index = 0; index < 3; index += 1) {
    await callAuth(tools, '/auth/login', {
      account: 'competition-admin',
      password: 'wrong-password',
    })
  }

  const otherAccount = await callAuth(tools, '/auth/login', {
    account: 'other-account',
    password: 'whatever-password',
  })

  // 其他账号未锁定，仍会进入正常认证流程并返回 AUTH_INVALID。
  assert.equal(otherAccount.statusCode, 401)
  assert.equal(otherAccount.payload.error.code, 'AUTH_INVALID')
})

test('H3: send-register-code is rate-limited per IP', async () => {
  const tools = buildTools()
  const ipAddress = '203.0.113.71'

  const first = await callAuth(
    tools,
    '/auth/send-register-code',
    { email: 'student-1@example.test' },
    ipAddress,
  )
  const second = await callAuth(
    tools,
    '/auth/send-register-code',
    { email: 'student-2@example.test' },
    ipAddress,
  )
  const third = await callAuth(
    tools,
    '/auth/send-register-code',
    { email: 'student-3@example.test' },
    ipAddress,
  )

  assert.equal(first.statusCode, 503)
  assert.equal(first.payload.error.code, 'AUTH_DATABASE_REQUIRED')
  assert.equal(second.statusCode, 503)
  assert.equal(second.payload.error.code, 'AUTH_DATABASE_REQUIRED')
  assert.equal(third.statusCode, 429)
  assert.equal(third.payload.error.code, 'AUTH_CODE_IP_RATE_LIMITED')
})
