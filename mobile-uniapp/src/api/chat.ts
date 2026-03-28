import type { MobileChatMessage } from '@/types/chat'
import { request } from './http'

type ChatResponse = {
  content: string
  sources?: MobileChatMessage['sources']
}

export const sendChat = (messages: MobileChatMessage[]) =>
  request<ChatResponse>('/chat', {
    method: 'POST',
    data: { messages },
  })
