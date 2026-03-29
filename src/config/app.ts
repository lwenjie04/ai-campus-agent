const rawApiBaseUrl = typeof import.meta.env.VITE_API_BASE_URL === 'string' ? import.meta.env.VITE_API_BASE_URL.trim() : ''

const resolveApiBaseUrl = () => {
  if (rawApiBaseUrl) return rawApiBaseUrl
  if (import.meta.env.PROD) return ''
  return 'http://localhost:3000'
}

export const appConfig = {
  // 后端基础地址：
  // - 开发环境未配置时默认走 localhost:3000
  // - 生产环境未配置时默认走同源路径，便于 Nginx 反向代理
  apiBaseUrl: resolveApiBaseUrl(),
  useMockChat: (import.meta.env.VITE_USE_MOCK_CHAT ?? 'false') === 'true',
  digitalHumanVideoBasePath: '/videos/digital-human',
  ttsAuthToken: import.meta.env.VITE_TTS_AUTH_TOKEN || '',
  videoDebug: (import.meta.env.VITE_VIDEO_DEBUG ?? 'false') === 'true',
  demoMode: (import.meta.env.VITE_DEMO_MODE ?? 'true') === 'true',
} as const
