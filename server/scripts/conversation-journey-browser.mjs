import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// 3.3 浏览器回归：登录 → 两轮问答 → 刷新恢复 → 历史切换 → 草稿恢复 → 无效 ID → 前进后退。
// 只操作真实浏览器与真实构建产物；后端使用 mock 模型，不代表真实模型已验证。
const targetUrl = (process.env.CONVERSATION_TARGET_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')
const adminAccount = String(process.env.JOURNEY_ADMIN_ACCOUNT || 'admin').trim()
const adminPassword = String(process.env.JOURNEY_ADMIN_PASSWORD || '').trim()
const resultPath = String(
  process.env.CONVERSATION_RESULT_PATH || 'server/evals/latest-conversation-journey.json',
).trim()

if (!adminPassword) {
  console.error('[conversation-journey] JOURNEY_ADMIN_PASSWORD is required')
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
  console.error('[conversation-journey] Chrome not found. Set CHROME_PATH and retry.')
  process.exit(1)
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const waitFor = async (check, label, timeoutMilliseconds = 15_000) => {
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
  console.log(`[conversation-journey] PASS ${name}`)
}

const profilePath = await mkdtemp(path.join(tmpdir(), 'campus-conversation-journey-'))
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
let command
let evaluate
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
  command = (method, params) => sendCommand(socket, ++commandId, method, params)
  evaluate = async (expression) => {
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
    await sleep(800)
  }

  const pathname = () => evaluate('location.pathname')
  const bubbleText = () =>
    evaluate(`(() => {
      const nodes = [...document.querySelectorAll('[data-testid="message-bubble"]')]
      return nodes.map((node) => node.textContent || '')
    })()`)
  const inputValue = () => evaluate(`document.querySelector('.el-input__inner')?.value || ''`)

  const typeIntoInput = async (text) => {
    await evaluate(`(() => { const el = document.querySelector('.el-input__inner'); if (!el) return false; el.focus(); return true })()`)
    await command('Input.insertText', { text })
    await sleep(120)
  }

  const click = async (selector) => {
    const clicked = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return false
      el.click()
      return true
    })()`)
    if (!clicked) throw new Error(`selector not found: ${selector}`)
  }

  const waitForConversation = async (label) =>
    waitFor(async () => {
      const path = await pathname()
      if (!path.startsWith('/chat/conv_')) return undefined
      const texts = await bubbleText()
      const last = texts[texts.length - 1] || ''
      if (texts.length < 2 || last.trim().length < 4) return undefined
      // 返回纯 conversationId，便于与历史项 data 属性比较。
      return path.replace('/chat/', '')
    }, label, 25_000)

  // 1. 打开 /chat/new 并登录，避免游客试问次数干扰多会话测试。
  console.log('[conversation-journey] step: open /chat/new')
  await navigate(`${targetUrl}/chat/new`)
  await waitFor(async () => evaluate(`Boolean(document.querySelector('[data-testid="nav-community"]'))`), 'app shell')

  console.log('[conversation-journey] step: open login dialog')
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('.top-nav__auth button')].find((item) => item.textContent.includes('登录'))
    if (!button) return false
    button.click()
    return true
  })()`)
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.el-dialog.login-dialog'))`), 'login dialog')
  await waitFor(
    async () => evaluate(`document.querySelectorAll('.el-dialog.login-dialog .el-input__inner').length >= 2`),
    'login inputs',
  )

  console.log('[conversation-journey] step: submit admin login')

  const fillLogin = async (account, password) => {
    await evaluate(`(() => {
      const inputs = [...document.querySelectorAll('.el-dialog.login-dialog .el-input__inner')]
      if (inputs.length < 2) return false
      inputs[0].focus()
      return true
    })()`)
    await command('Input.insertText', { text: account })
    await evaluate(`(() => {
      const inputs = [...document.querySelectorAll('.el-dialog.login-dialog .el-input__inner')]
      inputs[1].focus()
      return true
    })()`)
    await command('Input.insertText', { text: password })
    await sleep(120)
    await evaluate(`(() => {
      const button = [...document.querySelectorAll('.el-dialog.login-dialog button')].find((item) => item.textContent.includes('登录并继续'))
      if (!button) return false
      button.click()
      return true
    })()`)
  }

  await fillLogin(adminAccount, adminPassword)
  await waitFor(
    async () => evaluate(`Boolean(document.querySelector('.top-nav__auth-role'))`),
    'logged-in state',
    20_000,
  )
  record('管理员登录', adminAccount)

  // 2. 第一轮问答：首次发送后应 replace 到 /chat/:id。
  await navigate(`${targetUrl}/chat/new`)
  await typeIntoInput('补考怎么报名？')
  await click('.send-btn')
  const conversationA = await waitForConversation('first conversation answer')
  record('首次发送进入 /chat/:id', `/chat/${conversationA}`)

  const firstAnswer = (await bubbleText()).slice(-1)[0]
  if (!firstAnswer || firstAnswer.length < 4) throw new Error('first answer text is empty')

  // 3. 刷新后恢复同一会话与消息。
  await command('Page.reload', { ignoreCache: true })
  await waitFor(async () => {
    const path = await pathname()
    const texts = await bubbleText()
    return path === `/chat/${conversationA}` && texts.length >= 2
  }, 'restore after reload', 25_000)
  const restoredText = (await bubbleText()).slice(-1)[0]
  if (!restoredText.includes(firstAnswer.slice(0, 6))) {
    throw new Error('restored answer does not match the original answer')
  }
  record('刷新恢复会话与消息', `/chat/${conversationA}`)

  // 4. 草稿写入（不发送），随后新建会话应保留旧会话。
  await typeIntoInput('这条是草稿，不发送')
  await sleep(700)

  await click('[data-testid="open-history"]')
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.history-drawer'))`), 'history drawer')
  const historyCountA = await evaluate(`document.querySelectorAll('.history-item').length`)
  if (historyCountA < 1) throw new Error('history drawer is empty after first conversation')

  await click('.history-new')
  await waitFor(async () => (await pathname()) === '/chat/new', 'new conversation route')
  record('新建对话先保存旧会话', `/chat/new (history=${historyCountA})`)

  // 5. 第二轮问答，应生成不同 conversationId。
  await typeIntoInput('奖学金怎么申请？')
  await click('.send-btn')
  const conversationB = await waitForConversation('second conversation answer')
  if (conversationB === conversationA) throw new Error('second conversation reused the first id')
  record('两条会话相互独立', `/chat/${conversationA} / /chat/${conversationB}`)

  // 6. 历史切换：回到第一条会话应恢复消息与草稿。
  await click('[data-testid="open-history"]')
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.history-drawer'))`), 'history drawer again')
  const historyCountB = await evaluate(`document.querySelectorAll('.history-item').length`)
  if (historyCountB < 2) throw new Error(`expected 2 conversations, got ${historyCountB}`)

  const historyIds = await evaluate(
    `[...document.querySelectorAll('.history-item')].map((el) => el.getAttribute('data-conversation-id'))`,
  )
  console.log('[conversation-journey] history ids', JSON.stringify(historyIds), 'target', conversationA)

  const clickedFirst = await evaluate(`(() => {
    const item = document.querySelector('[data-conversation-id="${conversationA}"] .history-entry')
    if (!item) return false
    item.click()
    return true
  })()`)
  if (!clickedFirst) throw new Error(`history entry not found for ${conversationA}: ${JSON.stringify(historyIds)}`)

  await waitFor(async () => (await pathname()) === `/chat/${conversationA}`, 'switch back to first conversation', 20_000)
  await waitFor(async () => (await bubbleText()).length >= 2, 'first conversation messages')
  const draftValue = await inputValue()
  if (!draftValue.includes('草稿')) {
    throw new Error(`draft was not restored, got "${draftValue}"`)
  }
  record('历史切换恢复草稿', draftValue)

  // 7. 无效会话 ID：给出明确提示并回落 /chat/new。
  await navigate(`${targetUrl}/chat/conv_not_exists`)
  await waitFor(async () => {
    const notice = await evaluate(`document.querySelector('.conversation-notice')?.textContent || ''`)
    return notice.includes('不存在') ? notice : undefined
  }, 'invalid conversation notice', 20_000)
  await waitFor(async () => (await pathname()) === '/chat/new', 'fallback to /chat/new', 20_000)
  record('无效会话 ID 提示并回落', '/chat/new')

  // 8. 前进后退：后退回到上一个会话页面，不应白屏。
  await command('Page.navigate', { url: `${targetUrl}/chat/${conversationB}` })
  await waitFor(async () => (await pathname()) === `/chat/${conversationB}`, 'reopen second conversation', 20_000)
  await evaluate('history.back()')
  await waitFor(
    async () => {
      const path = await pathname()
      return path.startsWith('/chat') && (await evaluate('Boolean(document.querySelector(".el-input__inner"))'))
    },
    'back navigation renders chat',
    20_000,
  )
  record('浏览器后退仍可渲染会话', await pathname())
} catch (error) {
  failed = true
  steps.push({ name: 'journey', ok: false, detail: String(error?.message || error) })
  console.error(`[conversation-journey] FAIL ${String(error?.stack || error?.message || error)}`)
  try {
    const shot = await command('Page.captureScreenshot', { format: 'png', fromSurface: true })
    await writeFile(
      path.resolve('server/evals/conversation-journey-failure.png'),
      Buffer.from(shot.data, 'base64'),
    )
  } catch {
    // 截图失败不影响结果记录。
  }
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
console.log(`[conversation-journey] PASS ${steps.length} steps`)
