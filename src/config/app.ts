const rawApiBaseUrl =
  typeof import.meta.env.VITE_API_BASE_URL === 'string'
    ? import.meta.env.VITE_API_BASE_URL.trim()
    : ''
const isLocalApiUrl = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(
  rawApiBaseUrl,
)

const resolveApiBaseUrl = () => {
  // `.env.local` 会被 Vite 的生产构建读取。若其中仍是开发机 localhost，
  // 生产包必须改走同源代理，否则部署后会错误访问每位用户自己的 3000 端口。
  if (import.meta.env.PROD && isLocalApiUrl) return ''
  if (rawApiBaseUrl) return rawApiBaseUrl
  if (import.meta.env.PROD) return ''
  return 'http://localhost:3000'
}

export const appConfig = {
  // 后端基础地址：
  // - 开发环境未配置时默认走 localhost:3000
  // - 生产环境未配置或误配为本机地址时走同源路径，便于 Nginx / Vite preview 代理
  apiBaseUrl: resolveApiBaseUrl(),
  useMockChat: (import.meta.env.VITE_USE_MOCK_CHAT ?? 'false') === 'true',
  digitalHumanVideoBasePath: '/videos/digital-human',
  ttsAuthToken: import.meta.env.VITE_TTS_AUTH_TOKEN || '',
  videoDebug: (import.meta.env.VITE_VIDEO_DEBUG ?? 'false') === 'true',
  demoMode: (import.meta.env.VITE_DEMO_MODE ?? 'true') === 'true',
} as const
