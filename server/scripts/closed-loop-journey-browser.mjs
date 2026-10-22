import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// 6.5 后台与社区闭环：失败注入→只重试生成→审核知识→问答来源回链，
// 普通账号越权、LightRAG 未配置、内存隔离模式。
process.env.AUTH_SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET || 'closed-loop-session-secret-32-chars'
const { issueSessionToken } = await import('../session.mjs')

const targetUrl = (process.env.CLOSED_LOOP_TARGET_URL || 'http://127.0.0.1:4176').replace(/\/$/, '')
const adminAccount = String(process.env.JOURNEY_ADMIN_ACCOUNT || 'admin').trim()
const adminPassword = String(process.env.JOURNEY_ADMIN_PASSWORD || '').trim()
const resultPath = String(process.env.CLOSED_LOOP_RESULT_PATH || 'server/evals/latest-closed-loop-journey.json').trim()
const shotDir = String(process.env.CLOSED_LOOP_SHOT_DIR || 'docs/design/verify').trim()

if (!adminPassword) {
  console.error('[closed-loop] JOURNEY_ADMIN_PASSWORD is required')
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
  console.error('[closed-loop] Chrome not found. Set CHROME_PATH and retry.')
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
  console.log(`[closed-loop] PASS ${name}`)
}

const postTitle = '宿舍网络报修闭环联测'
const postContent = '先联系宿管登记，再在后勤系统提交报修工单，最后回访确认。'
const question = '宿舍网络报修闭环联测的具体流程是什么？'

const userToken = issueSessionToken({
  id: 'closed-loop-user',
  username: 'closed-loop-user@example.test',
  displayName: '普通同学',
  role: 'user',
}).accessToken
const userAuth = {
  loggedIn: true,
  role: 'user',
  displayName: '普通同学',
  username: 'closed-loop-user@example.test',
  userId: 'closed-loop-user',
  email: '',
  accessToken: userToken,
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
}

