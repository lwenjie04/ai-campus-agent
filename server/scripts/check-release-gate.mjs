import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const failures = []
const passes = []

const precheck = spawnSync(process.execPath, ['server/scripts/release-check.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, RELEASE_STRICT_CONFIG: 'true', FORCE_COLOR: '0', NO_COLOR: '1' },
})
if (precheck.stdout) process.stdout.write(precheck.stdout)
if (precheck.stderr) process.stderr.write(precheck.stderr)
if (precheck.status === 0) passes.push('strict product release precheck')
else failures.push('strict product release precheck')

const journeyPath = resolve(root, 'server/evals/latest-service-journey.json')
if (!existsSync(journeyPath)) {
  failures.push('10-round service journey evidence is missing')
} else {
  try {
    const journey = JSON.parse(readFileSync(journeyPath, 'utf8'))
    if (
      journey.mode === 'isolated_mock' &&
      Number(journey.passedRounds) >= 10 &&
      journey.communityClosureVerified === true &&
      journey.pendingQuestionRecoveryVerified === true
    ) {
      passes.push(
        `isolated service journey ${journey.passedRounds}/${journey.requestedRounds} with question recovery and community closure`,
      )
    } else {
      failures.push('service journey evidence lacks question recovery, community closure, or the expected profile')
    }
  } catch {
    failures.push('service journey evidence is invalid JSON')
  }
}

if (process.env.RELEASE_LIVE_VALIDATION_CONFIRMED === 'true') {
  passes.push('live target-environment validation confirmed')
} else {
  failures.push('set RELEASE_LIVE_VALIDATION_CONFIRMED=true only after real model/TTS/MySQL validation')
}

const gitStatus = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })
if (gitStatus.status !== 0) {
  failures.push('unable to inspect Git status')
} else if (gitStatus.stdout.trim()) {
  failures.push('Git worktree is not clean; create a fixed product release commit')
} else {
  passes.push('Git worktree is clean')
}

console.log('')
console.log('=== 产品严格发布门槛 ===')
for (const item of passes) console.log(`[release-gate] PASS ${item}`)
for (const item of failures) console.error(`[release-gate] FAIL ${item}`)

if (failures.length > 0) {
  console.error(`[release-gate] BLOCKED: ${failures.length} gate(s) remain`)
  process.exitCode = 1
} else {
  console.log('[release-gate] READY: all release gates passed')
}
