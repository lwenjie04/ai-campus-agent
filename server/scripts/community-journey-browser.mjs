import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// 6.1 社区回归：登录、列表筛选入 URL、返回恢复筛选与滚动、详情切帖隔离、无效帖子。
const targetUrl = (process.env.COMMUNITY_TARGET_URL || 'http://127.0.0.1:4176').replace(/\/$/, '')
const adminAccount = String(process.env.JOURNEY_ADMIN_ACCOUNT || 'admin').trim()
const adminPassword = String(process.env.JOURNEY_ADMIN_PASSWORD || '').trim()
const resultPath = String(process.env.COMMUNITY_RESULT_PATH || 'server/evals/latest-community-journey.json').trim()
const shotDir = String(process.env.COMMUNITY_SHOT_DIR || 'docs/design/verify').trim()

if (!adminPassword) {
  console.error('[community] JOURNEY_ADMIN_PASSWORD is required')
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
  console.error('[community] Chrome not found. Set CHROME_PATH and retry.')
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
  console.log(`[community] PASS ${name}`)
}

const profilePath = await mkdtemp(path.join(tmpdir(), 'campus-community-'))
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
  const postSubmitRequests = []
  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(String(event.data))
      if (message.method !== 'Network.requestWillBeSent') return
      const request = message.params?.request
      if (
        request?.method === 'POST' &&
        typeof request.url === 'string' &&
        request.url.includes('/api/community/posts')
      ) {
        postSubmitRequests.push(request.url)
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
  const search = () => evaluate('location.search')
  const setInput = (selector, value) =>
    evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(selector)})
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(value)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return input.value
    })()`)

  await command('Page.enable')
  await command('Runtime.enable')
  await command('Network.enable')
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  // 0. 登录。
  await command('Page.navigate', { url: `${targetUrl}/` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'home load')
  await evaluate(`document.querySelector('.top-nav__auth button').click()`)
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.login-panel'))`), 'login panel')
  await setInput('.login-panel .login-form input', adminAccount)
  await evaluate(`(() => {
    const inputs = document.querySelectorAll('.login-panel .login-form input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inputs[1], ${JSON.stringify(adminPassword)})
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await evaluate(`document.querySelector('.login-submit').click()`)
  await waitFor(
    async () => evaluate(`(() => {
      const dialog = document.querySelector('.el-dialog.login-dialog')
      return !dialog || dialog.getBoundingClientRect().height === 0
    })()`),
    'login success',
  )
  record('管理员登录', adminAccount)

  // 1. 列表加载 + 关键词筛选入 URL。
  await command('Page.navigate', { url: `${targetUrl}/community` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'community load')
  await waitFor(
    async () => evaluate(`document.querySelectorAll('[data-testid="community-post-card"]').length > 0`),
    'community cards',
  )
  record('社区列表加载', 'cards visible')

  await setInput('.toolbar-search input', '转专业')
  await evaluate(`document.querySelector('.toolbar-search input').focus()`)
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' })
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
  const filteredSearch = await waitFor(
    async () => {
      const value = await search()
      return value.includes('q=') && decodeURIComponent(value).includes('转专业') ? value : undefined
    },
    'keyword in URL',
  )
  record('筛选写入 URL', filteredSearch)
  await screenshot('community-list-1440.png')

  // 2. 打开详情；返回时筛选与滚动位置恢复。
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 520,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await sleep(300)
  await evaluate('window.scrollTo(0, 420)')
  await sleep(200)
  const scrollBefore = await evaluate('window.scrollY')
  await evaluate(`document.querySelector('[data-testid="community-post-card"]').click()`)
  await waitFor(async () => (await pathname()).startsWith('/community/posts/'), 'post detail route')
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.detail-page .detail-content'))`), 'post detail content')
  record('打开帖子详情', await evaluate(`document.querySelector('.detail-header h1')?.textContent?.trim() || ''`))
  await screenshot('community-detail-1440.png')

  await evaluate('history.back()')
  await waitFor(async () => (await pathname()) === '/community', 'back to list')
  await waitFor(
    async () => evaluate(`document.querySelectorAll('[data-testid="community-post-card"]').length > 0`),
    'list after back',
  )
  const searchAfterBack = await search()
  if (!decodeURIComponent(searchAfterBack).includes('转专业')) {
    throw new Error(`filter lost after back: ${searchAfterBack}`)
  }
  await sleep(600)
  const scrollAfterBack = await evaluate('window.scrollY')
  if (scrollBefore > 100 && scrollAfterBack < scrollBefore - 120) {
    throw new Error(`scroll not restored: before=${scrollBefore} after=${scrollAfterBack}`)
  }
  record('返回恢复筛选与滚动', `q=转专业 scroll=${Math.round(scrollAfterBack)}`)

  // 3. 切帖隔离：无效帖子不显示旧内容，再回有效帖子能重新加载。
  await evaluate(`document.querySelector('[data-testid="community-post-card"]').click()`)
  const validPath = await waitFor(
    async () => {
      const current = await pathname()
      return current.startsWith('/community/posts/') ? current : undefined
    },
    'valid post again',
  )
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.detail-page .detail-content'))`), 'valid detail')
  const validTitle = await evaluate(`document.querySelector('.detail-header h1')?.textContent?.trim() || ''`)

  await command('Page.navigate', { url: `${targetUrl}/community/posts/not-exist-id` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'invalid post load')
  await waitFor(
    async () => evaluate(`(() => {
      const empty = document.querySelector('.detail-page .el-empty')
      return Boolean(empty) && empty.getBoundingClientRect().height > 0
    })()`),
    'invalid post empty state',
  )
  const staleTitle = await evaluate(`document.querySelector('.detail-page .detail-content')?.textContent?.trim() || ''`)
  if (staleTitle) throw new Error('invalid post still shows previous content')
  record('无效帖子不串旧内容', 'empty state')

  await command('Page.navigate', { url: `${targetUrl}${validPath}` })
  await waitFor(async () => evaluate('document.readyState === "complete"'), 'valid post reload')
  const reloadedTitle = await waitFor(
    async () =>
      evaluate(`(() => {
        const title = document.querySelector('.detail-header h1')?.textContent?.trim() || ''
        return title && title !== '正在加载帖子' ? title : undefined
      })()`),
    'reloaded valid post',
  )
  if (reloadedTitle !== validTitle) {
    throw new Error(`post reload mismatch: expected ${validTitle}, got ${reloadedTitle}`)
  }
  record('切帖按路由 ID 重新加载', reloadedTitle.slice(0, 30))

  // 4. 6.2 回复草稿：刷新后恢复，显式清空后消失。
  const setTextarea = (selector, value) =>
    evaluate(`(() => {
      const textarea = document.querySelector(${JSON.stringify(selector)})
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(textarea, ${JSON.stringify(value)})
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      return textarea.value
    })()`)
  const clickButtonByText = (text) =>
    evaluate(`(() => {
      const buttons = [...document.querySelectorAll('button')]
      const button = buttons.find((item) => item.textContent?.trim() === ${JSON.stringify(text)})
      if (!button) {
        const dialogs = [...document.querySelectorAll('.el-dialog')].map((item) => ({
          height: item.getBoundingClientRect().height,
          text: (item.innerText || '').slice(0, 200),
          buttons: [...item.querySelectorAll('button')].map((b) => b.textContent?.trim()).filter(Boolean),
        }))
        throw new Error(
          'button not found: ' + ${JSON.stringify(text)} +
          ' available=' + buttons.map((item) => item.textContent?.trim()).filter(Boolean).join('|') +
          ' dialogs=' + JSON.stringify(dialogs),
        )
      }
      button.click()
      return true
    })()`)

  await waitFor(async () => evaluate(`Boolean(document.querySelector('.reply-editor textarea'))`), 'reply form')
  await setTextarea('.reply-editor textarea', '这是未提交的回复草稿')
  await sleep(350)
  await command('Page.reload', {})
  await waitFor(async () => evaluate('document.readyState === "complete"'), 'reply reload')
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.reply-editor textarea'))`), 'reply form reloaded')
  const restoredReply = await waitFor(async () => {
    const value = await evaluate(`document.querySelector('.reply-editor textarea').value`)
    return value.includes('这是未提交的回复草稿') ? value : undefined
  }, 'reply draft restored')
  const replyHint = await evaluate(`Boolean(document.querySelector('.reply-editor .draft-hint'))`)
  if (!replyHint) throw new Error('reply draft hint missing')
  record('回复草稿刷新后恢复', restoredReply.slice(0, 20))

  await clickButtonByText('清空草稿')
  await sleep(250)
  const replyAfterDiscard = await evaluate(`document.querySelector('.reply-editor textarea')?.value || ''`)
  if (replyAfterDiscard) throw new Error('reply draft not cleared')
  record('回复草稿可显式清空', 'cleared')

  // 5. 回复提交：加载态 + 待审核提示。
  await setTextarea('.reply-editor textarea', '这是一条自动化联测回复')
  await command('Network.emulateNetworkConditions', {
    offline: false,
    latency: 900,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  await clickButtonByText('提交回复')
  const replyLoading = await waitFor(
    async () =>
      evaluate(`[...document.querySelectorAll('.reply-actions .el-button')].some((item) => item.className.includes('is-loading'))`),
    'reply loading state',
  )
  if (!replyLoading) throw new Error('reply submit button did not enter loading state')
  const replyNotice = await waitFor(
    async () => {
      const text = await evaluate(`document.querySelector('.reply-notice')?.textContent?.trim() || ''`)
      return text.includes('回复已提交') ? text : undefined
    },
    'reply pending notice',
    20_000,
  )
  await command('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  record('回复提交与待审核提示', replyNotice)

  // 6. 投稿草稿：取消保留、重开恢复、显式清空；提交防重复且只发一次请求。
  await command('Page.navigate', { url: `${targetUrl}/community` })
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'community list again')
  await waitFor(async () => evaluate(`document.querySelectorAll('[data-testid="community-post-card"]').length > 0`), 'list cards again')
  await clickButtonByText('发布帖子')
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.el-dialog textarea'))`), 'post dialog')

  const setDialogField = (selector, value, index = 0) =>
    evaluate(`(() => {
      const element = document.querySelectorAll(${JSON.stringify(selector)})[${index}]
      const proto = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      setter.call(element, ${JSON.stringify(value)})
      element.dispatchEvent(new Event('input', { bubbles: true }))
      return element.value
    })()`)

  await setDialogField('.el-dialog input', '自动化草稿标题', 2)
  await setDialogField('.el-dialog textarea', '自动化草稿正文', 0)
  await sleep(300)
  await clickButtonByText('取消')
  await sleep(250)
  await clickButtonByText('发布帖子')
  await waitFor(async () => evaluate(`Boolean(document.querySelector('.el-dialog textarea'))`), 'post dialog reopened')
  const restoredTitle = await evaluate(`document.querySelectorAll('.el-dialog input')[2]?.value || ''`)
  if (restoredTitle !== '自动化草稿标题') throw new Error(`post draft not restored: ${restoredTitle}`)
  record('投稿草稿关闭后保留', restoredTitle)

  await clickButtonByText('清空草稿')
  await sleep(250)
  const titleAfterDiscard = await evaluate(`document.querySelectorAll('.el-dialog input')[2]?.value || ''`)
  if (titleAfterDiscard) throw new Error('post draft not cleared explicitly')
  record('投稿草稿可显式清空', 'cleared')

  // 清空后弹窗可能被关闭，确保重新打开再提交。
  const waitForVisiblePostDialog = () =>
    waitFor(
      async () =>
        evaluate(`(() => {
          const dialog = [...document.querySelectorAll('.el-dialog')]
            .find((item) => Boolean(item.querySelector('textarea')))
          return Boolean(dialog) && dialog.getBoundingClientRect().height > 0
        })()`),
      'visible post dialog',
    )
  const dialogStillOpen = await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('.el-dialog')]
      .find((item) => Boolean(item.querySelector('textarea')))
    return Boolean(dialog) && dialog.getBoundingClientRect().height > 0
  })()`)
  if (!dialogStillOpen) {
    await clickButtonByText('发布帖子')
  }
  await waitForVisiblePostDialog()

  const requestCountBefore = await evaluate(
    `performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/api/community/posts')).length`,
  )
  postSubmitRequests.length = 0
  // 提交前再确保投稿弹窗可见（清空草稿后可能已关闭）。
  const ensurePostDialog = async () => {
    const visible = await evaluate(`(() => {
      const dialog = [...document.querySelectorAll('.el-dialog')]
        .find((item) => Boolean(item.querySelector('textarea')))
      return Boolean(dialog) && dialog.getBoundingClientRect().height > 0
    })()`)
    if (!visible) {
      await clickButtonByText('发布帖子')
      await waitForVisiblePostDialog()
    }
  }
  await ensurePostDialog()
  await setDialogField('.el-dialog input', '自动化联测帖子', 2)
  await setDialogField('.el-dialog textarea', '这是一条自动化联测投稿，用于验证防重复提交。', 0)
  await clickButtonByText('提交')
  await clickButtonByText('提交')
  await waitFor(
    async () => evaluate(`document.querySelector('.el-dialog') === null || !document.querySelector('.el-dialog')?.offsetParent || [...document.querySelectorAll('.el-dialog button')].some((item) => item.className.includes('is-loading'))`),
    'post submit loading',
  )
  const postNotice = await waitFor(
    async () => {
      const text = await evaluate(`document.querySelector('.submission-notice')?.textContent?.trim() || ''`)
      return text.includes('帖子已提交') ? text : undefined
    },
    'post pending notice',
    20_000,
  )
  await command('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  const requestCountAfter = await evaluate(
    `performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/api/community/posts')).length`,
  )
  if (postSubmitRequests.length !== 1) {
    throw new Error(`duplicate post submission: POST requests=${postSubmitRequests.length}`)
  }
  record('投稿提交与防重复', `${postNotice} POST=1 resourceDelta=${requestCountAfter - requestCountBefore}`)

  const result = {
    version: 1,
    completedAt: new Date().toISOString(),
    mode: 'isolated_real_backend_memory',
    targetUrl,
    ok: true,
    steps,
  }
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(`[community] PASS ${steps.length} steps`)
} catch (error) {
  failed = true
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[community] FAIL ${message}`)
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
