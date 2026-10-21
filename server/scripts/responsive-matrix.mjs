import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// 2.5：对首页和问答页跑 360/390/768/1024/1440 宽度矩阵，汇总溢出与关键控件可见性。
const baseUrl = (process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:4176').replace(/\/$/, '')
const widths = String(process.env.RESPONSIVE_WIDTHS || '360,390,768,1024,1440')
const height = String(process.env.RESPONSIVE_VIEWPORT_HEIGHT || '900')
const shotDir = path.resolve(process.env.RESPONSIVE_SHOT_DIR || 'docs/design/verify/responsive')
const resultPath = path.resolve(process.env.RESPONSIVE_MATRIX_RESULT || 'server/evals/latest-responsive-matrix.json')
const inspectScript = path.resolve('server/scripts/inspect-responsive-layout.mjs')

const targets = [
  { name: 'home', path: '/', selector: '.hero__cta' },
  { name: 'chat', path: '/chat/new', selector: '.composer .send-btn' },
]

await mkdir(shotDir, { recursive: true })
const tempDir = await mkdtemp(path.join(tmpdir(), 'campus-responsive-matrix-'))
const results = []
let failed = false

const runInspect = (target, resultFile) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [inspectScript], {
      env: {
        ...process.env,
        RESPONSIVE_TARGET_URL: `${baseUrl}${target.path}`,
        RESPONSIVE_WIDTHS: widths,
        RESPONSIVE_VIEWPORT_HEIGHT: height,
        RESPONSIVE_SELECTORS: target.selector,
        RESPONSIVE_SCREENSHOT_DIR: shotDir,
        RESPONSIVE_SCREENSHOT_NAME: target.name,
        RESPONSIVE_RESULT_PATH: resultFile,
        RESPONSIVE_OPEN_LOGIN: 'false',
      },
      stdio: 'ignore',
      windowsHide: true,
    })
    child.on('exit', (code) => resolve(code ?? 1))
    child.on('error', () => resolve(1))
  })

try {
  for (const target of targets) {
    const resultFile = path.join(tempDir, `${target.name}.json`)
    const exitCode = await runInspect(target, resultFile)
    let report
    try {
      report = JSON.parse(await readFile(resultFile, 'utf8'))
    } catch {
      report = { ok: false, results: [], error: `inspect exited ${exitCode} without result` }
    }
    results.push({ target: target.name, selector: target.selector, ...report })
    if (!report.ok) failed = true
    console.log(
      `[responsive-matrix] ${target.name}: ok=${report.ok} widths=${(report.results || []).length}`,
    )
  }
} finally {
  await rm(tempDir, { recursive: true, force: true }).catch(() => {})
}

const summary = {
  version: 1,
  completedAt: new Date().toISOString(),
  baseUrl,
  widths: widths.split(',').map((value) => Number.parseInt(value, 10)),
  ok: !failed && results.every((item) => item.ok),
  results,
}

await writeFile(resultPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
console.log(`[responsive-matrix] ${summary.ok ? 'PASS' : 'FAIL'} -> ${resultPath}`)
process.exit(summary.ok ? 0 : 2)
