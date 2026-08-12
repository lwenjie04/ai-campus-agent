import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const targetUrl = process.env.REHEARSAL_TARGET_URL || 'http://127.0.0.1:4173'
const adminAccount = String(process.env.REHEARSAL_ADMIN_ACCOUNT || '').trim()
const adminPassword = String(process.env.REHEARSAL_ADMIN_PASSWORD || '').trim()
const rounds = Math.max(1, Number.parseInt(process.env.REHEARSAL_ROUNDS || '10', 10))
const resultPath = String(process.env.REHEARSAL_RESULT_PATH || '').trim()

if (!adminAccount || !adminPassword) {
  console.error('[browser-rehearsal] REHEARSAL_ADMIN_ACCOUNT and REHEARSAL_ADMIN_PASSWORD are required')
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
  console.error('[browser-rehearsal] Chrome not found. Set CHROME_PATH and retry.')
  process.exit(1)
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const waitFor = async (check, label, timeoutMilliseconds = 12_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMilliseconds) {
    const value = await check().catch(() => undefined)
    if (value) return value
    await sleep(80)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

const profilePath = await mkdtemp(path.join(tmpdir(), 'campus-rehearsal-'))
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

  const socket = new WebSocket(pages[0].webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let commandId = 0
  const command = (method, params) => sendCommand(socket, ++commandId, method, params)
  const evaluate = async (expression) => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'browser evaluation failed')
    return result.result.value
  }
  const waitForExpression = (expression, label, timeoutMilliseconds) =>
    waitFor(() => evaluate(expression), label, timeoutMilliseconds)

  await command('Page.enable')
  await command('Runtime.enable')
  await command('Network.enable')

  const setInputAndClick = (question) => `(() => {
    const input = document.querySelector('.input-box input')
    const button = document.querySelector('.input-box .send-btn')
    if (!input || !button) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(question)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    button.click()
    return true
  })()`

  const roundResults = []
  let communityClosureVerified = false
  const targetOrigin = new URL(targetUrl).origin
  for (let round = 1; round <= rounds; round += 1) {
    const startedAt = Date.now()
    await command('Page.navigate', { url: 'about:blank' })
    await waitForExpression(`document.readyState === 'complete'`, `round ${round} blank page`)
    await command('Storage.clearDataForOrigin', { origin: targetOrigin, storageTypes: 'all' })
    await command('Network.clearBrowserCookies')
    await command('Page.navigate', { url: targetUrl })
    await waitForExpression(
      `document.readyState === 'complete' && Boolean(document.querySelector('.input-box input'))`,
      `round ${round} home page`,
    )

    const firstQuestion = '普通本科生申请转专业需要什么条件？'
    const secondQuestion = '2026年上半年英语四六级什么时候报名？'
    if (!(await evaluate(setInputAndClick(firstQuestion)))) throw new Error(`round ${round}: first send control missing`)
    try {
      await waitForExpression(
        `(() => {
          const text = document.body.innerText
          const userQuestions = [...document.querySelectorAll('.message-row.is-user .content')]
          return text.includes('体验问答已完成')
            && text.includes('后端 Mock 回复')
            && text.includes('关于2025年普通本科生转专业工作的通知')
            && userQuestions.some((item) => item.textContent?.includes(${JSON.stringify(firstQuestion)}))
        })()`,
        `round ${round} first guest answer`,
      )
    } catch (error) {
      const snapshot = await evaluate(`(() => ({
        guestText: document.querySelector('.guest-trial')?.innerText || '',
        messages: [...document.querySelectorAll('.message-row')].map((item) => ({
          role: item.getAttribute('data-role'),
          text: item.querySelector('.content')?.textContent || '',
        })),
        bodyTail: document.body.innerText.slice(-1000),
      }))()`)
      throw new Error(`${error.message}\nround ${round} snapshot: ${JSON.stringify(snapshot)}`)
    }

    if (!(await evaluate(setInputAndClick(secondQuestion)))) throw new Error(`round ${round}: second send control missing`)
    await waitForExpression(
      `Boolean(document.querySelector('.el-dialog.login-dialog input'))`,
      `round ${round} login dialog`,
    )

    const loginSubmitted = await evaluate(`(() => {
      const inputs = [...document.querySelectorAll('.el-dialog.login-dialog input')]
      const button = [...document.querySelectorAll('.el-dialog.login-dialog button')]
        .find((item) => item.textContent?.includes('登录并进入系统'))
      if (inputs.length < 2 || !button) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(inputs[0], ${JSON.stringify(adminAccount)})
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
      setter.call(inputs[1], ${JSON.stringify(adminPassword)})
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
      button.click()
      return true
    })()`)
    if (!loginSubmitted) throw new Error(`round ${round}: login controls missing`)

    try {
      await waitForExpression(
        `(() => {
          const role = document.querySelector('.top-nav__auth-role')?.textContent?.trim()
          const secondQuestions = [...document.querySelectorAll('.message-row.is-user .content')]
            .filter((item) => item.textContent?.includes(${JSON.stringify(secondQuestion)}))
          const assistantTexts = [...document.querySelectorAll('.message-row.is-assistant .content')]
            .map((item) => item.textContent || '')
          return role === '管理员'
            && secondQuestions.length === 1
            && assistantTexts.length >= 3
            && assistantTexts.at(-1).includes('后端 Mock 回复')
        })()`,
        `round ${round} authenticated auto-resume`,
        15_000,
      )
    } catch (error) {
      const snapshot = await evaluate(`(() => ({
        role: document.querySelector('.top-nav__auth-role')?.textContent?.trim() || '',
        loginDialog: document.querySelector('.el-dialog.login-dialog')?.innerText || '',
        toast: [...document.querySelectorAll('.el-message')].map((item) => item.textContent || ''),
        messages: [...document.querySelectorAll('.message-row')].map((item) => ({
          role: item.getAttribute('data-role'),
          text: item.querySelector('.content')?.textContent || '',
        })),
      }))()`)
      throw new Error(`${error.message}\nround ${round} snapshot: ${JSON.stringify(snapshot)}`)
    }

    if (round === 1) {
      const adminOpened = await evaluate(`(() => {
        const button = [...document.querySelectorAll('.top-nav__tabs button')]
          .find((item) => item.textContent?.trim() === '管理员页')
        if (!button) return false
        button.click()
        return true
      })()`)
      if (!adminOpened) throw new Error('round 1: administrator navigation is unavailable')
      await waitForExpression(
        `document.body.innerText.includes('学生社区审核中心')
          && [...document.querySelectorAll('button')].some((item) => item.textContent?.trim() === '生成社区知识')`,
        'round 1 knowledge candidate',
        20_000,
      )

      await evaluate(`(() => {
        const button = [...document.querySelectorAll('button')]
          .find((item) => item.textContent?.trim() === '生成社区知识')
        button?.click()
        return Boolean(button)
      })()`)
      await waitForExpression(
        `[...document.querySelectorAll('button')].some((item) => item.textContent?.trim() === '通过')`,
        'round 1 pending community knowledge',
        20_000,
      )
      await evaluate(`(() => {
        const button = [...document.querySelectorAll('button')]
          .find((item) => item.textContent?.trim() === '通过')
        button?.click()
        return Boolean(button)
      })()`)
      await waitForExpression(
        `[...document.querySelectorAll('.el-message')].some((item) => item.textContent?.includes('社区知识已审核通过'))`,
        'round 1 community knowledge approval',
        20_000,
      )

      await evaluate(`(() => {
        const button = [...document.querySelectorAll('.top-nav__tabs button')]
          .find((item) => item.textContent?.trim() === '首页')
        button?.click()
        return Boolean(button)
      })()`)
      await waitForExpression(`Boolean(document.querySelector('.input-box input'))`, 'round 1 return home')
      const communityQuestion = '转专业后课程补退选怎么操作？'
      await evaluate(setInputAndClick(communityQuestion))
      await waitForExpression(
        `(() => {
          const asked = [...document.querySelectorAll('.message-row.is-user .content')]
            .some((item) => item.textContent?.includes(${JSON.stringify(communityQuestion)}))
          const source = [...document.querySelectorAll('.source-link')]
            .some((item) => item.textContent?.includes('学生社区经验总结：转专业后课程补退选怎么操作'))
          const warning = document.body.innerText.includes('仅供参考，请以学校最新官方通知为准')
          return asked && source && warning
        })()`,
        'round 1 approved community knowledge in RAG',
        25_000,
      )
      communityClosureVerified = true
      console.log('[browser-rehearsal] PASS community review -> approval -> RAG source closure')
    }

    const durationMs = Date.now() - startedAt
    roundResults.push({ round, passed: true, durationMs })
    console.log(`[browser-rehearsal] PASS round ${round}/${rounds} (${(durationMs / 1000).toFixed(2)}s)`)
  }

  socket.close()
  const totalMs = roundResults.reduce((sum, result) => sum + result.durationMs, 0)
  console.log(
    `[browser-rehearsal] READY: ${roundResults.length}/${rounds} guest-login-resume rounds passed in ${(totalMs / 1000).toFixed(1)}s`,
  )
  if (resultPath) {
    await writeFile(
      resultPath,
      `${JSON.stringify(
        {
          version: 1,
          completedAt: new Date().toISOString(),
          mode: process.env.REHEARSAL_PROFILE || 'isolated_mock',
          targetUrl,
          requestedRounds: rounds,
          passedRounds: roundResults.length,
          communityClosureVerified,
          totalDurationMs: totalMs,
          rounds: roundResults,
          assertions: [
            'fresh guest storage each round',
            'first guest answer completes',
            'official transfer notice appears in sources',
            'second question opens login',
            'administrator session is established',
            'saved second question auto-resumes exactly once',
            'administrator generates and approves community knowledge',
            'approved community knowledge returns as a labeled RAG source',
          ],
          serviceProfile: {
            llm: process.env.REHEARSAL_LLM_MODE || 'mock',
            lightrag: process.env.REHEARSAL_LIGHTRAG_MODE || 'disabled',
            tts: process.env.REHEARSAL_TTS_MODE || 'disabled',
            mysql: process.env.REHEARSAL_MYSQL_MODE || 'offline_memory_auth',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    console.log(`[browser-rehearsal] evidence written: ${resultPath}`)
  }
} finally {
  chrome.kill()
  await waitFor(() => chrome.exitCode !== null, 'Chrome shutdown', 3_000).catch(() => undefined)
  await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 })
}
