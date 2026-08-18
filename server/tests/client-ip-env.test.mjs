import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('trusted proxy IPs are loaded from server/.env before client IP configuration is captured', async () => {
  const originalCwd = process.cwd()
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'ai-campus-client-ip-'))

  try {
    await mkdir(join(temporaryRoot, 'server'))
    await writeFile(join(temporaryRoot, 'server', '.env'), 'TRUSTED_PROXY_IPS=10.0.0.2\n', 'utf8')
    delete process.env.TRUSTED_PROXY_IPS
    process.chdir(temporaryRoot)

    const moduleUrl = new URL('../client-ip.mjs', import.meta.url)
    moduleUrl.searchParams.set('env-test', String(Date.now()))
    const { clientIpConfig, readRequestClientIp } = await import(moduleUrl.href)

    assert.deepEqual(clientIpConfig.trustedProxyIps, ['10.0.0.2'])
    assert.equal(
      readRequestClientIp(
        {
          headers: { 'x-forwarded-for': '198.51.100.10' },
          socket: { remoteAddress: '10.0.0.2' },
        },
        { trustProxy: true },
      ),
      '198.51.100.10',
    )
  } finally {
    process.chdir(originalCwd)
    delete process.env.TRUSTED_PROXY_IPS
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})
