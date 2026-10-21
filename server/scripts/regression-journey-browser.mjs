import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// 4.6 联测：刷新中断/重试、跨会话晚到、来源栏绑定、TTS 失败、移动端自动播放拦截、过期登录隔离。
const targetUrl = (process.env.REGRESSION_TARGET_URL || 'http://127.0.0.1:4176').replace(/\/$/, '')
const adminAccount = String(process.env.JOURNEY_ADMIN_ACCOUNT || 'admin').trim()
const adminPassword = String(process.env.JOURNEY_ADMIN_PASSWORD || '').trim()
const resultPath = String(process.env.REGRESSION_RESULT_PATH || 'server/evals/latest-regression-journey.json').trim()
const shotDir = String(process.env.REGRESSION_SHOT_DIR || 'docs/design/verify').trim()

if (!adminPassword) {
  console.error('[regression] JOURNEY_ADMIN_PASSWORD is required')
  process.exit(1)
}

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
].filter(Boolean)
const chromePath = chromeCandidates.find((candidate) => existsSync(candidate))
if (!chromePath) {
  console.error('[regression] Chrome not found. Set CHROME_PATH and retry.')
  process.exit(1)
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const waitFor = async (check, label, timeoutMilliseconds = 30_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMilliseconds) {
    const value = await check().catch(() => undefined)
    if (value) return value
    await sleep(180)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

const steps = []
const record = (name, detail) => {
  steps.push({ name, ok: true, detail })
  console.log(`[regression] PASS ${name}`)
}

const profilePath = await mkdtemp(path.join(tmpdir(), 'campus-regression-'))
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
  const pathname = () => evaluate('location.pathname')
  const setInput = (selector, value, index = 0) =>
    evaluate(`(() => {
      const input = document.querySelectorAll(${JSON.stringify(selector)})[${index}]
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(value)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return input.value
    })()`)
  const ask = async (question) => {
    await evaluate(`document.querySelector('.input-box textarea').focus()`)
    await command('Input.insertText', { text: question })
    await sleep(200)
    await evaluate(`document.querySelector('.send-btn').click()`)
  }
  const assistantCount = () => evaluate(`document.querySelectorAll('[data-role="assistant"]').length`)
  const userCount = () => evaluate(`document.querySelectorAll('[data-role="user"]').length`)
  const loading = () => evaluate(`Boolean(document.querySelector('[data-testid="loading-indicator"]'))`)
  const lastAnswerText = () =>
    evaluate(`(() => {
      const rows = document.querySelectorAll('[data-role="assistant"]')
      return rows[rows.length - 1]?.querySelector('[data-testid="message-bubble"]')?.textContent?.trim() || ''
    })()`)
  const waitForAnswer = async (minimumCount) => {
    await waitFor(
      async () =>
        (await assistantCount()) >= minimumCount &&
        !(await loading()) &&
        (await lastAnswerText()).length > 20,
      'answer',
    )
  }
  const setLatency = (latency) =>
    command('Network.emulateNetworkConditions', {
      offline: false,
      latency,
      downloadThroughput: -1,
      uploadThroughput: -1,
    })

  await command('Page.enable')
  await command('Runtime.enable')
  await command('Network.enable')
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  // 0. 登录：后续联测需要登录态（游客只能试问一次，且 TTS 需要会话）。
  await command('Page.navigate', { url: `${targetUrl}/chat/new` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'chat load')
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.input-box textarea'))`), 'composer')
  await evaluate(`document.querySelector('.top-nav__auth button').click()`)
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.login-panel'))`), 'login panel')
  await setInput('.login-panel .login-form input', adminAccount)
  await setInput('.login-panel .login-form input', adminPassword, 1)
  await evaluate(`document.querySelector('.login-submit').click()`)
  await waitFor(
    async () => evaluate(`(() => {
      const dialog = document.querySelector('.el-dialog.login-dialog')
      return !dialog || dialog.getBoundingClientRect().height === 0
    })()`),
    'login success',
  )
  record('管理员登录', adminAccount)

  // 1. 刷新中断：延迟响应，生成中刷新，恢复后应为 interrupted 并可重试。
  await setLatency(1200)
  const beforeInterrupt = await assistantCount()
  await ask('选课在哪里查课表？')
  await waitFor(loading, 'pending before reload')
  await command('Page.reload', {})
  await setLatency(0)
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.input-box textarea'))`), 'reload composer')
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.interrupted-tip'))`), 'interrupted tip')
  record('刷新中断保留 interrupted', 'interrupted-tip visible')
  await screenshot('regression-interrupted-1440.png')
  await evaluate(`document.querySelector('.interrupted-tip .retry-btn').click()`)
  await waitForAnswer(beforeInterrupt)
  const interruptedGone = await evaluate(`!document.querySelector('.interrupted-tip')`)
  if (!interruptedGone) throw new Error('retry did not clear interrupted state')
  record('重试后恢复回答', 'retry ok')

  // 2. 跨会话晚到：A 生成中切到新会话，A 的迟到结果不得出现在新会话。
  const createNewChat = async () => {
    await evaluate(`document.querySelector('.new-chat-btn').click()`)
    await waitFor(async () => (await pathname()) === '/chat/new', 'new chat route')
    await waitFor(async () => Boolean(await evaluate(`document.querySelector('.input-box textarea')`)), 'new chat composer')
  }
  await createNewChat()
  await setLatency(1500)
  await ask('奖学金什么时候评审？')
  await waitFor(loading, 'pending in conversation A')
  await createNewChat()
  await setLatency(0)
  await sleep(2_500)
  const leakedUsers = await userCount()
  const leakedAnswers = await assistantCount()
  if (leakedUsers !== 0 || leakedAnswers !== 1) {
    throw new Error(`late answer leaked into new chat: users=${leakedUsers} assistants=${leakedAnswers}`)
  }
  const newChatLoading = await loading()
  if (newChatLoading) throw new Error('new chat still shows loading')
  record('跨会话晚到未串入新会话', `users=0 assistants=${leakedAnswers}`)

  // 3. 来源栏绑定：当前回答带来源时来源栏有卡；再问后更新。
  await ask('宿舍报修怎么申请？')
  await waitForAnswer(2)
  await waitFor(async () => evaluate(`document.querySelectorAll('.source-rail .rail-source').length > 0`), 'rail source')
  const railTitle = await evaluate(`document.querySelector('.source-rail .rail-source__title')?.textContent?.trim() || ''`)
  if (!railTitle) throw new Error('source rail title is empty')
  record('来源栏绑定当前回答', railTitle.slice(0, 30))

  // 4. TTS 失败：阻断 /api/tts 后点语音卡，应出现可见提示。
  await command('Network.setBlockedURLs', { urls: ['*tts*'] })
  await evaluate(`document.querySelector('.voice-card__action').click()`)
  const ttsNotice = await waitFor(
    async () => {
      const text = await evaluate(`document.querySelector('.conversation-notice')?.textContent?.trim() || ''`)
      return text.includes('语音播报暂不可用') ? text : undefined
    },
    'tts failure notice',
  )
  record('TTS 失败提示', ttsNotice)
  await command('Network.setBlockedURLs', { urls: [] })

  // 5. 移动端自动播放限制：伪造 TTS 成功 + play() NotAllowedError，应提示再点一次。
  await evaluate(`(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.includes('/tts')) {
        return new Response(new Blob([new Uint8Array([0])], { type: 'audio/mpeg' }), { status: 200 })
      }
      return originalFetch(input, init)
    }
    HTMLMediaElement.prototype.play = () => Promise.reject(
      Object.assign(new Error('blocked by autoplay policy'), { name: 'NotAllowedError' }),
    )
    return true
  })()`)
  await evaluate(`document.querySelector('.voice-card__action').click()`)
  const blockedNotice = await waitFor(
    async () => {
      const text = await evaluate(`document.querySelector('.conversation-notice')?.textContent?.trim() || ''`)
      return text.includes('浏览器限制了自动播放') ? text : undefined
    },
    'autoplay blocked notice',
  )
  record('移动端自动播放拦截提示', blockedNotice)

  // 6. 过期登录隔离：清 Cookie 与本地登录态后刷新，当前用户会话不得以游客身份展示。
  await command('Network.clearBrowserCookies')
  await evaluate(`localStorage.removeItem('ai-campus-agent.auth.v4')`)
  await command('Page.reload', {})
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'reload after session expiry')
  await sleep(1_200)
  const finalPath = await pathname()
  const leakedUserMessages = await userCount()
  if (leakedUserMessages !== 0) throw new Error(`expired login leaked ${leakedUserMessages} user messages`)
  const expiredNotice = await evaluate(
    `document.querySelector('.conversation-notice')?.textContent?.trim() || ''`,
  )
  if (finalPath !== '/chat/new' && !expiredNotice) {
    throw new Error(`expired login neither redirected nor notified: path=${finalPath}`)
  }
  record('过期登录隔离', `${finalPath}${expiredNotice ? ` / ${expiredNotice.slice(0, 24)}` : ''}`)

  const result = {
    version: 1,
    completedAt: new Date().toISOString(),
    mode: 'isolated_real_backend_mock',
    targetUrl,
    ok: true,
    steps,
  }
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(`[regression] PASS ${steps.length} steps`)
} catch (error) {
  failed = true
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[regression] FAIL ${message}`)
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
