import assert from 'node:assert/strict'
import test from 'node:test'

process.env.TRUSTED_PROXY_IPS = '127.0.0.1,::1,10.0.0.2'
const { readRequestClientIp } = await import('../client-ip.mjs')

const requestWith = ({ peer = '127.0.0.1', forwarded = '' } = {}) => ({
  headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
  socket: { remoteAddress: peer },
})

test('proxy headers are ignored when trustProxy is disabled', () => {
  const ip = readRequestClientIp(requestWith({ forwarded: '198.51.100.10' }), { trustProxy: false })
  assert.equal(ip, '127.0.0.1')
})

test('proxy headers are ignored when the direct peer is not trusted', () => {
  const ip = readRequestClientIp(
    requestWith({ peer: '203.0.113.9', forwarded: '198.51.100.10' }),
    { trustProxy: true },
  )
  assert.equal(ip, '203.0.113.9')
})

test('trusted proxy chain returns the nearest untrusted client and ignores spoofed prefixes', () => {
  const ip = readRequestClientIp(
    requestWith({ peer: '127.0.0.1', forwarded: '198.51.100.77, 203.0.113.21, 10.0.0.2' }),
    { trustProxy: true },
  )
  assert.equal(ip, '203.0.113.21')
})

test('single trusted reverse proxy accepts its overwritten client IP', () => {
  const ip = readRequestClientIp(requestWith({ forwarded: '198.51.100.10' }), { trustProxy: true })
  assert.equal(ip, '198.51.100.10')
})
