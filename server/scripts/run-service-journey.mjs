import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import { resolve } from 'node:path'

const backendPort = Number.parseInt(process.env.JOURNEY_BACKEND_PORT || '3000', 10)
const previewPort = Number.parseInt(process.env.JOURNEY_PREVIEW_PORT || '4173', 10)
const rounds = Math.max(1, Number.parseInt(process.env.JOURNEY_ROUNDS || '10', 10))
const host = '127.0.0.1'
const root = process.cwd()

if (!existsSync(resolve(root, 'dist/index.html'))) {
  console.error('[service-journey-runner] dist/index.html is missing; run npm run build first')
  process.exit(1)
}

const assertPortAvailable = (port) =>
  new Promise((resolvePromise, reject) => {
    const server = net.createServer()
    server.once('error', () => reject(new Error(`port ${port} is already in use`)))
    server.listen(port, host, () => server.close(resolvePromise))
  })

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
const waitForUrl = async (url, timeoutMilliseconds = 15_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMilliseconds) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Child service is still starting.
    }
    await sleep(100)
  }
  throw new Error(`service did not become ready: ${url}`)
}

await assertPortAvailable(backendPort)
await assertPortAvailable(previewPort)

const adminAccount = 'service-journey-admin'
const adminPassword = `journey-${randomBytes(18).toString('base64url')}`
const childSecret = () => randomBytes(32).toString('base64url')
const commonEnv = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
const backend = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: {
    ...commonEnv,
    PORT: String(backendPort),
    HOST: host,
    LLM_PROVIDER_MODE: 'mock',
    LIGHTRAG_PRIMARY: 'false',
    TTS_PROVIDER: 'disabled',
    MYSQL_HOST: host,
    MYSQL_PORT: '1',
    MYSQL_USER: 'service-journey',
    MYSQL_PASSWORD: 'service-journey',
    MYSQL_DATABASE: 'service-journey',
    AUTH_ALLOW_MEMORY_FALLBACK: 'true',
    AUTH_DEFAULT_ADMIN_USERNAME: adminAccount,
    AUTH_DEFAULT_ADMIN_PASSWORD: adminPassword,
    AUTH_NOTIFY_EMAIL: 'service-journey-admin@example.test',
    AUTH_SESSION_SECRET: childSecret(),
    GUEST_COOKIE_SECRET: childSecret(),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})
const preview = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', host, '--port', String(previewPort)],
  {
    cwd: root,
    env: { ...commonEnv, VITE_LOCAL_API_TARGET: `http://${host}:${backendPort}` },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  },
)

const logs = []
const capture = (label, stream) => {
  stream?.on('data', (chunk) => {
    logs.push(`[${label}] ${String(chunk)}`)
    if (logs.length > 80) logs.shift()
  })
}
capture('backend', backend.stdout)
capture('backend-error', backend.stderr)
capture('preview', preview.stdout)
capture('preview-error', preview.stderr)

const stopChild = async (child) => {
  if (!child || child.exitCode !== null) return
  child.kill()
  const stopped = await Promise.race([
    new Promise((resolvePromise) => child.once('exit', () => resolvePromise(true))),
    sleep(2_000).then(() => false),
  ])
  if (!stopped && child.exitCode === null) child.kill('SIGKILL')
}

try {
  await Promise.all([
    waitForUrl(`http://${host}:${backendPort}/health`),
    waitForUrl(`http://${host}:${previewPort}`),
  ])

  const journey = spawn(process.execPath, ['server/scripts/service-journey-browser.mjs'], {
    cwd: root,
    env: {
      ...commonEnv,
      JOURNEY_TARGET_URL: `http://${host}:${previewPort}`,
      JOURNEY_ADMIN_ACCOUNT: adminAccount,
      JOURNEY_ADMIN_PASSWORD: adminPassword,
      JOURNEY_ROUNDS: String(rounds),
      JOURNEY_RESULT_PATH: resolve(root, 'server/evals/latest-service-journey.json'),
      JOURNEY_PROFILE: 'isolated_mock',
      JOURNEY_LLM_MODE: 'mock',
      JOURNEY_LIGHTRAG_MODE: 'disabled',
      JOURNEY_TTS_MODE: 'disabled',
      JOURNEY_MYSQL_MODE: 'offline_memory_auth',
    },
    stdio: 'inherit',
    windowsHide: true,
  })
  const exitCode = await new Promise((resolvePromise) => journey.once('exit', resolvePromise))
  if (exitCode !== 0) throw new Error(`service journey exited with code ${exitCode}`)
} catch (error) {
  console.error(`[service-journey-runner] ${error.message}`)
  if (logs.length > 0) console.error(logs.join(''))
  process.exitCode = 1
} finally {
  await Promise.all([stopChild(preview), stopChild(backend)])
}
