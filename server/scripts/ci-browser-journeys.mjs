import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = process.cwd()
const host = '127.0.0.1'
const backendPort = 3000
const previewPort = 4176
const baseUrl = `http://${host}:${previewPort}`
const backendUrl = `http://${host}:${backendPort}`
const chromePath = process.env.CHROME_PATH

if (!existsSync(resolve(root, 'dist/index.html'))) {
  throw new Error('dist/index.html is missing; the browser-journeys job must build before running')
}
if (!chromePath || !existsSync(chromePath)) {
  throw new Error('CHROME_PATH must point to the Chrome executable installed by CI')
}

const adminAccount = `ci-admin-${randomBytes(8).toString('hex')}`
const adminPassword = randomBytes(24).toString('hex')
const commonEnv = {
  ...process.env,
  CI: 'true',
  MYSQL_PORT: '1',
  AUTH_ALLOW_MEMORY_FALLBACK: 'true',
  LLM_PROVIDER_MODE: 'mock',
  LIGHTRAG_PRIMARY: 'false',
  RAG_VECTOR_ENABLED: 'false',
  TTS_PROVIDER: 'disabled',
  FEEDBACK_TEST_MEMORY: 'true',
  CORS_ORIGIN: baseUrl,
  CHROME_PATH: chromePath,
  JOURNEY_ADMIN_ACCOUNT: adminAccount,
  JOURNEY_ADMIN_PASSWORD: adminPassword,
  AUTH_DEFAULT_ADMIN_USERNAME: adminAccount,
  AUTH_DEFAULT_ADMIN_PASSWORD: adminPassword,
  AUTH_SESSION_SECRET: randomBytes(32).toString('hex'),
  GUEST_COOKIE_SECRET: randomBytes(32).toString('hex'),
}

const journeySpecs = [
  {
    name: 'admin:journey',
    script: 'server/scripts/admin-journey-browser.mjs',
    result: 'server/evals/ci/latest-admin-journey.json',
    resultEnv: 'ADMIN_RESULT_PATH',
    env: { ADMIN_TARGET_URL: baseUrl },
    shotEnv: { ADMIN_SHOT_DIR: 'docs/design/verify/ci/admin' },
    requiredSteps: [
      { name: '只重试生成，不重复 approve', detail: 'approve=1 generate=2' },
      { name: '无权限 URL 与接口拒绝', detail: 'api=401' },
    ],
  },
  {
    name: 'community:journey',
    script: 'server/scripts/community-journey-browser.mjs',
    result: 'server/evals/ci/latest-community-journey.json',
    resultEnv: 'COMMUNITY_RESULT_PATH',
    env: { COMMUNITY_TARGET_URL: baseUrl },
    shotEnv: { COMMUNITY_SHOT_DIR: 'docs/design/verify/ci/community' },
    requiredSteps: [{ name: '投稿提交与防重复', detail: 'POST=1' }],
  },
  {
    name: 'regression:journey',
    script: 'server/scripts/regression-journey-browser.mjs',
    result: 'server/evals/ci/latest-regression-journey.json',
    resultEnv: 'REGRESSION_RESULT_PATH',
    env: { REGRESSION_TARGET_URL: baseUrl },
    shotEnv: { REGRESSION_SHOT_DIR: 'docs/design/verify/ci/regression' },
    requiredSteps: [{ name: '回答反馈 helpful 已记录' }, { name: '过期登录隔离' }],
  },
  {
    name: 'closed-loop:journey',
    script: 'server/scripts/closed-loop-journey-browser.mjs',
    result: 'server/evals/ci/latest-closed-loop-journey.json',
    resultEnv: 'CLOSED_LOOP_RESULT_PATH',
    env: { CLOSED_LOOP_TARGET_URL: baseUrl },
    shotEnv: { CLOSED_LOOP_SHOT_DIR: 'docs/design/verify/ci/closed-loop' },
    requiredSteps: [
      { name: '问答返回社区来源' },
      { name: '来源回链到帖子详情' },
      { name: '普通账号越权被拒', detail: 'api=403' },
    ],
  },
  {
    name: 'home:journey',
    script: 'server/scripts/home-flow-browser.mjs',
    result: 'server/evals/ci/latest-home-flow.json',
    resultEnv: 'HOME_RESULT_PATH',
    env: { HOME_TARGET_URL: baseUrl },
    requiredSteps: [{ name: '未发送前不创建历史会话' }],
  },
  {
    name: 'chat:layout',
    script: 'server/scripts/chat-layout-browser.mjs',
    result: 'server/evals/ci/latest-chat-layout.json',
    resultEnv: 'CHAT_RESULT_PATH',
    env: { CHAT_TARGET_URL: baseUrl },
    shotEnv: { CHAT_SHOT_DIR: 'docs/design/verify/ci/chat-layout' },
    requiredSteps: [{ name: '来源栏展示当前回答来源' }, { name: '推荐问题只预填并聚焦' }],
  },
  {
    name: 'chat:stream',
    script: 'server/scripts/chat-stream-browser.mjs',
    result: 'server/evals/ci/latest-chat-stream.json',
    resultEnv: 'STREAM_RESULT_PATH',
    env: { STREAM_TARGET_URL: baseUrl },
    shotEnv: { STREAM_SHOT_DIR: 'docs/design/verify/ci/chat-stream' },
    requiredSteps: [{ name: '桌面真实流式回答' }, { name: '手机 390 真实流式回答' }],
  },
  {
    name: 'responsive:matrix',
    script: 'server/scripts/responsive-matrix.mjs',
    result: 'server/evals/ci/latest-responsive-matrix.json',
    resultEnv: 'RESPONSIVE_MATRIX_RESULT',
    env: { RESPONSIVE_BASE_URL: baseUrl },
    shotEnv: { RESPONSIVE_SHOT_DIR: 'docs/design/verify/ci/responsive' },
    validate(report) {
      assert.ok(Array.isArray(report.results) && report.results.length > 0)
      assert.ok(report.results.every((result) => result.ok === true))
    },
  },
]

