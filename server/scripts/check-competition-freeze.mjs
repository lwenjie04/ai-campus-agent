import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const failures = []
const passes = []

const precheck = spawnSync(process.execPath, ['server/scripts/competition-check.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, COMPETITION_STRICT_CONFIG: 'true', FORCE_COLOR: '0', NO_COLOR: '1' },
})
if (precheck.stdout) process.stdout.write(precheck.stdout)
if (precheck.stderr) process.stderr.write(precheck.stderr)
if (precheck.status === 0) passes.push('strict competition precheck')
else failures.push('strict competition precheck')

const rehearsalPath = resolve(root, 'server/evals/latest-browser-rehearsal.json')
if (!existsSync(rehearsalPath)) {
  failures.push('10-round browser rehearsal evidence is missing')
} else {
  try {
    const rehearsal = JSON.parse(readFileSync(rehearsalPath, 'utf8'))
    if (
      rehearsal.mode === 'isolated_mock' &&
      Number(rehearsal.passedRounds) >= 10 &&
      rehearsal.communityClosureVerified === true
    ) {
      passes.push(
        `isolated browser rehearsal ${rehearsal.passedRounds}/${rehearsal.requestedRounds} with community closure`,
      )
    } else {
      failures.push('browser rehearsal evidence is incomplete or not the expected isolated profile')
    }
  } catch {
    failures.push('browser rehearsal evidence is invalid JSON')
  }
}

if (process.env.COMPETITION_LIVE_REHEARSAL_CONFIRMED === 'true') {
  passes.push('live competition-machine rehearsal confirmed')
} else {
  failures.push('set COMPETITION_LIVE_REHEARSAL_CONFIRMED=true only after a real model/TTS/MySQL rehearsal')
}

const gitStatus = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })
if (gitStatus.status !== 0) {
  failures.push('unable to inspect Git status')
} else if (gitStatus.stdout.trim()) {
  failures.push('Git worktree is not clean; create the fixed competition commit before freeze')
} else {
  passes.push('Git worktree is clean')
}

console.log('')
console.log('=== 比赛冻结验收 ===')
for (const item of passes) console.log(`[freeze] PASS ${item}`)
for (const item of failures) console.error(`[freeze] FAIL ${item}`)

if (failures.length > 0) {
  console.error(`[freeze] NOT FROZEN: ${failures.length} gate(s) remain`)
  process.exitCode = 1
} else {
  console.log('[freeze] FROZEN: all release gates passed')
}
