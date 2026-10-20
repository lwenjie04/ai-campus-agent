import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// 3.4 浏览器回归：游客第二问 → 登录弹窗 → 取消保留草稿 → 登录后只补发一次 → 刷新不重复。
const targetUrl = (process.env.INTENT_TARGET_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')
const adminAccount = String(process.env.JOURNEY_ADMIN_ACCOUNT || 'admin').trim()
const adminPassword = String(process.env.JOURNEY_ADMIN_PASSWORD || '').trim()
const resultPath = String(
  process.env.INTENT_RESULT_PATH || 'server/evals/latest-auth-intent-journey.json',
).trim()

if (!adminPassword) {
  console.error('[auth-intent-journey] JOURNEY_ADMIN_PASSWORD is required')
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
  console.error('[auth-intent-journey] Chrome not found. Set CHROME_PATH and retry.')
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
  console.log(`[auth-intent-journey] PASS ${name}`)
}

const profilePath = await mkdtemp(path.join(tmpdir(), 'campus-auth-intent-'))
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profilePath}`,
    '--window-size=1280,900',
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

  await command('Page.enable')
  await command('Runtime.enable')

  const navigate = async (url) => {
    await command('Page.navigate', { url })
    await sleep(900)
  }
  const pathname = () => evaluate('location.pathname')
  // el-dialog 关闭后仍留在 DOM（display:none），必须判断可见性而不是存在性。
  const loginDialogOpen = () =>
    evaluate(`(() => {
      const el = document.querySelector('.el-dialog.login-dialog')
      return Boolean(el) && el.offsetParent !== null
    })()`)
  const bubbles = () =>
    evaluate(
      `[...document.querySelectorAll('[data-testid="message-bubble"]')].map((node) => (node.textContent || '').trim())`,
    )
  const typeIntoInput = async (text) => {
    await evaluate(`(() => { const el = document.querySelector('.el-input__inner'); if (!el) return false; el.focus(); return true })()`)
    await command('Input.insertText', { text })
    await sleep(120)
  }
  const click = async (selector) => {
    const ok = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true })()`)
    if (!ok) throw new Error(`selector not found: ${selector}`)
  }
  const countQuestion = async (question) => {
    const texts = await bubbles()
    return texts.filter((text) => text === question).length
  }
  const waitForAnswer = async (label) =>
    waitFor(async () => {
      const path = await pathname()
      const texts = await bubbles()
      return path.startsWith('/chat/conv_') && texts.length >= 2 ? path : undefined
    }, label, 25_000)

  // 1. 游客第一问（服务端 GUEST_CHAT_LIMIT=1，前端第二次才会要求登录）。
  await navigate(`${targetUrl}/chat/new`)
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.el-input__inner'))`), 'chat input')
  await typeIntoInput('宿舍报修怎么申请？')
  await click('.send-btn')
  const firstPath = await waitForAnswer('guest first answer')
  record('游客第一问成功', firstPath)

  await waitFor(
    async () => evaluate(`(() => { const b = document.querySelector('.send-btn'); return Boolean(b) && b.disabled === false })()`),
    'send button enabled after first answer',
  )
  const messageCountAfterFirst = (await bubbles()).length

  // 2. 游客第二问 → 弹登录，不发送。
  const secondQuestion = '奖学金怎么申请？'
  await typeIntoInput(secondQuestion)
  await waitFor(
    async () => (await evaluate(`document.querySelector('.el-input__inner')?.value || ''`)) === secondQuestion,
    'second question typed',
  )
  await click('.send-btn')
  await waitFor(loginDialogOpen, 'login dialog for second question')
  await sleep(500)
  const countAfterBlocked = (await bubbles()).length
  if (countAfterBlocked !== messageCountAfterFirst) {
    throw new Error(`blocked question was still appended: ${messageCountAfterFirst} -> ${countAfterBlocked}`)
  }
  record('游客第二问触发登录且未发送', `messages=${countAfterBlocked}`)

  // 3. 取消登录（在遮罩空白处真实点击，等价于 close-on-click-modal）：草稿面板必须可见，消息数不变。
  // Element Plus 使用 useSameTarget，需要成对的 mousedown/mouseup，而不是脚本 click()。
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 20,
    y: 20,
    button: 'left',
    clickCount: 1,
  })
  await command('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 20,
    y: 20,
    button: 'left',
    clickCount: 1,
  })
  await waitFor(
    async () => !(await loginDialogOpen()),
    'login dialog closed',
    10_000,
  )
  const draftText = await waitFor(
    async () => {
      const text = await evaluate(`document.querySelector('.resume-draft')?.textContent || ''`)
      return text.includes(secondQuestion) ? text : undefined
    },
    'pending draft panel',
  )
  const countAfterCancel = (await bubbles()).length
  if (countAfterCancel !== messageCountAfterFirst) {
    throw new Error('canceling login unexpectedly sent the question')
  }
  record('取消登录保留草稿且不执行', draftText.trim().slice(0, 40))

  // 4. 继续 → 登录 → 只补发一次。
  await click('.resume-draft__primary')
  await waitFor(loginDialogOpen, 'login form')
  await evaluate(`(() => {
    const inputs = [...document.querySelectorAll('.el-dialog.login-dialog .el-input__inner')]
    inputs[0].focus()
    return true
  })()`)
  await command('Input.insertText', { text: adminAccount })
  await evaluate(`(() => {
    const inputs = [...document.querySelectorAll('.el-dialog.login-dialog .el-input__inner')]
    inputs[1].focus()
    return true
  })()`)
  await command('Input.insertText', { text: adminPassword })
  await sleep(120)
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('.el-dialog.login-dialog button')].find((item) => item.textContent.includes('登录并继续'))
    if (!button) return false
    button.click()
    return true
  })()`)

  await waitFor(async () => evaluate(`Boolean(document.querySelector('.top-nav__auth-role'))`), 'logged-in state')
  const sentPath = await waitForAnswer('question sent after login')
  await waitFor(async () => (await countQuestion(secondQuestion)) === 1, 'question sent exactly once', 25_000)
  record('登录后只补发一次', sentPath)

  // 5. 刷新后不自动重复发送。
  await command('Page.reload', { ignoreCache: true })
  await sleep(2_500)
  const countAfterReload = (await countQuestion(secondQuestion))
  if (countAfterReload !== 1) throw new Error(`duplicated question after reload: ${countAfterReload}`)
  const draftAfterReload = await evaluate(`document.querySelector('.resume-draft')?.textContent || ''`)
  if (draftAfterReload.includes(secondQuestion)) throw new Error('consumed draft is still offered after reload')
  record('刷新后不重复发送', `count=${countAfterReload}`)
} catch (error) {
  failed = true
  steps.push({ name: 'journey', ok: false, detail: String(error?.message || error) })
  console.error(`[auth-intent-journey] FAIL ${String(error?.stack || error?.message || error)}`)
} finally {
  const payload = {
    version: 1,
    completedAt: new Date().toISOString(),
    mode: 'isolated_mock',
    targetUrl,
    ok: !failed,
    steps,
  }
  try {
    await writeFile(path.resolve(resultPath), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  } catch {
    // 结果写入失败不影响退出码。
  }

  try {
    socket?.close()
  } catch {
    // ignore
  }
  chrome.kill()
  await sleep(200)
  await rm(profilePath, { recursive: true, force: true }).catch(() => undefined)
}

if (failed) process.exit(1)
console.log(`[auth-intent-journey] PASS ${steps.length} steps`)
