const baseUrl = String(process.env.COMPETITION_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const timeoutMs = Number.parseInt(process.env.COMPETITION_SMOKE_TIMEOUT_MS || '5000', 10)

const request = async (path, options = {}) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(`${baseUrl}${path}`, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

const checks = []
const record = (name, passed, detail) => checks.push({ name, passed, detail })

try {
  const health = await request('/health')
  const body = await health.json().catch(() => ({}))
  record('backend-health', health.status === 200 && body?.ok === true, `HTTP ${health.status}`)
} catch (error) {
  record('backend-health', false, error?.name === 'AbortError' ? 'timeout' : error?.message || 'request failed')
}

for (const path of ['/community/review/posts', '/api/lightrag/health']) {
  try {
    const response = await request(path)
    record(`anonymous-blocked:${path}`, response.status === 401, `HTTP ${response.status}`)
  } catch (error) {
    record(`anonymous-blocked:${path}`, false, error?.message || 'request failed')
  }
}

try {
  const response = await request('/chat/stream', {
    method: 'OPTIONS',
    headers: { Origin: process.env.CORS_ORIGIN || 'http://localhost:5173' },
  })
  const allowsCredentials = response.headers.get('access-control-allow-credentials') === 'true'
  const allowsAuthorization = String(response.headers.get('access-control-allow-headers') || '')
    .toLowerCase()
    .includes('authorization')
  record(
    'chat-cors-preflight',
    response.status === 204 && allowsCredentials && allowsAuthorization,
    `HTTP ${response.status}, credentials=${allowsCredentials}, authorization=${allowsAuthorization}`,
  )
} catch (error) {
  record('chat-cors-preflight', false, error?.message || 'request failed')
}

for (const check of checks) {
  console.log(`[competition-smoke] ${check.passed ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`)
}

const failed = checks.filter((check) => !check.passed)
if (failed.length > 0) {
  console.error(`[competition-smoke] NOT READY: ${failed.map((check) => check.name).join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`[competition-smoke] READY: ${checks.length} live HTTP checks passed`)
}
