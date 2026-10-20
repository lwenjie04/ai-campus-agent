const rawApiBaseUrl =
  typeof import.meta.env.VITE_API_BASE_URL === 'string'
    ? import.meta.env.VITE_API_BASE_URL.trim()
    : ''
const isLocalApiUrl = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i
const isAbsoluteUrl = /^https?:\/\//i

// 统一 API 根，集中处理三件事：
// 1. 默认根为同源 /api，页面路由（/chat、/community）不再与接口共用前缀；
// 2. 允许配置绝对 API 根（如 https://service.example/api）；只给 origin 时会自动补 /api；
// 3. 生产包若仍指向开发机 localhost，回退到同源 /api，避免部署后访问用户自己的 3000 端口。
const resolveApiBaseUrl = () => {
  if (!rawApiBaseUrl) return '/api'
  const normalized = rawApiBaseUrl.replace(/\/+$/, '')
  if (import.meta.env.PROD && isLocalApiUrl.test(normalized)) return '/api'
  return /\/api$/i.test(normalized) ? normalized : `${normalized}/api`
}

export const appConfig = {
  // 后端 API 根（已包含 /api）：开发默认同源代理，生产默认同源反代。
  apiBaseUrl: resolveApiBaseUrl(),
  useMockChat: (import.meta.env.VITE_USE_MOCK_CHAT ?? 'false') === 'true',
  digitalHumanVideoBasePath: '/videos/digital-human',
  ttsAuthToken: import.meta.env.VITE_TTS_AUTH_TOKEN || '',
  videoDebug: (import.meta.env.VITE_VIDEO_DEBUG ?? 'false') === 'true',
  lightragConsoleUrl: String(import.meta.env.VITE_LIGHTRAG_CONSOLE_URL || '').trim().replace(/\/$/, ''),
} as const

// 调用方只传接口路径，不手拼 /api 前缀，也不会出现 /api/api 叠加。
export const apiUrl = (path: string) => {
  if (!path) return ''
  if (isAbsoluteUrl.test(path)) return path

  const normalized = path.startsWith('/') ? path : `/${path}`
  if (normalized === '/api' || normalized.startsWith('/api/')) return normalized

  return `${appConfig.apiBaseUrl}${normalized}`
}