const processLogs = []
const capture = (label, stream) => {
  stream?.on('data', (chunk) => {
    processLogs.push(`[${label}] ${String(chunk)}`)
    if (processLogs.length > 120) processLogs.shift()
  })
}

const startService = (label, command, args, env) => {
  const child = spawn(command, args, {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  capture(label, child.stdout)
  capture(`${label}-error`, child.stderr)
  child.on('error', (error) => {
    processLogs.push(`[${label}-spawn-error] ${error.message}`)
  })
  return child
}

const waitForUrl = async (url, services, timeoutMs = 60_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    for (const [label, child] of services) {
      if (child.exitCode !== null) {
        throw new Error(`${label} exited before becoming ready (exit ${child.exitCode})`)
      }
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Wait for the local service to finish starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  }
  throw new Error(`service did not become ready: ${url}`)
}

const stopService = async (child) => {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  const exited = await Promise.race([
    new Promise((resolvePromise) => child.once('exit', () => resolvePromise(true))),
    new Promise((resolvePromise) => setTimeout(() => resolvePromise(false), 4_000)),
  ])
  if (!exited && child.exitCode === null) child.kill('SIGKILL')
}

const runJourney = async (journey) => {
  const resultPath = resolve(root, journey.result)
  await rm(resultPath, { force: true })
  for (const directory of Object.values(journey.shotEnv || {})) {
    await mkdir(resolve(root, directory), { recursive: true })
  }
  console.log(`[ci-browser-journeys] ${journey.name}`)
  const child = spawn(process.execPath, [journey.script], {
    cwd: root,
    env: {
      ...commonEnv,
      ...journey.env,
      ...journey.shotEnv,
      [journey.resultEnv]: journey.result,
    },
    stdio: 'inherit',
    windowsHide: true,
  })
  const exitCode = await new Promise((resolvePromise, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolvePromise(code ?? 1))
  })
  assert.equal(exitCode, 0, `${journey.name} exited with code ${exitCode}`)

  const report = JSON.parse(await readFile(resultPath, 'utf8'))
  assert.equal(report.ok, true, `${journey.name} report must have ok === true`)
  if (Array.isArray(report.steps)) {
    assert.ok(
      report.steps.every((step) => step.ok === true),
      `${journey.name} has failed steps`,
    )
    for (const required of journey.requiredSteps || []) {
      const step = report.steps.find((item) => item.name.includes(required.name))
      assert.ok(step, `${journey.name} is missing assertion ${required.name}`)
      if (required.detail) {
        assert.ok(
          String(step.detail).includes(required.detail),
          `${journey.name} assertion ${required.name} is missing ${required.detail}`,
        )
      }
    }
  }
  journey.validate?.(report)
  console.log(
    `[ci-browser-journeys] ${journey.name}: ok (${report.steps?.length ?? report.results.length})`,
  )
}

if (!process.env.CI) throw new Error('ci-browser-journeys.mjs must only run in CI')

await rm(resolve(root, 'server/evals/ci'), { recursive: true, force: true })
await rm(resolve(root, 'docs/design/verify/ci'), { recursive: true, force: true })
await mkdir(resolve(root, 'server/evals/ci'), { recursive: true })
await mkdir(resolve(root, 'docs/design/verify/ci'), { recursive: true })

const backend = startService('backend', process.execPath, ['server/index.mjs'], {
  ...commonEnv,
  HOST: host,
  PORT: String(backendPort),
})
const preview = startService(
  'preview',
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    host,
    '--port',
    String(previewPort),
    '--strictPort',
  ],
  { ...commonEnv, VITE_LOCAL_API_TARGET: backendUrl },
)

try {
  await Promise.all([
    waitForUrl(`${backendUrl}/health`, [
      ['backend', backend],
      ['preview', preview],
    ]),
    waitForUrl(baseUrl, [
      ['backend', backend],
      ['preview', preview],
    ]),
  ])

  for (const journey of journeySpecs) await runJourney(journey)
} catch (error) {
  console.error(`[ci-browser-journeys] ${error.message}`)
  if (processLogs.length) console.error(processLogs.join(''))
  process.exitCode = 1
} finally {
  await Promise.all([stopService(preview), stopService(backend)])
}