const profilePath = await mkdtemp(path.join(tmpdir(), 'campus-closed-loop-'))
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
  const requestCounts = { approve: 0, generate: 0, knowledgeApprove: 0 }
  const knowledgeApproveRequests = []
  const knowledgeApproveResponses = []
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
          else if (request.url.endsWith('/approve')) {
            if (request.url.includes('/knowledge/')) {
              requestCounts.knowledgeApprove += 1
              knowledgeApproveRequests.push({
                requestId: message.params.requestId,
                url: request.url,
              })
            } else requestCounts.approve += 1
          }
        }
        return
      }
      if (message.method === 'Network.responseReceived') {
        const response = message.params.response
        const request = knowledgeApproveRequests.find(
          (item) => item.requestId === message.params.requestId,
        )
        if (request) {
          knowledgeApproveResponses.push({
            requestId: message.params.requestId,
            url: request.url,
            status: response.status,
          })
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
  const api = (method, apiPath, body) =>
    evaluate(`(async () => {
      const raw = localStorage.getItem('ai-campus-agent.auth.v4')
      const token = raw ? JSON.parse(raw)?.accessToken : ''
      const response = await fetch('/api${apiPath}', {
        method: ${JSON.stringify(method)},
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        ${body === undefined ? '' : `body: ${JSON.stringify(JSON.stringify(body))},`}
      })
      return { status: response.status, body: await response.text() }
    })()`)
  const apiJson = async (method, apiPath, body) => {
    const result = await api(method, apiPath, body)
    return { ...result, json: result.body ? JSON.parse(result.body) : null }
  }
  const clickCardAction = (title, actionText) =>
    evaluate(`(() => {
      const card = [...document.querySelectorAll('.item-card')].find((item) => item.textContent?.includes(${JSON.stringify(title)}))
      if (!card) throw new Error('card not found: ' + ${JSON.stringify(title)})
      const button = [...card.querySelectorAll('button')].find((item) => item.textContent?.trim() === ${JSON.stringify(actionText)})
      if (!button) throw new Error('button not found: ' + ${JSON.stringify(actionText)})
      button.click()
      return true
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

  // 0. 管理员登录。
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
  const adminAuth = await evaluate(`localStorage.getItem('ai-campus-agent.auth.v4')`)
  record('管理员登录', adminAccount)

  // 1. 创建待审核帖子，作为闭环起点。
  const created = await apiJson('POST', '/community/posts', {
    authorName: '闭环同学',
    title: postTitle,
    content: postContent,
    category: 'life',
    tags: ['宿舍', '报修'],
  })
  if (created.status !== 200) throw new Error(`create post failed: ${created.status} ${created.body}`)
  const postId = created.json.data.id
  record('创建待审核帖子', postId)

  // 2. 后台：通过 + 生成失败 → 部分失败 → 只重试生成。
  await command('Page.navigate', { url: `${targetUrl}/admin/review` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'admin review load')
  await waitFor(
    async () => evaluate(`document.body.textContent.includes(${JSON.stringify(postTitle)})`),
    'pending post card',
  )
  await clickCardAction(postTitle, '通过并生成知识')
  await waitFor(
    async () => evaluate(`Boolean(document.querySelector('.knowledge-failure-panel'))`),
    'knowledge failure panel',
  )
  record('通过成功但生成失败有独立状态', 'partial panel')
  if (requestCounts.approve !== 1) throw new Error(`approve requests: ${requestCounts.approve}`)
  if (requestCounts.generate !== 1) throw new Error(`generate requests: ${requestCounts.generate}`)
  await screenshot('closed-loop-partial-failure-1440.png')

  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === '重试生成')
    if (!button) throw new Error('retry button missing')
    button.click()
    button.click()
    return true
  })()`)
  await waitFor(
    async () => !(await evaluate(`Boolean(document.querySelector('.knowledge-failure-panel'))`)),
    'partial panel cleared',
  )
  await sleep(400)
  record('只重试生成且不重复 approve', `approve=${requestCounts.approve} generate=${requestCounts.generate}`)
  if (requestCounts.approve !== 1) throw new Error('retry re-approved the post')
  if (requestCounts.generate !== 2) throw new Error(`generate retry requests: ${requestCounts.generate}`)

  // 3. 审核生成的知识 → 进入检索。
  const pendingKnowledge = await apiJson('GET', '/community/knowledge?status=pending')
  if (pendingKnowledge.status !== 200) throw new Error(`knowledge list failed: ${pendingKnowledge.status}`)
  const knowledgeItem = (pendingKnowledge.json.data?.list || []).find((item) => item.postId === postId)
  if (!knowledgeItem) throw new Error('generated knowledge not found')
  await clickCardAction(knowledgeItem.title, '审核并发布')
  if (requestCounts.knowledgeApprove !== 1) {
    throw new Error(`knowledge approve requests: ${requestCounts.knowledgeApprove}`)
  }
  const knowledgeApprovalRequest = knowledgeApproveRequests.find((request) =>
    request.url.includes(`/community/knowledge/${knowledgeItem.id}/approve`),
  )
  if (!knowledgeApprovalRequest) {
    throw new Error(`approval request did not target ${knowledgeItem.id}`)
  }
  const knowledgeApprovalResponse = await waitFor(
    async () =>
      knowledgeApproveResponses.find(
        (response) => response.requestId === knowledgeApprovalRequest.requestId,
      ),
    `knowledge approval response (${knowledgeApprovalRequest.url})`,
  )
  if (knowledgeApprovalResponse.status !== 200) {
    throw new Error(`knowledge approval returned HTTP ${knowledgeApprovalResponse.status}`)
  }
  await waitFor(
    async () => {
      const currentPending = await apiJson('GET', '/community/knowledge?status=pending')
      return (
        currentPending.status === 200 &&
        !(currentPending.json.data?.list || []).some((item) => item.id === knowledgeItem.id)
      )
    },
    'knowledge item approved',
  )
  const approvedKnowledge = await apiJson('GET', '/community/knowledge?status=approved')
  const approved = (approvedKnowledge.json.data?.list || []).find((item) => item.id === knowledgeItem.id)
  if (!approved) throw new Error('knowledge not approved in backend')
  record('知识审核通过并进入检索', knowledgeItem.id)

  // 4. 问答来源回链：社区经验来源 → 帖子详情。
  await command('Page.navigate', { url: `${targetUrl}/chat/new` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'chat load')
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.input-box textarea'))`), 'composer')
  await evaluate(`document.querySelector('.input-box textarea').focus()`)
  await command('Input.insertText', { text: question })
  await sleep(200)
  await evaluate(`document.querySelector('.send-btn').click()`)
  await waitFor(
    async () =>
      evaluate(`(() => {
        const rows = document.querySelectorAll('[data-role="assistant"]')
        const text = rows[rows.length - 1]?.querySelector('[data-testid="message-bubble"]')?.textContent?.trim() || ''
        return text.length > 20 && !document.querySelector('[data-testid="loading-indicator"]')
      })()`),
    'answer',
  )
  const rail = await waitFor(
    async () => {
      const value = await evaluate(`(() => {
        const cards = [...document.querySelectorAll('.source-rail .rail-source')]
        const hit = cards.find((card) => card.textContent?.includes('社区经验'))
        return hit
          ? {
              title: hit.querySelector('.rail-source__title')?.textContent?.trim() || '',
              tag: hit.querySelector('.rail-source__tag')?.textContent?.trim() || '',
              hasPostLink: Boolean([...hit.querySelectorAll('button')].find((item) => item.textContent?.includes('查看来源帖子'))),
            }
          : undefined
      })()`)
      return value
    },
    'community source card',
  )
  if (!rail.title.includes(postTitle)) throw new Error(`unexpected community source title: ${rail.title}`)
  if (rail.tag !== '社区经验') throw new Error(`unexpected source tag: ${rail.tag}`)
  if (!rail.hasPostLink) throw new Error('community source post link missing')
  record('问答返回社区来源', `${rail.tag} · ${rail.title}`)
  await screenshot('closed-loop-source-1440.png')

  await evaluate(`(() => {
    const card = [...document.querySelectorAll('.source-rail .rail-source')].find((item) => item.textContent?.includes('社区经验'))
    const button = [...card.querySelectorAll('button')].find((item) => item.textContent?.includes('查看来源帖子'))
    button.click()
    return true
  })()`)
  await waitFor(async () => (await pathname()) === `/community/posts/${postId}`, 'source post route').catch(
    async (error) => {
      throw new Error(
        `${error.message}: ${JSON.stringify({
          path: await pathname(),
          pageErrors: pageErrors.slice(-2),
        })}`,
      )
    },
  )
  await waitFor(
    async () => evaluate(`document.body.textContent.includes(${JSON.stringify(postTitle)})`),
    'source post detail',
  )
  record('来源回链到帖子详情', `/community/posts/${postId}`)

  // 5. LightRAG 未配置：检索页显示未连接，问答仍走关键词回退。
  await command('Page.navigate', { url: `${targetUrl}/admin/retrieval` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'retrieval load')
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.lightrag-panel'))`), 'retrieval panel')
  const retrievalState = await waitFor(async () => {
    const value = await evaluate(`(() => {
      const panel = document.querySelector('.lightrag-panel')
      return {
        text: panel?.textContent?.trim() || '',
        status: panel?.querySelector('.lr-card__value')?.textContent?.trim() || '',
        consoleEnabled: ![...panel.querySelectorAll('button')].find((item) => item.textContent?.includes('打开检索控制台'))?.disabled,
      }
    })()`)
    return value?.status ? value : undefined
  }, 'lightrag status')
  if (!retrievalState.text.includes('未连接') && retrievalState.consoleEnabled) {
    throw new Error(`unexpected LightRAG configured state: ${retrievalState.status}`)
  }
  record('LightRAG 未配置可降级', `status=${retrievalState.status || '未连接'}`)
  await screenshot('closed-loop-retrieval-1440.png')

  // 6. 普通账号越权：后台路由 403，后台接口 403。
  await evaluate(`localStorage.setItem('ai-campus-agent.auth.v4', ${JSON.stringify(JSON.stringify(userAuth))})`)
  await command('Page.navigate', { url: `${targetUrl}/admin/review` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'forbidden load')
  await waitFor(async () => (await pathname()) === '/403', 'forbidden route')
  const userAdminApi = await api('GET', '/community/review/posts')
  if (userAdminApi.status !== 403) throw new Error(`user admin API status: ${userAdminApi.status}`)
  record('普通账号越权被拒', 'route=/403 api=403')
  await screenshot('closed-loop-forbidden-1440.png')

  const result = {
    version: 1,
    completedAt: new Date().toISOString(),
    mode: 'isolated_memory_backend',
    targetUrl,
    ok: true,
    steps,
  }
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(`[closed-loop] PASS ${steps.length} steps`)
  void adminAuth
  process.exit(0)
} catch (error) {
  failed = true
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[closed-loop] FAIL ${message}`)
  try {
    await writeFile(
      resultPath,
      `${JSON.stringify(
        {
          version: 1,
          completedAt: new Date().toISOString(),
          mode: 'isolated_memory_backend',
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
