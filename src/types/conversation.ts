import type { MessageSource } from '@/types/agent'

// 会话结构版本：字段变化时递增，迁移逻辑按版本判断，避免猜测旧结构。
export const CONVERSATION_SCHEMA_VERSION = 1

// 状态语义与 docs/api-contract-v2.md 一致：
// ready 可发送；generating 请求中；done 正常完成；error 失败；interrupted 被停止/刷新打断。
export type ConversationMessageStatus = 'ready' | 'generating' | 'done' | 'error' | 'interrupted'

export type ConversationMessage = {
  messageId: string
  role: 'system' | 'user' | 'assistant'
  content: string
  status: ConversationMessageStatus
  requestId?: string
  sources?: MessageSource[]
  errorCode?: string
  createdAt: number
  updatedAt?: number
  // 重试时指向被重试的那条用户消息，保证问题只出现一次。
  replyToMessageId?: string
  // 运行标识：迟到回调必须同时匹配 conversationId 与 runId 才允许写回。
  runId?: string
}

// ownerScope 由登录会话或浏览器游客身份派生，持久化数据按它分区。
export type Conversation = {
  schemaVersion: typeof CONVERSATION_SCHEMA_VERSION
  conversationId: string
  ownerScope: string
  title: string
  createdAt: number
  updatedAt: number
  draft: string
  messages: ConversationMessage[]
}

// 历史列表只读摘要，避免每次渲染都反序列化全部消息。
export type ConversationSummary = {
  conversationId: string
  ownerScope: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  preview: string
}

export const isConversationMessageStatus = (value: unknown): value is ConversationMessageStatus =>
  value === 'ready' ||
  value === 'generating' ||
  value === 'done' ||
  value === 'error' ||
  value === 'interrupted'
