export interface MobileMessageSource {
  title?: string
  type?: string
  confidence?: number
  url?: string
  postId?: string
  snippet?: string
  note?: string
  attachments?: Array<{
    name?: string
    url?: string
  }>
}

export interface MobileChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  status?: 'pending' | 'sent' | 'error'
  sources?: MobileMessageSource[]
}
