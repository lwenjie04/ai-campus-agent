import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { createRagGoldenSummary, isExpectedHit, isExpectedNoHit } from '../rag-golden-evaluator.mjs'

test('positive golden cases match an expected official source title', () => {
  assert.equal(
    isExpectedHit(
      { title: '广东第二师范学院学生考试规则（修订）' },
      { expectedTitleIncludes: ['广东第二师范学院学生考试规则'] },
    ),
    true,
  )
  assert.equal(isExpectedHit(null, { expectedTitleIncludes: ['学生考试规则'] }), false)
})

test('negative golden cases pass only when retrieval returns no candidates', () => {
  const item = { expectedNoHit: true }
  assert.equal(isExpectedNoHit([], item), true)
  assert.equal(isExpectedNoHit([{ title: '校历通知' }], item), false)
  assert.equal(isExpectedNoHit([], { expectedNoHit: false }), false)
})

test('summary enforces positive and negative thresholds independently', () => {
  const summary = createRagGoldenSummary(
    [{ passed: true }, { passed: true }, { passed: false }],
    [{ passed: true }, { passed: false }],
    { threshold: 2 / 3, negativeThreshold: 0.5 },
  )

  assert.equal(summary.status, 'pass')
  assert.equal(summary.total, 3)
  assert.equal(summary.top1Accuracy, 0.6667)
  assert.equal(summary.negativeTotal, 2)
  assert.equal(summary.negativeAccuracy, 0.5)

  const rejected = createRagGoldenSummary(
    [{ passed: true }, { passed: true }, { passed: false }],
    [{ passed: true }, { passed: false }],
    { threshold: 2 / 3, negativeThreshold: 1 },
  )
  assert.equal(rejected.status, 'fail')
})

test('Top 50 draft has the required category balance and review markers', () => {
  const base = JSON.parse(
    readFileSync(resolve('server/evals/campus-service-golden-questions.json'), 'utf8'),
  )
  const draft = JSON.parse(
    readFileSync(resolve('server/evals/campus-service-golden-questions-v2-draft.json'), 'utf8'),
  )
  const positives = [...base.items, ...draft.items]
  const categoryCounts = Object.fromEntries(
    ['teaching', 'exam', 'scholarship', 'life'].map((category) => [
      category,
      positives.filter((item) => item.category === category).length,
    ]),
  )
  const ids = positives.map((item) => item.id)

  assert.equal(positives.length, 50)
  assert.deepEqual(categoryCounts, { teaching: 15, exam: 10, scholarship: 15, life: 10 })
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(draft.items.every((item) => item.validationStatus === 'pending-human-review'))
  assert.ok(draft.items.every((item) => item.expectedTitleIncludes?.length > 0))
  assert.ok(draft.negativeItems.length >= 10)
  assert.ok(draft.negativeItems.every((item) => item.expectedNoHit === true))
})
