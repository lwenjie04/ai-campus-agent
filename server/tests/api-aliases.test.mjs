import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { test } from 'node:test'

const sessionSecret = 'api-alias-contract-test-secret-at-least-32-chars'
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
      // The server may still be starting.
    }
    await sleep(100)
  }
  throw new Error('backend /api/health check timed out')
}

const parseNdjson = async (response) =>
  (await response.text())
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))

test('V2 /api aliases preserve health, chat stream, login, and download authorization contracts', async (t) => {
  const port = 36_000 + Math.floor(Math.random() * 2_000)
  const baseUrl = `http://127.0.0.1:${port}`
  const adminPassword = 'api-alias-test-admin-password-2026'
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
      MYSQL_USER: 'api-alias-test',
      MYSQL_PASSWORD: 'api-alias-test',
      MYSQL_DATABASE: 'api_alias_test',
      AUTH_ALLOW_MEMORY_FALLBACK: 'true',
      AUTH_DEFAULT_ADMIN_USERNAME: 'api-alias-admin',
      AUTH_DEFAULT_ADMIN_PASSWORD: adminPassword,
      AUTH_NOTIFY_EMAIL: 'api-alias-admin@example.test',
      AUTH_SESSION_SECRET: sessionSecret,
      GUEST_COOKIE_SECRET: 'api-alias-guest-secret-at-least-32-chars',
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

    const healthResponse = await fetch(`${baseUrl}/api/health`)
    assert.equal(healthResponse.status, 200)
    assert.equal((await healthResponse.json()).ok, true)

    const chatResponse = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: '你好' }],
      }),
    })
    assert.equal(chatResponse.status, 200)
    assert.match(chatResponse.headers.get('content-type') || '', /application\/x-ndjson/)
    const events = await parseNdjson(chatResponse)
    assert.equal(events[0]?.type, 'start')
    assert.ok(events.some((event) => event.type === 'delta'))
    assert.equal(events.at(-1)?.type, 'done')
    assert.ok(events[0]?.requestId)

    const anonymousDownload = await fetch(`${baseUrl}/api/kb/download?id=not-a-real-file`)
    assert.equal(anonymousDownload.status, 401)

    const userToken = issueSessionToken({
      id: 'api-alias-student',
      username: 'student@example.test',
      displayName: '测试同学',
      role: 'user',
    }).accessToken
    const forbiddenDownload = await fetch(`${baseUrl}/api/kb/download?id=not-a-real-file`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    assert.equal(forbiddenDownload.status, 403)

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: 'api-alias-admin', password: adminPassword }),
    })
    assert.equal(loginResponse.status, 200)
    const loginBody = await loginResponse.json()
    assert.equal(loginBody?.data?.user?.role, 'admin')
    assert.ok(loginBody?.data?.accessToken)
  } catch (error) {
    throw new Error(`${error.message}\nbackend output:\n${output}`)
  }
})
