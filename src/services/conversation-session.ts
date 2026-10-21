import type { Message } from '@/types/agent'
import type { Conversation, ConversationMessage, ConversationMessageStatus } from '@/types/conversation'
import { createId } from '@/utils/id'

// 运行中(pending)在持久化模型里对应 generating；其余状态一一对应。
export const toConversationStatus = (status: Message['status']): ConversationMessageStatus => {
  if (status === 'pending') return 'generating'
  if (status === 'error') return 'error'
  if (status === 'interrupted') return 'interrupted'
  return 'done'
}

export const toAgentStatus = (status: ConversationMessageStatus): Message['status'] => {
  if (status === 'generating') return 'pending'
  if (status === 'error') return 'error'
  if (status === 'interrupted') return 'interrupted'
  return 'sent'
}

export const toConversationMessage = (message: Message, index: number): ConversationMessage | null => {
  if (message.role === 'system') return null
  if (!message.content.trim() && message.status !== 'pending' && message.status !== 'interrupted') return null

  const converted: ConversationMessage = {
    messageId: message.id || createId('msg'),
    role: message.role,
    content: message.content,
    status: toConversationStatus(message.status),
    createdAt: message.createdAt ?? Date.now() + index,
  }

  if (message.requestId) converted.requestId = message.requestId
  if (message.sources) converted.sources = message.sources
  if (typeof message.feedbackEligible === 'boolean') converted.feedbackEligible = message.feedbackEligible
  if (message.feedback) converted.feedback = message.feedback
  if (message.errorCode) converted.errorCode = message.errorCode

  return converted
}

export const toAgentMessage = (message: ConversationMessage): Message => {
  const converted: Message = {
    id: message.messageId,
    role: message.role,
    content: message.content,
    status: toAgentStatus(message.status),
    createdAt: message.createdAt,
  }

  if (message.requestId) converted.requestId = message.requestId
  if (message.sources) converted.sources = message.sources
  if (typeof message.feedbackEligible === 'boolean') converted.feedbackEligible = message.feedbackEligible
  if (message.feedback) converted.feedback = message.feedback
  if (message.errorCode) converted.errorCode = message.errorCode

  return converted
}

export const buildConversationTitle = (messages: Message[]): string => {
  const firstUser = messages.find((message) => message.role === 'user' && message.content.trim())
  if (!firstUser) return ''

  const compact = firstUser.content.replace(/\s+/g, ' ').trim()
  return compact.length > 20 ? `${compact.slice(0, 20)}…` : compact
}

// 把页面上的消息回写进会话记录；system 提示词不属于用户可见历史。
export const applyMessagesToConversation = (conversation: Conversation, messages: Message[]): Conversation => ({
  ...conversation,
  title: conversation.title || buildConversationTitle(messages),
  updatedAt: Date.now(),
  messages: messages
    .map((message, index) => toConversationMessage(message, index))
    .filter((message): message is ConversationMessage => message !== null),
})

export const conversationToMessages = (conversation: Conversation): Message[] =>
  conversation.messages.filter((message) => message.role !== 'system').map(toAgentMessage)
