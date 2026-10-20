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

const readNdjson = async (response) =>
  (await response.text())
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))

test('chat uses a safe response for weak retrieval candidates while retaining strong matches', async (t) => {
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
      RAG_ROUTE_MIN_SCORE: '0',
      RAG_ANSWER_MIN_SCORE: '3',
      RAG_VECTOR_ENABLED: 'false',
      RAG_LOG_ENABLED: 'false',
      MYSQL_PORT: '1',
      AUTH_SESSION_SECRET: 'rag-low-confidence-session-secret-32-chars',
      GUEST_COOKIE_SECRET: 'rag-low-confidence-guest-secret-32-chars',
      GUEST_IP_CHAT_LIMIT: '10',
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

  const send = (path, question) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: question }] }),
    })

  try {
    await waitForHealth(baseUrl, child)

    const weakResponse = await send('/chat', '校园网密码怎么改？')
    assert.equal(weakResponse.status, 200)
    const weakPayload = await weakResponse.json()
    assert.match(weakPayload.content, /没有检索到.*足够匹配/)
    assert.match(weakPayload.content, /最新通知为准/)
    assert.deepEqual(weakPayload.sources, [])
    assert.doesNotMatch(weakPayload.content, /Mock 回复/)

    const weakStreamResponse = await send('/chat/stream', '校园网密码怎么改？')
    assert.equal(weakStreamResponse.status, 200)
    const weakEvents = await readNdjson(weakStreamResponse)
    assert.deepEqual(
      weakEvents.map((event) => event.type),
      ['start', 'delta', 'meta', 'done'],
    )
    const weakMeta = weakEvents.find((event) => event.type === 'meta')
    assert.match(weakMeta.content, /没有检索到.*足够匹配/)
    assert.deepEqual(weakMeta.sources, [])

    const strongResponse = await send('/chat', '补考怎么报名？')
    assert.equal(strongResponse.status, 200)
    const strongPayload = await strongResponse.json()
    assert.doesNotMatch(strongPayload.content, /没有检索到.*足够匹配/)
    assert.ok(strongPayload.sources.length > 0)
    assert.match(strongPayload.sources[0].title, /第二学期补考、成绩录入和毕业审核安排/)
  } catch (error) {
    throw new Error(`${error.message}\nbackend output:\n${output}`)
  }
})
