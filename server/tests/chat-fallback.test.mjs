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
      // The server may still be starting.
    }
    await sleep(100)
  }
  throw new Error('backend health check timed out')
}

const readNdjson = async (response) => {
  const text = await response.text()
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

test('model network failure preserves official sources and rolls back guest quota', async (t) => {
  const port = 34_000 + Math.floor(Math.random() * 5_000)
  const baseUrl = `http://127.0.0.1:${port}`
  let output = ''
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      LLM_API_KEY: 'competition-fallback-test',
      LLM_API_BASE_URL: 'http://127.0.0.1:9',
      LIGHTRAG_PRIMARY: 'false',
      AUTH_SESSION_SECRET: 'competition-test-session-secret-32-chars',
      GUEST_COOKIE_SECRET: 'competition-test-guest-secret-32-chars',
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

    const sendQuestion = (cookie) =>
      fetch(`${baseUrl}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '补考什么时候报名，需要什么手续？' }],
        }),
      })

    const firstResponse = await sendQuestion()
    assert.equal(firstResponse.status, 200)
    const cookie = firstResponse.headers.get('set-cookie')?.split(';')[0]
    assert.ok(cookie, 'guest cookie should be issued')

    const firstEvents = await readNdjson(firstResponse)
    const firstError = firstEvents.find((event) => event.type === 'error')
    assert.equal(firstError?.error?.code, 'LLM_NETWORK_ERROR')
    assert.equal(firstError?.error?.quotaConsumed, false)
    assert.match(firstError?.error?.message || '', /未生成答案/)
    assert.ok(firstError?.error?.sources?.length > 0, 'retrieved official sources should remain visible')

    const retryResponse = await sendQuestion(cookie)
    assert.equal(retryResponse.status, 200, 'failed generation must not consume the one guest attempt')
    const retryEvents = await readNdjson(retryResponse)
    assert.equal(retryEvents.find((event) => event.type === 'error')?.error?.code, 'LLM_NETWORK_ERROR')
  } catch (error) {
    throw new Error(`${error.message}\nbackend output:\n${output}`)
  }
})
