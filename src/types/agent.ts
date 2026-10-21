// 消息角色定义了这条消息在会话中的身份。
export type MessageRole = 'user' | 'assistant' | 'system'

// 消息来源类型与后端 4.4 适配器的稳定枚举保持一致。
export type MessageSourceType = 'official' | 'knowledge_base' | 'community' | 'rule' | 'lightrag'
export type MessageSourceValidity = 'current' | 'expired' | 'unknown'

// MessageSource 描述一条回答背后的来源依据。
// 字段来自后端统一适配器，前端据此展示标题、时效、链接和附件。
export interface MessageSource {
  // 稳定来源 id，用于来源面板去重与选中定位。
  sourceId?: string
  // 来源类型：官方/知识库/社区/规则/LightRAG。
  type?: MessageSourceType
  // 来源标题，通常就是通知名或材料名。
  title?: string
  // 正文链接或下载链接。
  url?: string
  // 附件列表：例如 pdf、doc、xlsx 等可下载文件。
  attachments?: Array<{
    name?: string
    url?: string
    mimeType?: string
  }>
  // 发布日期/更新时间：缺失时为 null，界面显示“未提供”。
  publishedAt?: string | null
  updatedAt?: string | null
  // 适用年份/学期等时效描述。
  applicablePeriod?: string | null
  // 时效状态：现行/已失效/未知。
  validity?: MessageSourceValidity
  // 当来源来自学生社区时，记录原始帖子 id，方便从问答结果跳回社区详情页。
  postId?: string
  // 来源摘要，帮助用户快速判断这条来源是否相关。
  snippet?: string
  // 额外说明文案，适合展示“学生经验，仅供参考”这类风险提示。
  note?: string
  // 预留字段：后续如果有登录态要求，可以用它提示用户。
  loginRequiredHint?: boolean
}

// Message 是前端聊天窗口里最核心的数据结构。
// 一条消息既包含文本内容，也可能带状态、来源和视频提示。
export interface Message {
  // 前端本地生成的唯一 id，用于列表渲染和流式更新定位。
  id?: string
  role: MessageRole
  content: string
  // pending 表示还在生成，sent 表示成功，error 表示请求失败，
  // interrupted 表示被用户停止、切换或刷新打断（保留已生成文本）。
  status?: 'pending' | 'sent' | 'error' | 'interrupted'
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
