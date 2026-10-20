import { describe, expect, it } from 'vitest'
import { intentDestination } from '@/store/auth-intent-destination'
import type { AuthIntent } from '@/store/auth-intent'

const intent = (overrides: Partial<AuthIntent>): AuthIntent => ({
  intentId: 'intent_1',
  type: 'open-post',
  target: '',
  createdAt: 1,
  ...overrides,
})

describe('登录意图目标', () => {
  it('帖子意图回到原帖', () => {
    expect(intentDestination(intent({ type: 'open-post', target: 'post_1' }))).toBe(
      '/community/posts/post_1',
    )
    expect(intentDestination(intent({ type: 'open-post', target: 'a/b' }))).toBe(
      '/community/posts/a%2Fb',
    )
  })

  it('后台意图只接受站内路径', () => {
    expect(intentDestination(intent({ type: 'enter-admin', target: '/admin/review' }))).toBe(
      '/admin/review',
    )
    expect(intentDestination(intent({ type: 'enter-admin', target: 'https://evil.example' }))).toBe(
      '/admin/review',
    )
    expect(intentDestination(intent({ type: 'enter-admin', target: '//evil.example' }))).toBe(
      '/admin/review',
    )
  })

  it('发送与播放由各自页面消费，不产生跳转目标', () => {
    expect(intentDestination(intent({ type: 'send-question', target: '问题' }))).toBeNull()
    expect(intentDestination(intent({ type: 'play-answer', target: 'msg_1' }))).toBeNull()
  })
})
