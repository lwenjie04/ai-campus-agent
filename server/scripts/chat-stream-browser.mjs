import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// 2.5：真实后端流式回答检查（NDJSON /api/chat/stream），桌面与 390 手机各一次。
const targetUrl = (process.env.STREAM_TARGET_URL || 'http://127.0.0.1:4176').replace(/\/$/, '')
const resultPath = String(process.env.STREAM_RESULT_PATH || 'server/evals/latest-chat-stream.json').trim()
const shotDir = String(process.env.STREAM_SHOT_DIR || 'docs/design/verify').trim()

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
].filter(Boolean)
const chromePath = chromeCandidates.find((candidate) => existsSync(candidate))
if (!chromePath) {
  console.error('[chat-stream] Chrome not found. Set CHROME_PATH and retry.')
  process.exit(1)
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const waitFor = async (check, label, timeoutMilliseconds = 40_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMilliseconds) {
    const value = await check().catch(() => undefined)
    if (value) return value
    await sleep(200)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

const steps = []
const record = (name, detail) => {
  steps.push({ name, ok: true, detail })
  console.log(`[chat-stream] PASS ${name}`)
}

const profilePath = await mkdtemp(path.join(tmpdir(), 'campus-chat-stream-'))
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
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluate failed')
    }
    return result.result.value
  }
  const screenshot = async (name) => {
    const { data } = await command('Page.captureScreenshot', { format: 'png' })
    await writeFile(path.join(shotDir, name), Buffer.from(data, 'base64'))
  }
  const ask = async (question) => {
    await evaluate(`document.querySelector('.input-box textarea').focus()`)
    await command('Input.insertText', { text: question })
    await sleep(250)
    await evaluate(`document.querySelector('.send-btn').click()`)
  }
  const waitForAnswer = async (minimumLength, minimumCount) => {
    const answer = await waitFor(
      async () =>
        evaluate(`(() => {
          const rows = document.querySelectorAll('[data-role="assistant"]')
          if (rows.length < ${minimumCount}) return undefined
          const last = rows[rows.length - 1]
          const text = last?.querySelector('[data-testid="message-bubble"]')?.textContent || ''
          return text.trim().length > ${minimumLength} && !document.querySelector('[data-testid="loading-indicator"]')
            ? text.trim()
            : undefined
        })()`),
      'streamed answer',
    )
    const hasError = await evaluate(`Boolean(document.querySelector('.error-tip'))`)
    if (hasError) throw new Error('chat returned an error bubble')
    return answer
  }
  const assistantCount = () => evaluate(`document.querySelectorAll('[data-role="assistant"]').length`)

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
    async () => evaluate(`Boolean(document.querySelector('.input-box textarea'))`),
    'chat composer',
  )

  const desktopBefore = await assistantCount()
  await ask('选课在哪里查课表？')
  await waitFor(async () => (await assistantCount()) > desktopBefore, 'desktop pending message')
  const desktopAnswer = await waitForAnswer(20, desktopBefore + 1)
  const streamEntries = await waitFor(async () => {
    const entries = await evaluate(`(() => {
      const items = performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/chat/stream'))
      return items.map((entry) => ({ name: entry.name, duration: Math.round(entry.duration), status: entry.responseStatus }))
    })()`)
    return entries.length > 0 ? entries : undefined
  }, 'stream resource')
  if (!streamEntries.some((entry) => entry.status === 200)) {
    throw new Error(`stream response status not 200: ${JSON.stringify(streamEntries)}`)
  }
  record('桌面真实流式回答', `status=${streamEntries[0].status} chars=${desktopAnswer.length}`)
  await screenshot('chat-stream-1440.png')

  await command('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await sleep(300)
  // 清掉游客试问标记后重新进入，保证手机端还能再发一条。
  await evaluate('localStorage.clear()')
  await command('Page.navigate', { url: `${targetUrl}/chat/new` })
  await waitFor(async () => evaluate('document.readyState === "complete"'), 'mobile chat page load')
  await waitFor(
    async () => evaluate(`Boolean(document.querySelector('.input-box textarea'))`),
    'mobile chat composer',
  )
  const sendVisible = await evaluate(`(() => {
    const button = document.querySelector('.composer .send-btn')
    if (!button) return false
    const rect = button.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && rect.bottom <= window.innerHeight + 1
  })()`)
  if (!sendVisible) throw new Error('mobile send button is not visible')
  const mobileBefore = await assistantCount()
  await ask('宿舍报修怎么申请？')
  await waitFor(async () => (await assistantCount()) > mobileBefore, 'mobile pending message')
  const mobileAnswer = await waitForAnswer(20, mobileBefore + 1)
  record('手机 390 真实流式回答', `chars=${mobileAnswer.length}`)
  await screenshot('chat-stream-390.png')

  const result = {
    version: 1,
    completedAt: new Date().toISOString(),
    mode: 'isolated_real_backend_mock',
    targetUrl,
    ok: true,
    steps,
  }
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(`[chat-stream] PASS ${steps.length} steps`)
} catch (error) {
  failed = true
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[chat-stream] FAIL ${message}`)
  try {
    await writeFile(
      resultPath,
      `${JSON.stringify(
        {
          version: 1,
          completedAt: new Date().toISOString(),
          mode: 'isolated_real_backend_mock',
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
