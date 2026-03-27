// 消息角色定义了这条消息在会话中的身份。
export type MessageRole = 'user' | 'assistant' | 'system'

// MessageSource 描述一条回答背后的来源依据。
// 它通常由后端 RAG 检索结果转换而来，前端据此展示正文链接、附件和可信度。
export interface MessageSource {
  // 附件列表：例如 pdf、doc、xlsx 等可下载文件。
  attachments?: Array<{
    name?: string
    url?: string
  }>
  // 来源类型：如 official_notice / attachment_index / rule_match。
  type?: string
  // 可信度范围通常是 0~1，前端会转成百分比显示。
  confidence?: number
  // 来源标题，通常就是通知名或材料名。
  title?: string
  // 正文链接或下载链接。
  url?: string
  // 当来源来自学生社区时，记录原始帖子 id，方便从问答结果跳回社区详情页。
  postId?: string
  // 预留字段：后续如果有登录态要求，可以用它提示用户。
  loginRequiredHint?: boolean
  // 来源摘要，帮助用户快速判断这条来源是否相关。
  snippet?: string
  // 额外说明文案，适合展示“学生经验，仅供参考”这类风险提示。
  note?: string
}

// Message 是前端聊天窗口里最核心的数据结构。
// 一条消息既包含文本内容，也可能带状态、来源和视频提示。
export interface Message {
  // 前端本地生成的唯一 id，用于列表渲染和流式更新定位。
  id?: string
  role: MessageRole
  content: string
  // pending 表示还在生成，sent 表示成功，error 表示请求失败。
  status?: 'pending' | 'sent' | 'error'
  // 后端异常码，方便定位错误来源。
  errorCode?: string
  // 请求 id 用于前后端日志关联。
  requestId?: string
  // 创建时间主要用于消息排序和兜底 key。
  createdAt?: number
  // 预留给数字人或其他展示逻辑的 cue。
  videoCue?: string
  // assistant 消息可以附带多个来源依据。
  sources?: MessageSource[]
}

// AgentState 是 store 里最外层的核心状态结构。
export interface AgentState {
  messages: Message[]
  loading: boolean
}
