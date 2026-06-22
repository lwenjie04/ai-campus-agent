const rawApiBaseUrl = typeof import.meta.env.VITE_API_BASE_URL === 'string' ? import.meta.env.VITE_API_BASE_URL.trim() : ''

const resolveApiBaseUrl = () => {
  if (rawApiBaseUrl) return rawApiBaseUrl
  if (import.meta.env.PROD) return ''
  const hostname = typeof window === 'undefined' ? '127.0.0.1' : window.location.hostname
  return `http://${hostname}:3000`
}

export const appConfig = {
  // 后端基础地址：
  // - 开发环境未配置时使用当前页面主机的 3000 端口，兼容局域网手机访问
  // - 生产环境未配置时默认走同源路径，便于 Nginx 反向代理
  apiBaseUrl: resolveApiBaseUrl(),
  useMockChat: (import.meta.env.VITE_USE_MOCK_CHAT ?? 'false') === 'true',
  ttsAuthToken: import.meta.env.VITE_TTS_AUTH_TOKEN || '',
  demoMode: (import.meta.env.VITE_DEMO_MODE ?? 'true') === 'true',
} as const
