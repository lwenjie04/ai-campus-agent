import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'

const sessionSecret = 'api-preview-check-session-secret-at-least-32-chars'
process.env.AUTH_SESSION_SECRET = sessionSecret
const { issueSessionToken } = await import('../session.mjs')

const freePort = async () => {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  return port
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const startProcess = (args, env) => {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  child.output = ''
  child.stdout.on('data', (chunk) => {
    child.output += String(chunk)
  })
  child.stderr.on('data', (chunk) => {
    child.output += String(chunk)
  })
  return child
}

const waitFor = async (url, child, timeoutMilliseconds = 15_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMilliseconds) {
    if (child.exitCode !== null) throw new Error(`process exited early with code ${child.exitCode}`)
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch {
      // The service may still be starting.
    }
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${url}`)
}

const stopProcess = async (child) => {
  if (child.exitCode !== null) return
  child.kill()
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(2_000),
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

const readNdjson = async (response) => {
  const events = []
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  while (true) {
    const { done, value } = await reader.read()
    pending += decoder.decode(value, { stream: !done })
    const lines = pending.split(/\r?\n/)
    pending = lines.pop() || ''
    for (const line of lines) {
      if (line) events.push(JSON.parse(line))
    }
    if (done) break
  }
  if (pending) events.push(JSON.parse(pending))
  return events
}

if (!existsSync('dist/index.html')) {
  throw new Error('dist/index.html is missing; run npm run build before preview verification')
}

const backendPort = await freePort()
const previewPort = await freePort()
const backendUrl = `http://127.0.0.1:${backendPort}`
const previewUrl = `http://127.0.0.1:${previewPort}`
const adminPassword = 'api-preview-check-admin-password-2026'
const backend = startProcess(['server/index.mjs'], {
  PORT: String(backendPort),
  HOST: '127.0.0.1',
  LLM_PROVIDER_MODE: 'mock',
  LIGHTRAG_PRIMARY: 'false',
  MYSQL_HOST: '127.0.0.1',
  MYSQL_PORT: '1',
  MYSQL_USER: 'api-preview-check',
  MYSQL_PASSWORD: 'api-preview-check',
  MYSQL_DATABASE: 'api_preview_check',
  AUTH_ALLOW_MEMORY_FALLBACK: 'true',
  AUTH_DEFAULT_ADMIN_USERNAME: 'api-preview-admin',
  AUTH_DEFAULT_ADMIN_PASSWORD: adminPassword,
  AUTH_NOTIFY_EMAIL: 'api-preview-admin@example.test',
  AUTH_SESSION_SECRET: sessionSecret,
  GUEST_COOKIE_SECRET: 'api-preview-check-guest-secret-at-least-32-chars',
})
let preview

try {
  await waitFor(`${backendUrl}/api/health`, backend)
  preview = startProcess(['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'], {
    VITE_LOCAL_API_TARGET: backendUrl,
  })
  const home = await waitFor(previewUrl, preview)
  assert.match(home.headers.get('content-type') || '', /text\/html/)

  const deepLink = await fetch(`${previewUrl}/chat/new`)
  assert.equal(deepLink.status, 200)
  assert.match(deepLink.headers.get('content-type') || '', /text\/html/)

  const streamResponse = await fetch(`${previewUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: '你好' }] }),
  })
  assert.equal(streamResponse.status, 200)
  assert.match(streamResponse.headers.get('content-type') || '', /application\/x-ndjson/)
  assert.equal(streamResponse.headers.get('cache-control'), 'no-cache, no-transform')
  const events = await readNdjson(streamResponse)
  assert.equal(events[0]?.type, 'start')
  assert.ok(events.some((event) => event.type === 'delta'))
  assert.equal(events.at(-1)?.type, 'done')

  const anonymousDownload = await fetch(`${previewUrl}/api/kb/download?id=not-a-real-file`)
  assert.equal(anonymousDownload.status, 401)
  const studentToken = issueSessionToken({
    id: 'api-preview-student',
    username: 'student@example.test',
    displayName: '测试同学',
    role: 'user',
  }).accessToken
  const forbiddenDownload = await fetch(`${previewUrl}/api/kb/download?id=not-a-real-file`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  })
  assert.equal(forbiddenDownload.status, 403)

  const loginResponse = await fetch(`${previewUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: 'api-preview-admin', password: adminPassword }),
  })
  assert.equal(loginResponse.status, 200)
  const loginBody = await loginResponse.json()
  assert.equal(loginBody?.data?.user?.role, 'admin')
  assert.ok(loginBody?.data?.accessToken)
  console.log('preview API checks passed: SPA deep link, NDJSON stream, download 401/403, proxied login 200')
} catch (error) {
  throw new Error(
    `${error.message}\nbackend output:\n${backend.output}\npreview output:\n${preview?.output || '(not started)'}`,
  )
} finally {
  if (preview) await stopProcess(preview)
  await stopProcess(backend)
}
