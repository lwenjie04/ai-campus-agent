import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// 响应式检查：支持单宽度或宽度矩阵，输出溢出元素、关键控件可见性并落盘截图。
const targetUrl = process.env.RESPONSIVE_TARGET_URL || 'http://127.0.0.1:4173'
const viewportHeight = Number.parseInt(process.env.RESPONSIVE_VIEWPORT_HEIGHT || '844', 10)
const widthList = String(
  process.env.RESPONSIVE_WIDTHS || process.env.RESPONSIVE_VIEWPORT_WIDTH || '390',
)
  .split(',')
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isFinite(value) && value > 0)
const selectors = String(process.env.RESPONSIVE_SELECTORS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const screenshotPath = process.env.RESPONSIVE_SCREENSHOT_PATH
const screenshotDir = process.env.RESPONSIVE_SCREENSHOT_DIR
const screenshotName = process.env.RESPONSIVE_SCREENSHOT_NAME || 'page'
const resultPath = process.env.RESPONSIVE_RESULT_PATH
const openLogin = process.env.RESPONSIVE_OPEN_LOGIN !== 'false'

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

const resolveScreenshotPath = (width) => {
  if (screenshotDir) {
    return path.join(screenshotDir, `${screenshotName}-${width}.png`)
  }
  if (!screenshotPath) return ''
  if (widthList.length <= 1) return screenshotPath
  const extension = path.extname(screenshotPath)
  return `${screenshotPath.slice(0, -extension.length)}-${width}${extension}`
}

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

let socket
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

  socket = new WebSocket(pages[0].webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let commandId = 0
  const command = (method, params) => sendCommand(socket, ++commandId, method, params)
  const evaluate = async (expression) => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'evaluate failed')
    return result.result.value
  }

  await command('Page.enable')
  await command('Runtime.enable')

  const results = []

  for (const width of widthList) {
    await command('Emulation.setDeviceMetricsOverride', {
      width,
      height: viewportHeight,
      deviceScaleFactor: 1,
      mobile: width < 768,
    })
    await command('Page.navigate', { url: targetUrl })
    await waitFor(async () => (await evaluate('document.readyState')) === 'complete', `load ${width}`)
    await sleep(700)

    const shotPath = resolveScreenshotPath(width)
    if (shotPath) {
      const screenshot = await command('Page.captureScreenshot', { format: 'png', fromSurface: true })
      await writeFile(path.resolve(shotPath), Buffer.from(screenshot.data, 'base64'))
    }

    let loginDialogVisible = false
    if (openLogin) {
      const loginClick = await evaluate(`(() => {
        const button = [...document.querySelectorAll('.top-nav__auth button')]
          .find((item) => item.textContent?.trim() === '登录')
        if (!button) return false
        button.click()
        return true
      })()`)
      if (loginClick) {
        loginDialogVisible = await waitFor(
          async () => evaluate(`Boolean(document.querySelector('.el-dialog.login-dialog')?.getBoundingClientRect().width)`),
          'lazy-loaded login dialog',
          8_000,
        ).catch(() => false)
      }
    }

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

      const selectors = ${JSON.stringify(selectors)}
      const checks = selectors.map((selector) => {
        const element = document.querySelector(selector)
        if (!element) return { selector, found: false, visible: false, inViewport: false }
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        return {
          selector,
          found: true,
          visible,
          inViewport: visible && rect.top >= -1 && rect.bottom <= window.innerHeight + 1 && rect.left >= -1 && rect.right <= width + 1,
          rect: { top: Number(rect.top.toFixed(1)), bottom: Number(rect.bottom.toFixed(1)) },
        }
      })

      return {
        width: window.innerWidth,
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        overflowPixels: Math.max(0, root.scrollWidth - root.clientWidth),
        elements,
        checks,
        loginDialogVisible: ${loginDialogVisible ? 'true' : 'false'},
        screenshot: ${JSON.stringify(shotPath)},
      }
    })()`

    const report = await evaluate(expression)
    report.ok =
      report.overflowPixels <= 1 &&
      report.elements.length === 0 &&
      report.checks.every((check) => check.visible && check.inViewport) &&
      (!openLogin || report.loginDialogVisible)
    results.push(report)
    console.log(`[responsive] ${width}px -> overflow=${report.overflowPixels} checks=${report.checks.length} ok=${report.ok}`)
  }

  const summary = {
    version: 1,
    completedAt: new Date().toISOString(),
    targetUrl,
    widths: widthList,
    ok: results.every((result) => result.ok),
    results,
  }

  if (resultPath) {
    await writeFile(path.resolve(resultPath), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  }
  console.log(JSON.stringify(summary, null, 2))

  if (!summary.ok) process.exitCode = 2
} finally {
  try {
    socket?.close()
  } catch {
    // ignore
  }
  chrome.kill()
  await waitFor(() => chrome.exitCode !== null, 'Chrome shutdown', 3_000).catch(() => undefined)
  await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 })
}
