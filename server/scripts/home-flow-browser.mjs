import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// 2.2 浏览器冒烟：首页 hero、公共导航、关于校答面板、办事指南入口、
// “开始提问”只进入 /chat/new 并聚焦输入框，且不提前创建历史会话。
const targetUrl = (process.env.HOME_TARGET_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')
const resultPath = String(process.env.HOME_RESULT_PATH || 'server/evals/latest-home-flow.json').trim()

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
].filter(Boolean)
const chromePath = chromeCandidates.find((candidate) => existsSync(candidate))
if (!chromePath) {
  console.error('[home-flow] Chrome not found. Set CHROME_PATH and retry.')
  process.exit(1)
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const waitFor = async (check, label, timeoutMilliseconds = 20_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMilliseconds) {
    const value = await check().catch(() => undefined)
    if (value) return value
    await sleep(120)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

const steps = []
const record = (name, detail) => {
  steps.push({ name, ok: true, detail })
  console.log(`[home-flow] PASS ${name}`)
}

const profilePath = await mkdtemp(path.join(tmpdir(), 'campus-home-flow-'))
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profilePath}`,
    '--window-size=1440,900',
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true },
)

const sendCommand = (socket, id, method, params = {}) =>
  new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = JSON.parse(String(event.data))
      if (message.id !== id) return
      socket.removeEventListener('message', onMessage)
      if (message.error) reject(new Error(message.error.message || `${method} failed`))
      else resolve(message.result)
    }
    socket.addEventListener('message', onMessage)
    socket.send(JSON.stringify({ id, method, params }))
  })

let socket
let failed = false

try {
  const activePortPath = path.join(profilePath, 'DevToolsActivePort')
  const activePort = await waitFor(async () => {
    if (!existsSync(activePortPath)) return undefined
    const [port] = (await readFile(activePortPath, 'utf8')).trim().split(/\r?\n/)
    return port
  }, 'Chrome DevTools port')

  const pages = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${activePort}/json/list`)
    if (!response.ok) return undefined
    return (await response.json()).filter((target) => target.type === 'page')
  }, 'Chrome page target')

  socket = new WebSocket(pages[0].webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let commandId = 0
  const command = (method, params) => sendCommand(socket, ++commandId, method, params)
  const evaluate = async (expression) => {
    const result = await command('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (result.exceptionDetails) {
      const description =
        result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed'
      throw new Error(`evaluate failed: ${description}`)
    }
    return result.result.value
  }
  const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  const pathname = () => evaluate('location.pathname')
  const go = async (url) => {
    await command('Page.navigate', { url })
    await waitFor(async () => evaluate('document.readyState === "complete"'), `load ${url}`)
  }

  await command('Page.enable')
  await command('Runtime.enable')

  await go(`${targetUrl}/`)
  await waitFor(
    async () => evaluate(`Boolean(document.querySelector('.hero__title'))`),
    'home hero',
  )

  const hero = await evaluate(`document.querySelector('.hero__title').textContent.trim()`)
  if (hero !== '校园智能问答') throw new Error(`unexpected hero: ${hero}`)
  record('首页 hero 渲染', hero)

  const navLabels = await evaluate(
    `[...document.querySelectorAll('.top-nav__tab')].map((item) => item.textContent.trim())`,
  )
  for (const label of ['智能问答', '校园社区', '办事指南', '关于校答']) {
    if (!navLabels.includes(label)) throw new Error(`missing nav item: ${label}`)
  }
  record('公共导航完整', navLabels.join(' / '))

  await click('[data-testid="nav-about"]')
  await waitFor(
    async () => evaluate(`(() => {
      const dialog = document.querySelector('.help-dialog')
      return Boolean(dialog) && dialog.offsetParent !== null
    })()`),
    'help dialog',
  )
  const helpTitle = await evaluate(`document.querySelector('.help-dialog .help-head h2').textContent.trim()`)
  if (helpTitle !== '关于校答') throw new Error(`unexpected help title: ${helpTitle}`)
  record('关于校答面板可打开', helpTitle)
  await click('.help-dialog .el-dialog__footer .el-button')
  await waitFor(
    async () => evaluate(`(() => {
      const dialog = document.querySelector('.help-dialog')
      return !dialog || dialog.offsetParent === null
    })()`),
    'help dialog closed',
  )

  await click('[data-testid="nav-services"]')
  await waitFor(async () => (await pathname()) === '/services', 'services route')
  const servicesTitle = await evaluate(`document.querySelector('.services-head h1').textContent.trim()`)
  if (servicesTitle !== '办事指南') throw new Error(`unexpected services title: ${servicesTitle}`)
  record('办事指南入口', '/services')

  await go(`${targetUrl}/`)
  await waitFor(
    async () => evaluate(`Boolean(document.querySelector('.hero__cta'))`),
    'home cta',
  )
  await click('.hero__cta')
  await waitFor(async () => (await pathname()) === '/chat/new', 'chat-new route')
  const focused = await waitFor(
    async () =>
      evaluate(`(() => {
        const active = document.activeElement
        return Boolean(active) && active.tagName === 'INPUT' && (active.placeholder || '').includes('描述')
      })()`),
    'chat input focused',
  )
  if (!focused) throw new Error('chat input was not focused')
  record('开始提问只进入 /chat/new 并聚焦输入框', '/chat/new')

  const historyCount = await evaluate(`(() => {
    const raw = localStorage.getItem('ai-campus-agent.conversations.v1.index')
    if (!raw) return 0
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.items) ? parsed.items.length : Array.isArray(parsed) ? parsed.length : 0
  })()`)
  if (historyCount !== 0) throw new Error(`unexpected history entries: ${historyCount}`)
  record('未发送前不创建历史会话', `history=${historyCount}`)

  const result = {
    version: 1,
    completedAt: new Date().toISOString(),
    mode: 'isolated_browser',
    targetUrl,
    ok: true,
    steps,
  }
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(`[home-flow] PASS ${steps.length} steps`)
} catch (error) {
  failed = true
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[home-flow] FAIL ${message}`)
  try {
    await writeFile(
      resultPath,
      `${JSON.stringify(
        {
          version: 1,
          completedAt: new Date().toISOString(),
          mode: 'isolated_browser',
          targetUrl,
          ok: false,
          steps: [...steps, { name: 'journey', ok: false, detail: message }],
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
  } catch {
    // ignore
  }
} finally {
  try {
    socket?.close()
  } catch {
    // ignore
  }
  chrome.kill('SIGKILL')
  await rm(profilePath, { recursive: true, force: true }).catch(() => {})
}

process.exit(failed ? 1 : 0)
