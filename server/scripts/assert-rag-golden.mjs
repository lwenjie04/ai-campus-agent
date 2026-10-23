import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [resultPath = 'server/evals/latest-rag-golden-ci.json', expectedCountArg = '20', minimumNegativeCountArg = '0'] =
  process.argv.slice(2)
const expectedCount = Number(expectedCountArg)
const minimumNegativeCount = Number(minimumNegativeCountArg)
const report = JSON.parse(await readFile(resultPath, 'utf8'))

assert.equal(report.summary.total, expectedCount, `expected exactly ${expectedCount} golden items`)
assert.equal(report.summary.status, 'pass', 'golden threshold must pass')
assert.ok(report.summary.passed >= Math.ceil(expectedCount * report.summary.threshold))
assert.ok(
  report.summary.negativeTotal >= minimumNegativeCount,
  `expected at least ${minimumNegativeCount} negative items`,
)
assert.ok(
  report.summary.negativeAccuracy >= report.summary.negativeThreshold,
  'negative rejection threshold must pass',
)
assert.ok(report.results.every((item) => typeof item.passed === 'boolean'))

console.log(
  `[rag-golden] verified ${report.summary.passed}/${report.summary.total}; ` +
    `top1=${(report.summary.top1Accuracy * 100).toFixed(1)}%; ` +
    `threshold=${(report.summary.threshold * 100).toFixed(1)}%; ` +
    `negative=${report.summary.negativePassed}/${report.summary.negativeTotal}`,
)
