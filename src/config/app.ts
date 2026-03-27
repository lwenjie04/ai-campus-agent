// 前端运行时配置统一从这里读取，避免在组件中散落环境变量判断。
export const appConfig = {
  // 后端基础地址：聊天、TTS、下载等请求都会基于它拼接。
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  // 是否启用前端 mock 聊天，便于后端未启动时调试界面。
  useMockChat: (import.meta.env.VITE_USE_MOCK_CHAT ?? 'false') === 'true',
  // 数字人视频的公共资源目录。
  digitalHumanVideoBasePath: '/videos/digital-human',
  // 后端 TTS 鉴权令牌，存在时会放进 Authorization 请求头。
  ttsAuthToken: import.meta.env.VITE_TTS_AUTH_TOKEN || '',
  // 是否显示数字人调试信息面板。
  videoDebug: (import.meta.env.VITE_VIDEO_DEBUG ?? 'false') === 'true',
  // 演示模式开关，可用于答辩或展示时切换固定行为。
  demoMode: (import.meta.env.VITE_DEMO_MODE ?? 'true') === 'true',
} as const
