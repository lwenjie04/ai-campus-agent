import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { createChatCancellation } from '../chat-cancellation.mjs'
import { requestLightRag } from '../lightrag.mjs'

const makeConnection = (onQuotaSettle) => {
  const req = new EventEmitter()
  req.aborted = false
  req.complete = true
  req.headers = {}
  req.socket = new EventEmitter()
  req.socket.destroyed = false
  const res = new EventEmitter()
  res.writableFinished = false
  res.destroyed = false
  return { req, res, cancellation: createChatCancellation(req, res, onQuotaSettle) }
}

test('client disconnect aborts LightRAG and rolls back before the first delta', async () => {
  const settlements = []
  const { res, cancellation } = makeConnection((outcome) => settlements.push(outcome))
  const originalFetch = globalThis.fetch
  let upstreamSignal
  globalThis.fetch = async (_url, options) => {
    upstreamSignal = options.signal
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
    })
  }
  const retrieval = requestLightRag('/query', { query: 'test' }, {
    signal: cancellation.signal,
    timeoutMs: 5_000,
  })

  try {
    res.emit('close')

    await assert.rejects(retrieval, { code: 'CLIENT_DISCONNECTED' })
    assert.equal(upstreamSignal.aborted, true)
    assert.deepEqual(settlements, ['rollback'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('a disconnect before the first model delta rolls back only once', () => {
  const settlements = []
  const { req, res, cancellation } = makeConnection((outcome) => settlements.push(outcome))
  let modelCancelled = false
  cancellation.signal.addEventListener('abort', () => { modelCancelled = true }, { once: true })

  req.emit('aborted')
  res.emit('close')

  assert.equal(modelCancelled, true)
  assert.deepEqual(settlements, ['rollback'])
})

test('a disconnect after the first model delta commits the guest attempt once', () => {
  const settlements = []
  const { res, cancellation } = makeConnection((outcome) => settlements.push(outcome))
  let modelCancelled = false
  cancellation.markFirstDelta()
  cancellation.signal.addEventListener('abort', () => { modelCancelled = true }, { once: true })

  res.emit('close')
  cancellation.settle('rollback')

  assert.equal(modelCancelled, true)
  assert.deepEqual(settlements, ['commit'])
})

test('a normally finished response is not reported as interrupted and commits once', () => {
  const settlements = []
  const { res, cancellation } = makeConnection((outcome) => settlements.push(outcome))
  res.writableFinished = true

  res.emit('finish')
  res.emit('close')
  cancellation.settle('commit')
  cancellation.settle('rollback')

  assert.equal(cancellation.signal.aborted, false)
  assert.deepEqual(settlements, ['commit'])
})

test('completion and disconnect racing after the first delta settle quota once', () => {
  for (const firstEvent of ['completion', 'disconnect']) {
    const settlements = []
    const { res, cancellation } = makeConnection((outcome) => settlements.push(outcome))
    cancellation.markFirstDelta()

    if (firstEvent === 'completion') {
      cancellation.settle('commit')
      cancellation.markResponseFinished()
      res.writableFinished = true
      res.emit('finish')
      res.emit('close')
      cancellation.settle('rollback')
    } else {
      res.emit('close')
      cancellation.settle('commit')
    }

    assert.deepEqual(settlements, ['commit'], `${firstEvent} should win exactly once`)
    assert.equal(cancellation.signal.aborted, firstEvent === 'disconnect')
  }
})
