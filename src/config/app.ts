export const appConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  useMockChat: (import.meta.env.VITE_USE_MOCK_CHAT ?? 'false') === 'true',
  digitalHumanVideoBasePath: '/videos/digital-human',
  ttsAuthToken: import.meta.env.VITE_TTS_AUTH_TOKEN || '',
} as const
