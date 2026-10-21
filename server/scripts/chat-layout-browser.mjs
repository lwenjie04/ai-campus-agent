import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// 2.3 浏览器检查：问答阅读布局、来源栏、消息操作、390 来源入口与固定输入区。
const targetUrl = (process.env.CHAT_TARGET_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')
const resultPath = String(process.env.CHAT_RESULT_PATH || 'server/evals/latest-chat-layout.json').trim()
const shotDir = String(process.env.CHAT_SHOT_DIR || 'docs/design/verify').trim()

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
].filter(Boolean)
const chromePath = chromeCandidates.find((candidate) => existsSync(candidate))
if (!chromePath) {
  console.error('[chat-layout] Chrome not found. Set CHROME_PATH and retry.')
  process.exit(1)
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const waitFor = async (check, label, timeoutMilliseconds = 20_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMilliseconds) {
    const value = await check().catch(() => undefined)
    if (value) return value
    await sleep(150)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

const steps = []
const record = (name, detail) => {
  steps.push({ name, ok: true, detail })
  console.log(`[chat-layout] PASS ${name}`)
}

const profilePath = await mkdtemp(path.join(tmpdir(), 'campus-chat-layout-'))
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
  const screenshot = async (name) => {
    const { data } = await command('Page.captureScreenshot', { format: 'png' })
    await writeFile(path.join(shotDir, name), Buffer.from(data, 'base64'))
  }

  await command('Page.enable')
  await command('Runtime.enable')
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  await command('Page.navigate', { url: `${targetUrl}/chat/new` })
  await waitFor(async () => evaluate('document.readyState === "complete"'), 'chat page load')
  await waitFor(
    async () => evaluate(`Boolean(document.querySelector('.input-box input'))`),
    'chat composer',
  )
  record('问答页渲染', '/chat/new')

  const railVisible = await evaluate(`(() => {
    const rail = document.querySelector('.source-rail')
    return Boolean(rail) && rail.offsetParent !== null
  })()`)
  const composerInViewport = await evaluate(`(() => {
    const composer = document.querySelector('.composer')
    if (!composer) return false
    const rect = composer.getBoundingClientRect()
    return rect.top >= 0 && rect.bottom <= window.innerHeight + 1
  })()`)
  if (!railVisible || !composerInViewport) {
    throw new Error(`desktop layout missing rail=${railVisible} composer=${composerInViewport}`)
  }
  record('桌面阅读区 + 来源栏 + 底部输入区', 'rail + composer in viewport')

  // 用前端 Mock 发一条能命中来源的示例问题（构建需 VITE_USE_MOCK_CHAT=true）。
  await evaluate(`document.querySelector('.input-box input').focus()`)
  await command('Input.insertText', { text: '选课在哪里查课表？' })
  await sleep(300)
  await evaluate(`document.querySelector('.send-btn').click()`)

  await waitFor(
    async () =>
      evaluate(`(() => {
        const rows = document.querySelectorAll('[data-role="assistant"]')
        const last = rows[rows.length - 1]
        const text = last?.querySelector('[data-testid="message-bubble"]')?.textContent || ''
        return text.length > 20 && !document.querySelector('[data-testid="loading-indicator"]')
      })()`),
    'assistant answer',
  )
  await waitFor(
    async () => evaluate(`document.querySelectorAll('.source-rail .rail-source').length > 0`),
    'source rail cards',
  )
  const railCards = await evaluate(`document.querySelectorAll('.source-rail .rail-source').length`)
  record('来源栏展示当前回答来源', `cards=${railCards}`)

  const actions = await evaluate(
    `[...document.querySelectorAll('.message-actions .action-btn')].map((item) => item.textContent.trim())`,
  )
  if (!actions.includes('复制') || !actions.includes('朗读')) {
    throw new Error(`message actions missing: ${actions.join(',')}`)
  }
  record('消息操作：复制/朗读', actions.join(' / '))

  await screenshot('chat-answer-1440.png')

  // 手机宽度：来源栏隐藏，消息内出现“查看 N 份官方来源”，点击打开来源面板。
  await command('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await sleep(400)
  const mobileRailHidden = await evaluate(`(() => {
    const rail = document.querySelector('.source-rail')
    return !rail || rail.offsetParent === null
  })()`)
  const hintVisible = await evaluate(`(() => {
    const hint = document.querySelector('.message-actions .source-hint')
    return Boolean(hint) && hint.offsetParent !== null
  })()`)
  if (!mobileRailHidden || !hintVisible) {
    throw new Error(`mobile source entry missing railHidden=${mobileRailHidden} hint=${hintVisible}`)
  }
  await evaluate(`document.querySelector('.message-actions .source-hint').click()`)
  await waitFor(
    async () => evaluate(`(() => {
      const sheet = document.querySelector('.source-sheet')
      if (!sheet) return false
      const rect = sheet.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })()`),
    'source sheet',
  )
  record('手机来源入口与面板', 'source-hint → source-sheet')
  await screenshot('chat-sources-390.png')

  const result = {
    version: 1,
    completedAt: new Date().toISOString(),
    mode: 'isolated_frontend_mock',
    targetUrl,
    ok: true,
    steps,
  }
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(`[chat-layout] PASS ${steps.length} steps`)
} catch (error) {
  failed = true
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[chat-layout] FAIL ${message}`)
  try {
    await writeFile(
      resultPath,
      `${JSON.stringify(
        {
          version: 1,
          completedAt: new Date().toISOString(),
          mode: 'isolated_frontend_mock',
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
