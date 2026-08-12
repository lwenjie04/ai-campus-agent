import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { test } from 'node:test'

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const waitForHealth = async (baseUrl, child, timeoutMilliseconds = 10_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMilliseconds) {
    if (child.exitCode !== null) throw new Error(`backend exited early with code ${child.exitCode}`)
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok) return
    } catch {
      // Server is still starting.
    }
    await sleep(100)
  }
  throw new Error('backend health check timed out')
}

test('explicit memory auth fallback keeps strong admin login available when MySQL is offline', async (t) => {
  const port = 39_000 + Math.floor(Math.random() * 2_000)
  const baseUrl = `http://127.0.0.1:${port}`
  const adminPassword = 'competition-memory-admin-2026'
  let output = ''
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      MYSQL_HOST: '127.0.0.1',
      MYSQL_PORT: '1',
      MYSQL_USER: 'competition-test',
      MYSQL_PASSWORD: 'competition-test',
      MYSQL_DATABASE: 'competition-test',
      AUTH_ALLOW_MEMORY_FALLBACK: 'true',
      AUTH_DEFAULT_ADMIN_USERNAME: 'competition-admin',
      AUTH_DEFAULT_ADMIN_PASSWORD: adminPassword,
      AUTH_NOTIFY_EMAIL: 'competition-admin@example.test',
      AUTH_SESSION_SECRET: 'competition-test-session-secret-32-chars',
      GUEST_COOKIE_SECRET: 'competition-test-guest-secret-32-chars',
      LIGHTRAG_PRIMARY: 'false',
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
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: 'competition-admin', password: adminPassword }),
    })
    assert.equal(loginResponse.status, 200)
    const loginBody = await loginResponse.json()
    assert.equal(loginBody?.data?.user?.role, 'admin')
    assert.ok(loginBody?.data?.accessToken)

    const reviewResponse = await fetch(`${baseUrl}/community/review/posts`, {
      headers: { Authorization: `Bearer ${loginBody.data.accessToken}` },
    })
    assert.equal(reviewResponse.status, 200, 'memory administrator should retain protected review access')

    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: '测试用户',
        email: 'student@example.test',
        verifyCode: '000000',
        password: 'student-password',
        confirmPassword: 'student-password',
      }),
    })
    assert.equal(registerResponse.status, 503, 'registration must stay disabled in memory fallback mode')
  } catch (error) {
    throw new Error(`${error.message}\nbackend output:\n${output}`)
  }
})
