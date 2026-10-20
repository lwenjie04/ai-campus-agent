import { safeInternalPath } from '@/router/return-to'
import type { AuthIntent } from '@/store/auth-intent'

// 把已登录后的意图翻译成站内目标；send-question 由问答页消费，不在这里跳转。
export const intentDestination = (intent: AuthIntent): string | null => {
  if (intent.type === 'open-post') {
    return `/community/posts/${encodeURIComponent(intent.target)}`
  }
  if (intent.type === 'enter-admin') {
    return safeInternalPath(intent.target) || '/admin/review'
  }
  return null
}
