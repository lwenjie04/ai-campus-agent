import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const resultPath = resolve(
  process.env.JOURNEY_RESULT_PATH || 'server/evals/latest-service-journey.json',
)
const report = JSON.parse(await readFile(resultPath, 'utf8'))

assert.ok(report.passedRounds >= 10, 'service journey must pass at least 10 rounds')
assert.equal(report.communityClosureVerified, true, 'community RAG closure must pass')
assert.equal(
  report.pendingQuestionRecoveryVerified,
  true,
  'pending question recovery must survive reload and require confirmation',
)

console.log(
  `[service-journey] verified ${report.passedRounds}/${report.requestedRounds} rounds; ` +
    'community closure and pending-question recovery passed',
)
