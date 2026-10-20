import { afterEach, describe, expect, it, vi } from 'vitest'

const loadConfig = async (baseUrl: string) => {
  vi.resetModules()
  vi.stubEnv('VITE_API_BASE_URL', baseUrl)
  return import('@/config/app')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('apiUrl', () => {
  it('未配置时使用同源 /api', async () => {
    const { apiUrl } = await loadConfig('')

    expect(apiUrl('/chat')).toBe('/api/chat')
    expect(apiUrl('/tts')).toBe('/api/tts')
    expect(apiUrl('auth/login')).toBe('/api/auth/login')
  })

  it('只给 origin 时自动补 /api', async () => {
    const { apiUrl } = await loadConfig('http://localhost:3000')

    expect(apiUrl('/chat/stream')).toBe('http://localhost:3000/api/chat/stream')
  })

  it('完整 API 根保持原样', async () => {
    const { apiUrl } = await loadConfig('https://service.example/api')

    expect(apiUrl('/community/posts')).toBe('https://service.example/api/community/posts')
  })

  it('不重复叠加 /api，绝对链接透传', async () => {
    const { apiUrl } = await loadConfig('http://localhost:3000')

    expect(apiUrl('/api/kb/download?id=1')).toBe('/api/kb/download?id=1')
    expect(apiUrl('https://www.gdei.edu.cn/notice/1')).toBe('https://www.gdei.edu.cn/notice/1')
  })
})
