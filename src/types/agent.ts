export type MessageRole = 'user' | 'assistant' | 'system'

export interface MessageSource {
  attachments?: Array<{
    name?: string
    url?: string
  }>
  type?: string
  confidence?: number
  title?: string
  url?: string
  loginRequiredHint?: boolean
  snippet?: string
}

export interface Message {
  id?: string
  role: MessageRole
  content: string
  status?: 'pending' | 'sent' | 'error'
  errorCode?: string
  requestId?: string
  createdAt?: number
  videoCue?: string
  sources?: MessageSource[]
}

export interface AgentState {
  messages: Message[]
  loading: boolean
}
