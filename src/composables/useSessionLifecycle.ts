import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAgentStore } from '@/store/agent'
import { useAuthStore } from '@/store/auth'
import { resolveOwnerScope, useConversationsStore } from '@/store/conversations'

// 登录/退出时的身份生命周期：
// - 登录只接纳“当前这一条”有内容的游客会话，其余匿名历史留在游客空间；
// - 退出立即停媒体、清空当前界面并切回游客空间，避免账号 A 的内容留在屏幕上。
export const useSessionLifecycle = () => {
  const auth = useAuthStore()
  const agent = useAgentStore()
  const conversations = useConversationsStore()
  const router = useRouter()
  const route = useRoute()

  const currentScope = () => resolveOwnerScope(auth.loggedIn ? auth.userId : '')
  let lastScope = currentScope()

  const adoptActiveGuestConversation = (nextScope: string) => {
    const active = conversations.active
    if (!active || !active.ownerScope.startsWith('guest:')) return ''
    if (active.ownerScope === nextScope) return ''
    if (!conversations.hasUserContent(active)) return ''

    conversations.flush()
    const conversationId = active.conversationId
    const moved = conversations.moveConversationToScope(conversationId, active.ownerScope, nextScope)
    return moved ? conversationId : ''
  }

  const handleAuthChange = () => {
    const nextScope = currentScope()
    if (nextScope === lastScope) return

    if (nextScope.startsWith('user:')) {
      const adoptedId = adoptActiveGuestConversation(nextScope)
      conversations.openScope(nextScope)

      if (adoptedId) {
        conversations.loadConversation(adoptedId)
        if (route.path === '/' || route.path.startsWith('/chat')) {
          void router.replace(`/chat/${adoptedId}`)
        }
      }
    } else {
      agent.stopNarrationPlayback()
      agent.resetSession()
      conversations.openScope(nextScope)
    }

    lastScope = nextScope
  }

  // flush: 'sync' 保证退出时界面先被清空，再执行调用方的跳转。
  watch(() => [auth.loggedIn, auth.userId], handleAuthChange, { flush: 'sync' })

  return { handleAuthChange }
}
