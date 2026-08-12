import { spawnSync } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const steps = [
  {
    id: 'assets',
    label: '产品资产与安全配置',
    command: process.execPath,
    args: ['server/scripts/check-release-assets.mjs'],
  },
  {
    id: 'server-syntax',
    label: '后端语法',
    command: process.execPath,
    args: ['server/scripts/check-server-syntax.mjs'],
  },
  {
    id: 'server-tests',
    label: '会话与游客额度测试',
    command: npmCommand,
    args: ['run', 'test:server'],
    shell: process.platform === 'win32',
  },
  {
    id: 'vector-ready',
    label: '知识切片与向量索引',
    command: npmCommand,
    args: ['run', 'kb:vector:check'],
    shell: process.platform === 'win32',
  },
  {
    id: 'rag-golden',
    label: 'Top 20 RAG 金标',
    command: npmCommand,
    args: ['run', 'rag:test:service'],
    shell: process.platform === 'win32',
  },
  {
    id: 'web-build',
    label: 'Web 生产构建',
    command: npmCommand,
    args: ['run', 'build'],
    shell: process.platform === 'win32',
  },
]

const results = []

for (const step of steps) {
  console.log('')
  console.log(`=== ${step.label} ===`)
  const startedAt = Date.now()
  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    shell: Boolean(step.shell),
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) console.error(`[release-check] ${step.label}: ${result.error.message}`)

  results.push({
    id: step.id,
    label: step.label,
    passed: result.status === 0,
    warningCount: ((result.stdout || '') + (result.stderr || '')).match(/\bWARN\b/g)?.length || 0,
    durationMs: Date.now() - startedAt,
  })
}

const failed = results.filter((result) => !result.passed)

console.log('')
console.log('=== 产品发布预检汇总 ===')
for (const result of results) {
  console.log(
    `${result.passed ? (result.warningCount > 0 ? 'WARN' : 'PASS') : 'FAIL'} ${result.label} (${(result.durationMs / 1000).toFixed(1)}s)`,
  )
}

if (failed.length > 0) {
  console.error(`[release-check] NOT READY: ${failed.map((item) => item.label).join('、')}`)
  process.exitCode = 1
} else {
  const warningCount = results.reduce((sum, result) => sum + result.warningCount, 0)
  console.log(
    warningCount > 0
      ? `[release-check] READY WITH WARNINGS: ${warningCount} item(s) require review before release`
      : '[release-check] READY: all P0 checks passed',
  )
}
