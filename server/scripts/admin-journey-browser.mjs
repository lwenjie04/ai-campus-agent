import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// 6.3 后台回归：审核/检索双路由、刷新保持、手机可审核、无权限 URL 与 API 拒绝。
const targetUrl = (process.env.ADMIN_TARGET_URL || 'http://127.0.0.1:4176').replace(/\/$/, '')
const adminAccount = String(process.env.JOURNEY_ADMIN_ACCOUNT || 'admin').trim()
const adminPassword = String(process.env.JOURNEY_ADMIN_PASSWORD || '').trim()
const resultPath = String(process.env.ADMIN_RESULT_PATH || 'server/evals/latest-admin-journey.json').trim()
const shotDir = String(process.env.ADMIN_SHOT_DIR || 'docs/design/verify').trim()

if (!adminPassword) {
  console.error('[admin] JOURNEY_ADMIN_PASSWORD is required')
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
  console.error('[admin] Chrome not found. Set CHROME_PATH and retry.')
  process.exit(1)
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const waitFor = async (check, label, timeoutMilliseconds = 25_000) => {
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
  console.log(`[admin] PASS ${name}`)
}

const profilePath = await mkdtemp(path.join(tmpdir(), 'campus-admin-'))
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
  const requestCounts = { approve: 0, reject: 0, generate: 0 }
  const pageErrors = []
  let failGenerateOnce = true
  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(String(event.data))
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params?.exceptionDetails
        pageErrors.push(details?.exception?.description || details?.text || 'page exception')
        return
      }
      if (message.method === 'Network.requestWillBeSent') {
        const request = message.params?.request
        if (request?.method === 'POST' && typeof request.url === 'string') {
          if (request.url.includes('/knowledge/generate')) requestCounts.generate += 1
          else if (request.url.endsWith('/approve')) requestCounts.approve += 1
          else if (request.url.endsWith('/reject')) requestCounts.reject += 1
        }
        return
      }
      if (message.method === 'Fetch.requestPaused') {
        const requestId = message.params.requestId
        const url = String(message.params.request?.url || '')
        if (url.includes('/knowledge/generate') && failGenerateOnce) {
          failGenerateOnce = false
          const body = Buffer.from(
            JSON.stringify({
              error: {
                code: 'KNOWLEDGE_GENERATION_FAILED',
                message: '模拟知识生成失败',
                retryable: true,
                postStatus: 'approved',
              },
            }),
          ).toString('base64')
          void command('Fetch.fulfillRequest', {
            requestId,
            responseCode: 503,
            responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
            body,
          })
        } else {
          void command('Fetch.continueRequest', { requestId })
        }
      }
    } catch {
      // ignore non-JSON frames
    }
  })
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

  await command('Page.enable')
  await command('Runtime.enable')
  await command('Network.enable')
  await command('Fetch.enable', { patterns: [{ urlPattern: '*knowledge/generate*', requestStage: 'Request' }] })
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  // 0. 登录管理员。
  await command('Page.navigate', { url: `${targetUrl}/` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'home load')
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

  // 1. 审核路由。
  await command('Page.navigate', { url: `${targetUrl}/admin/review` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'admin review load')
  await waitFor(
    async () => evaluate(`document.querySelector('[data-testid="knowledge-ops-title"]')?.textContent?.trim() === '知识运营'`),
    'admin review title',
  )
  const reviewUrl = await pathname()
  if (reviewUrl !== '/admin/review') throw new Error(`unexpected review url: ${reviewUrl}`)
  const queueVisible = await waitFor(
    async () => evaluate(`[...document.querySelectorAll('h2,h3')].some((item) => item.textContent?.includes('待审核帖子'))`),
    'pending posts panel',
  )
  if (!queueVisible) throw new Error('pending posts panel missing')
  record('审核路由与队列面板', '/admin/review')
  await screenshot('admin-review-1440.png')

  // 2. 切到检索管理，URL 同步；刷新后仍停留在检索。
  await evaluate(`document.querySelector('[data-testid="admin-tab-retrieval"]').click()`)
  await waitFor(async () => (await pathname()) === '/admin/retrieval', 'retrieval route')
  const retrievalTitle = await waitFor(
    async () => {
      const text = await evaluate(`document.querySelector('.lightrag-hero h2')?.textContent?.trim() || ''`)
      return text.includes('检索') ? text : undefined
    },
    'retrieval panel',
  )
  record('检索路由与面板', `${retrievalTitle}`)
  await screenshot('admin-retrieval-1440.png')

  await command('Page.reload', {})
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'retrieval reload')
  await waitFor(async () => (await pathname()) === '/admin/retrieval', 'retrieval url after reload')
  await waitFor(
    async () => evaluate(`(() => {
      const panel = document.querySelector('.lightrag-panel')
      return Boolean(panel) && panel.offsetParent !== null
    })()`),
    'retrieval panel after reload',
  )
  record('检索路由刷新保持', '/admin/retrieval')

  // 3. 造一条待审核帖子，验证手机端可审核。
  const createResult = await evaluate(`(async () => {
    const raw = localStorage.getItem('ai-campus-agent.auth.v4')
    const token = raw ? JSON.parse(raw)?.accessToken : ''
    const response = await fetch('/api/community/posts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({
        authorName: '联测同学',
        title: '后台联测待审核帖子',
        content: '用于验证手机端审核界面的临时帖子。',
        category: 'teaching',
        tags: ['联测'],
      }),
    })
    return { status: response.status, body: await response.text() }
  })()`)
  if (![200, 201].includes(createResult.status)) {
    throw new Error(`create pending post failed: ${createResult.status} ${createResult.body}`)
  }
  record('创建待审核帖子', `status=${createResult.status}`)

  await command('Page.navigate', { url: `${targetUrl}/admin/review` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'review reload')
  await waitFor(
    async () => evaluate(`document.body.textContent.includes('后台联测待审核帖子')`),
    'pending post visible',
  )

  await command('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await sleep(400)
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === '通过')
    button?.scrollIntoView({ block: 'center' })
    return true
  })()`)
  await sleep(300)
  const mobileState = await evaluate(`(() => {
    const root = document.documentElement
    const overflow = Math.max(0, root.scrollWidth - root.clientWidth)
    const approveButtons = [...document.querySelectorAll('button')].filter((item) => item.textContent?.trim() === '通过')
    const visibleApprove = approveButtons.some((item) => {
      const rect = item.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && rect.bottom <= window.innerHeight + 1
    })
    return { overflow, visibleApprove, tabs: Boolean(document.querySelector('[data-testid="admin-tab-review"]')) }
  })()`)
  if (mobileState.overflow > 1) throw new Error(`admin mobile overflow: ${mobileState.overflow}`)
  if (!mobileState.visibleApprove) throw new Error('mobile approve button not visible')
  if (!mobileState.tabs) throw new Error('mobile admin tabs missing')
  record('手机端可审核', `overflow=0 approveVisible`)
  await screenshot('admin-review-390.png')

  // 4. 6.4：拒绝二次确认 + 生成失败独立状态 + 只重试生成。
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await command('Page.navigate', { url: `${targetUrl}/admin/review` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'review for 6.4')
  await waitFor(
    async () => evaluate(`document.body.textContent.includes('后台联测待审核帖子')`),
    'pending post for reject',
  )

  const clickRowAction = (title, actionText) =>
    evaluate(`(() => {
      const card = [...document.querySelectorAll('.item-card')].find((item) => item.textContent?.includes(${JSON.stringify(title)}))
      if (!card) throw new Error('card not found: ' + ${JSON.stringify(title)})
      const button = [...card.querySelectorAll('button')].find((item) => item.textContent?.trim() === ${JSON.stringify(actionText)})
      if (!button) throw new Error('button not found: ' + ${JSON.stringify(actionText)})
      button.click()
      return true
    })()`)

  await clickRowAction('后台联测待审核帖子', '拒绝')
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.el-message-box'))`), 'reject confirm dialog')
  await evaluate(`(() => {
    const box = document.querySelector('.el-message-box')
    const cancel = [...box.querySelectorAll('button')].find((item) => item.textContent?.trim() === '取消')
    cancel?.click()
    return true
  })()`)
  await sleep(350)
  if (!(await evaluate(`document.body.textContent.includes('后台联测待审核帖子')`))) {
    throw new Error('reject cancel removed the post')
  }
  record('拒绝二次确认可取消', 'no request')

  await clickRowAction('后台联测待审核帖子', '拒绝')
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.el-message-box'))`), 'reject confirm dialog again')
  await evaluate(`(() => {
    const box = document.querySelector('.el-message-box')
    const confirm = [...box.querySelectorAll('button')].find((item) => item.textContent?.trim() === '确认拒绝')
    confirm?.click()
    return true
  })()`)
  await waitFor(
    async () => !(await evaluate(`document.body.textContent.includes('后台联测待审核帖子')`)),
    'rejected post removed',
  )
  if (requestCounts.reject !== 1) throw new Error(`unexpected reject requests: ${requestCounts.reject}`)
  record('确认拒绝只发一次请求', `POST reject=${requestCounts.reject}`)

  // 新建第二条待审核帖子，制造“通过成功 + 生成失败”。
  const createSecond = await evaluate(`(async () => {
    const raw = localStorage.getItem('ai-campus-agent.auth.v4')
    const token = raw ? JSON.parse(raw)?.accessToken : ''
    const response = await fetch('/api/community/posts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({
        authorName: '联测同学',
        title: '知识生成失败联测',
        content: '用于验证知识生成失败与只重试生成的临时帖子。',
        category: 'life',
        tags: ['联测'],
      }),
    })
    return response.status
  })()`)
  if (![200, 201].includes(createSecond)) throw new Error(`create second post failed: ${createSecond}`)

  await command('Page.navigate', { url: `${targetUrl}/admin/review` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'review reload for generate')
  await waitFor(
    async () => evaluate(`document.body.textContent.includes('知识生成失败联测')`),
    'second pending post visible',
  )

  const beforeCounts = { ...requestCounts }
  await evaluate(`(() => {
    const card = [...document.querySelectorAll('.item-card')].find((item) => item.textContent?.includes('知识生成失败联测'))
    const button = [...card.querySelectorAll('button')].find((item) => item.textContent?.trim() === '通过并生成知识')
    button.click()
    button.click()
    return true
  })()`)
  const failurePanel = await waitFor(
    async () => {
      const text = await evaluate(`document.querySelector('.knowledge-failure-panel')?.textContent?.trim() || ''`)
      return text.includes('知识生成失败联测') ? text : undefined
    },
    'knowledge failure panel',
  )
  record('生成失败显示独立状态', failurePanel.slice(0, 48))
  await screenshot('admin-knowledge-failure-1440.png')
  if (requestCounts.approve - beforeCounts.approve !== 1) {
    throw new Error(`duplicate approve requests: ${requestCounts.approve - beforeCounts.approve}`)
  }
  if (requestCounts.generate - beforeCounts.generate !== 1) {
    throw new Error(`unexpected generate requests: ${requestCounts.generate - beforeCounts.generate}`)
  }

  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === '重试生成')
    if (!button) throw new Error('retry generate button missing')
    button.click()
    button.click()
    return true
  })()`)
  await waitFor(
    async () => !(await evaluate(`Boolean(document.querySelector('.knowledge-failure-panel'))`)),
    'failure panel cleared after retry',
  ).catch(async (error) => {
    const panelText = await evaluate(
      `document.querySelector('.knowledge-failure-panel')?.textContent?.trim() || ''`,
    )
    throw new Error(
      `${error.message}: ${JSON.stringify({
        panelText,
        counts: requestCounts,
        approveDelta: requestCounts.approve - beforeCounts.approve,
        generateDelta: requestCounts.generate - beforeCounts.generate,
        pageErrors: pageErrors.slice(-3),
      })}`,
    )
  })
  await sleep(400)
  if (requestCounts.generate - beforeCounts.generate !== 2) {
    throw new Error(`retry generate requests: ${requestCounts.generate - beforeCounts.generate}`)
  }
  if (requestCounts.approve - beforeCounts.approve !== 1) {
    throw new Error('retry re-approved the post')
  }
  record('只重试生成，不重复 approve', 'approve=1 generate=2')

  // 5. 无权限：清 Cookie 与本地登录态后直达 URL → 回首页；后台接口 → 401/403。
  await command('Network.clearBrowserCookies')
  await evaluate(`localStorage.removeItem('ai-campus-agent.auth.v4')`)
  await command('Page.navigate', { url: `${targetUrl}/admin/review` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'unauthorized load')
  await sleep(1_000)
  const finalPath = await pathname()
  if (finalPath === '/admin/review') throw new Error('unauthorized admin url was not redirected')
  const apiStatus = await evaluate(`(async () => {
    const response = await fetch('/api/community/review/posts')
    return response.status
  })()`)
  if (![401, 403].includes(apiStatus)) {
    throw new Error(`unauthorized admin API returned ${apiStatus}`)
  }
  record('无权限 URL 与接口拒绝', `path=${finalPath} api=${apiStatus}`)

  const result = {
    version: 1,
    completedAt: new Date().toISOString(),
    mode: 'isolated_real_backend_memory',
    targetUrl,
    ok: true,
    steps,
  }
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(`[admin] PASS ${steps.length} steps`)
} catch (error) {
  failed = true
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[admin] FAIL ${message}`)
  try {
    await writeFile(
      resultPath,
      `${JSON.stringify(
        {
          version: 1,
          completedAt: new Date().toISOString(),
          mode: 'isolated_real_backend_memory',
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
