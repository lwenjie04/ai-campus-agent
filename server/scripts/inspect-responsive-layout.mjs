import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const targetUrl = process.env.RESPONSIVE_TARGET_URL || 'http://127.0.0.1:4173'
const viewportWidth = Number.parseInt(process.env.RESPONSIVE_VIEWPORT_WIDTH || '390', 10)
const viewportHeight = Number.parseInt(process.env.RESPONSIVE_VIEWPORT_HEIGHT || '844', 10)

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
].filter(Boolean)

const chromePath = chromeCandidates.find((candidate) => existsSync(candidate))
if (!chromePath) {
  console.error('[responsive] Chrome not found. Set CHROME_PATH and retry.')
  process.exit(1)
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const waitFor = async (check, label, timeoutMilliseconds = 15_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMilliseconds) {
    const value = await check().catch(() => undefined)
    if (value) return value
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

const sendCommand = (socket, id, method, params = {}) =>
  new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      const message = JSON.parse(String(event.data))
      if (message.id !== id) return
      socket.removeEventListener('message', handleMessage)
      if (message.error) reject(new Error(message.error.message || `${method} failed`))
      else resolve(message.result)
    }

    socket.addEventListener('message', handleMessage)
    socket.send(JSON.stringify({ id, method, params }))
  })

const profilePath = await mkdtemp(path.join(tmpdir(), 'campus-responsive-'))
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profilePath}`,
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true },
)

try {
  const activePortPath = path.join(profilePath, 'DevToolsActivePort')
  const activePort = await waitFor(
    async () => {
      if (!existsSync(activePortPath)) return undefined
      const [port] = (await readFile(activePortPath, 'utf8')).trim().split(/\r?\n/)
      return port
    },
    'Chrome DevTools port',
  )

  const pages = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${activePort}/json/list`)
    if (!response.ok) return undefined
    const targets = await response.json()
    return targets.filter((target) => target.type === 'page')
  }, 'Chrome page target')

  const page = pages[0]
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let commandId = 0
  const command = (method, params) => sendCommand(socket, ++commandId, method, params)

  await command('Page.enable')
  await command('Runtime.enable')
  await command('Emulation.setDeviceMetricsOverride', {
    width: viewportWidth,
    height: viewportHeight,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await command('Page.navigate', { url: targetUrl })

  await waitFor(
    async () => {
      const result = await command('Runtime.evaluate', {
        expression: 'document.readyState',
        returnByValue: true,
      })
      return result.result.value === 'complete'
    },
    'page load',
  )
  await sleep(700)

  const loginClick = await command('Runtime.evaluate', {
    expression: `(() => {
      const button = [...document.querySelectorAll('.top-nav__auth button')]
        .find((item) => item.textContent?.trim() === '登录')
      if (!button) return false
      button.click()
      return true
    })()`,
    returnByValue: true,
  })
  const loginDialogVisible = loginClick.result.value
    ? await waitFor(
        async () => {
          const result = await command('Runtime.evaluate', {
            expression: `Boolean(document.querySelector('.el-dialog.login-dialog')?.getBoundingClientRect().width)`,
            returnByValue: true,
          })
          return result.result.value === true
        },
        'lazy-loaded login dialog',
        8_000,
      ).catch(() => false)
    : false

  const expression = `(() => {
    const root = document.documentElement
    const width = root.clientWidth
    const elements = [...document.querySelectorAll('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName.toLowerCase(),
          classes: typeof element.className === 'string' ? element.className.trim().replace(/\\s+/g, '.') : '',
          left: Number(rect.left.toFixed(2)),
          right: Number(rect.right.toFixed(2)),
          width: Number(rect.width.toFixed(2)),
        }
      })
      .filter((item) => item.left < -1 || item.right > width + 1 || item.width > width + 1)
      .sort((a, b) => Math.max(b.right - width, -b.left) - Math.max(a.right - width, -a.left))
      .slice(0, 25)

    return {
      href: location.href,
      innerWidth: window.innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflowPixels: Math.max(0, root.scrollWidth - root.clientWidth),
      loginDialogVisible: ${loginDialogVisible ? 'true' : 'false'},
      elements,
    }
  })()`

  const result = await command('Runtime.evaluate', { expression, returnByValue: true })
  const report = result.result.value
  console.log(JSON.stringify(report, null, 2))

  socket.close()
  if (report.overflowPixels > 1 || report.elements.length > 0 || !report.loginDialogVisible) process.exitCode = 2
} finally {
  chrome.kill()
  await waitFor(() => chrome.exitCode !== null, 'Chrome shutdown', 3_000).catch(() => undefined)
  await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 })
}
