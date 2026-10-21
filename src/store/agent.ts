import { defineStore } from 'pinia'
import type { Message, MessageSource } from '@/types/agent'
import { streamChat } from '@/api/llm'

const STORAGE_KEY = 'ai-campus-agent.session.v2'

type PersistedAgentSession = {
  userProfile?: {
    role?: string
    grade?: string
    major?: string
  }
  messages?: Message[]
}

// 创建前端消息对象，便于流式输出时直接在界面上增量更新。
const createMessage = (role: Message['role'], content: string, extra?: Partial<Message>): Message => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  createdAt: Date.now(),
  status: 'sent',
  ...extra,
})

// 固定欢迎词：页面首次打开或重置会话时直接显示。
// 这条消息不走大模型，也不参与讲解 TTS。
const WELCOME_MESSAGE =
  '你好，这里是校园智能服务台。告诉我你想查询或办理的事项，我会尽量给出结论、步骤和可核对的来源。'

// 无痕模式或浏览器策略可能禁止访问 localStorage，此时降级为仅当前页面会话。
const getLocalStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export type SendMessageResult =
  | { ok: true }
  | { ok: false; errorCode?: string }

// 一次生成运行的运行态信息。只存在于内存，不持久化 Promise/AbortController。
type ActiveRun = {
  runId: string
  conversationId: string
  ownerScope: string
  assistantMessageId: string
  controller: AbortController
}

let activeRun: ActiveRun | null = null
let idleWaiters: Array<() => void> = []

const createRunId = () =>
  `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

// 通知所有等待“生成结束”的调用方（会话切换、离开页面时需要）。
const releaseIdleWaiters = () => {
  const waiters = idleWaiters
  idleWaiters = []
  waiters.forEach((resolve) => resolve())
}

const looksGarbledText = (value: string) => {
  const text = String(value || '')
  return text.includes('���') || (text.includes('?') && text.replace(/\?/g, '').trim().length <= 4)
}

// 把流式回复按“适合朗读的完整句子”切出来，便于边生成边播报。
const splitSpeakableChunks = (raw: string) => {
  const text = String(raw || '')
  const result: string[] = []
  let rest = text

  while (rest.length > 0) {
    const match = rest.match(/^([\s\S]*?[。！？；!?;]\s*)/)
    if (!match) break
    const matchedText = String(match[1] || '')
    const chunk = matchedText.trim()
    if (chunk) result.push(chunk)
    rest = rest.slice(matchedText.length)
  }

  return {
    chunks: result,
    rest,
  }
}

export const useAgentStore = defineStore('agent', {
  state: () => ({
    messages: [] as Message[],
    loading: false,
    // 当前运行绑定的会话与身份空间；由页面在切换会话时写入。
    conversationId: '',
    ownerScope: '',
    userProfile: {
      role: 'student',
      grade: '',
      major: '',
    },
    videoCueKey: 'idle' as 'greeting' | 'idle' | 'teaching',
    videoPlayTick: 0,
    narrationText: '',
    narrationTick: 0,
  }),

  actions: {
    persistSession() {
      const storage = getLocalStorage()
      if (!storage) return

      // 只持久化恢复界面所需的最小状态，避免无关数据写入缓存。
      const payload: PersistedAgentSession = {
        userProfile: this.userProfile,
        messages: this.messages,
      }
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // 存储空间不足或被禁用时，保留内存会话继续使用。
      }
    },

    hydrateSession() {
      const storage = getLocalStorage()
      if (!storage) return

      try {
        const raw = storage.getItem(STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as PersistedAgentSession

        // 只恢复可信字段，因为 localStorage 本质上是用户可修改的数据。
        if (parsed.userProfile && typeof parsed.userProfile === 'object') {
          this.userProfile = {
            ...this.userProfile,
            ...parsed.userProfile,
          }
        }

        if (Array.isArray(parsed.messages)) {
          let recoveredInterrupted = false
          this.messages = parsed.messages
            .filter(
              (msg) =>
                msg &&
                typeof msg === 'object' &&
                typeof msg.content === 'string' &&
                ['system', 'user', 'assistant'].includes(msg.role) &&
                !looksGarbledText(msg.content),
            )
            .map((msg) => {
              if (msg.status !== 'pending') return msg
              // 刷新时仍标记 pending 的回答已经不可能继续，统一转成 interrupted。
              recoveredInterrupted = true
              return { ...msg, status: 'interrupted' as const }
            })

          if (recoveredInterrupted) this.persistSession()
        }

      } catch {
        // 缓存损坏时直接清掉，避免污染后续会话。
        try {
          storage.removeItem(STORAGE_KEY)
        } catch {
          // 存储不可写时忽略清理。
        }
      }
    },

    setUserProfile(profile: Partial<typeof this.userProfile>) {
      this.userProfile = {
        ...this.userProfile,
        ...profile,
      }
      this.persistSession()
    },

    buildSystemPrompt() {
      // 用户画像会被拼进 system prompt，帮助模型生成更贴合当前用户身份的表达。
      const roleLabelMap: Record<string, string> = {
        student: '学生',
        teacher: '教师',
        guest: '访客',
      }

      return `你是校园智能服务台的 AI 导办助手。请基于校内真实信息回答办理事项，语言简洁、直接、易懂。

当前用户信息：
- 身份：${roleLabelMap[this.userProfile.role] || this.userProfile.role}
- 专业：${this.userProfile.major || '未填写'}
- 年级：${this.userProfile.grade || '未填写'}

回答要求：
1. 如果用户只是打招呼，请用 1 到 2 句话简短回应，不要输出冗长欢迎词或大段示例说明。
2. 如果用户在询问具体事务，请优先按以下结构回答：
   - 先给出明确结论或办理建议。
   - 再补充办理步骤、关键信息或注意事项。
3. 如果信息来自学校通知或规则，请尽量保持表达准确，不要编造不存在的流程。
4. 如果目前无法确认细节，请明确说明，并提醒用户以学校最新官方通知为准。
5. 语言尽量自然，不重复用户问题，不写空泛套话。
6. 不要使用 Markdown 粗体、斜体或星号强调，例如不要输出 **标题**、*重点* 这类格式。`
    },

    refreshSystemPrompt() {
      // 会话里始终只维护一条 system 消息，并固定放在最前面。
      const systemIndex = this.messages.findIndex((msg) => msg.role === 'system')
      const nextPrompt = this.buildSystemPrompt()

      if (systemIndex === -1) {
        this.messages.unshift(createMessage('system', nextPrompt))
        this.persistSession()
        return
      }

      this.messages[systemIndex] = {
        ...this.messages[systemIndex],
        role: 'system',
        content: nextPrompt,
      }
      this.persistSession()
    },

    triggerVideoCue(cue: 'greeting' | 'idle' | 'teaching') {
      // tick 自增是一个“强提醒”，用于通知播放器即使 cue 相同也要重播。
      this.videoCueKey = cue
      this.videoPlayTick += 1
    },

    clearNarration() {
      this.narrationText = ''
      this.narrationTick += 1
    },

    triggerNarration(text: string) {
      const next = String(text || '').trim()
      if (!next) {
        this.clearNarration()
        return
      }
      this.narrationText = next
      this.narrationTick += 1
    },

    ensureWelcomeMessage() {
      const visibleMessages = this.messages.filter((msg) => msg.role !== 'system')
      if (visibleMessages.length > 0) return

      this.messages.push(
        createMessage('assistant', WELCOME_MESSAGE, {
          videoCue: 'greeting',
          sources: [],
        }),
      )
    },

    stopNarrationPlayback() {
      this.clearNarration()
      this.triggerVideoCue('idle')
      this.persistSession()
    },

    onNarrationEnded() {
      if (this.videoCueKey === 'teaching') {
        this.triggerVideoCue('idle')
        this.persistSession()
      }
    },

    onGreetingEnded() {
      if (this.videoCueKey === 'greeting') {
        this.triggerVideoCue('idle')
        this.persistSession()
      }
    },

    initAgent() {
      // 初始化时确保 system prompt 存在，并在首次进入页面时自动补一条欢迎词。
      if (this.messages.length > 0) {
        this.refreshSystemPrompt()
      } else {
        this.messages = [createMessage('system', this.buildSystemPrompt())]
      }
      this.ensureWelcomeMessage()
      this.clearNarration()
      this.triggerVideoCue('greeting')
      this.persistSession()
    },

    resetSession() {
      // 重置前先结束正在进行的生成，避免旧回调继续写入新会话。
      this.cancelGeneration()
      this.messages = [createMessage('system', this.buildSystemPrompt())]
      this.ensureWelcomeMessage()
      this.clearNarration()
      this.triggerVideoCue('greeting')
      this.persistSession()
    },

    // 页面切换会话/身份时登记本次运行应归属的作用域。
    bindRunScope(conversationId: string, ownerScope: string) {
      this.conversationId = conversationId
      this.ownerScope = ownerScope
    },

    cancelGeneration() {
      if (!activeRun) return false
      const run = activeRun
      activeRun = null
      run.controller.abort()

      const target = this.messages.find((message) => message.id === run.assistantMessageId)
      if (target) {
        // 保留已生成文本，只把状态改为中断，不当作普通错误。
        target.status = 'interrupted'
      }
      this.loading = false
      this.clearNarration()
      this.triggerVideoCue('idle')
      this.persistSession()
      releaseIdleWaiters()
      return true
    },

    whenIdle(): Promise<void> {
      if (!this.loading) return Promise.resolve()
      return new Promise((resolve) => {
        idleWaiters.push(resolve)
      })
    },

    async sendMessage(
      content: string,
      options: { conversationId?: string; ownerScope?: string } = {},
    ): Promise<SendMessageResult> {
      const trimmed = content.trim()
      if (!trimmed || this.loading) return { ok: false, errorCode: 'EMPTY_OR_LOADING' }

      const userMessage = createMessage('user', trimmed)
      this.messages.push(userMessage)
      const assistantPlaceholder = createMessage('assistant', '', {
        status: 'pending',
        sources: [],
      })
      this.messages.push(assistantPlaceholder)

      return this.runGeneration(userMessage, assistantPlaceholder, options)
    },

    // 重试复用原问题与回答位置：不新增用户消息，只重置这一条回答。
    async retryGeneration(
      assistantMessageId: string,
      options: { conversationId?: string; ownerScope?: string } = {},
    ): Promise<SendMessageResult> {
      if (this.loading) return { ok: false, errorCode: 'EMPTY_OR_LOADING' }

      const index = this.messages.findIndex((message) => message.id === assistantMessageId)
      if (index <= 0) return { ok: false, errorCode: 'RETRY_NOT_FOUND' }

      const assistant = this.messages[index]
      if (!assistant || assistant.role !== 'assistant') return { ok: false, errorCode: 'RETRY_NOT_FOUND' }

      const userMessage = this.messages.slice(0, index).reverse().find((message) => message.role === 'user')
      if (!userMessage) return { ok: false, errorCode: 'RETRY_NOT_FOUND' }

      assistant.content = ''
      assistant.sources = []
      assistant.errorCode = undefined
      assistant.requestId = undefined
      assistant.videoCue = undefined
      assistant.status = 'pending'
      this.persistSession()

      return this.runGeneration(userMessage, assistant, options)
    },

    async runGeneration(
      userMessage: Message,
      assistantMessage: Message,
      options: { conversationId?: string; ownerScope?: string } = {},
    ): Promise<SendMessageResult> {
      const runId = createRunId()
      const controller = new AbortController()
      const conversationId = options.conversationId ?? this.conversationId
      const ownerScope = options.ownerScope ?? this.ownerScope
      const assistantMessageId = assistantMessage.id as string

      activeRun = { runId, conversationId, ownerScope, assistantMessageId, controller }
      this.loading = true
      this.clearNarration()
      this.triggerVideoCue('idle')
      this.persistSession()

      const isCurrentRun = () => activeRun?.runId === runId
      const findAssistant = () => this.messages.find((message) => message.id === assistantMessageId)

      let finalContent = ''
      let finalSources: MessageSource[] = []
      let finalRequestId: string | undefined
      let finalFeedbackEligible = false
      let narrationBuffer = ''
      let narrationStarted = false
      // 4.5/2.4：默认不自动朗读，语音由来源栏“语音讲解”显式开启；后续偏好设置在此接入。
      const autoNarration = false

      try {
        await streamChat(
          this.messages.filter((message) => message.id !== assistantMessageId),
          {
            onStart: ({ requestId }) => {
              if (!isCurrentRun()) return
              finalRequestId = requestId
              const target = findAssistant()
              if (target) target.requestId = requestId
            },
            onDelta: (delta) => {
              // 迟到回调必须校验自己仍属于当前运行，否则丢弃。
              if (!isCurrentRun()) return
              const target = findAssistant()
              if (!target) return
              target.content += delta

              if (!autoNarration) return
              narrationBuffer += delta
              const { chunks, rest } = splitSpeakableChunks(narrationBuffer)
              narrationBuffer = rest
              if (chunks.length > 0) {
                if (!narrationStarted) {
                  this.triggerVideoCue('teaching')
                  narrationStarted = true
                }
                chunks.forEach((chunk) => this.triggerNarration(chunk))
              }
            },
            onMeta: (meta) => {
              if (!isCurrentRun()) return
              finalContent = meta.content || finalContent
              finalSources = meta.sources ?? []
              finalFeedbackEligible = meta.feedbackEligible === true
            },
          },
          controller.signal,
        )

        // 运行已被取消或替换时，迟到结果一律丢弃。
        if (!isCurrentRun()) return { ok: false, errorCode: 'STALE_RUN' }

        const target = findAssistant()
        if (target) {
          target.content = (finalContent || target.content || '').trim()
          target.videoCue = 'teaching'
          target.sources = finalSources
          target.requestId = finalRequestId || target.requestId
          // 只有服务端确认凭据已持久化时才允许反馈。
          target.feedbackEligible = finalFeedbackEligible
          target.status = 'sent'
        }

        // 流式结束后，按需朗读模式下不再自动补播尾句。
        const tailNarration = autoNarration ? narrationBuffer.trim() : ''
        if (tailNarration) {
          if (!narrationStarted) {
            this.triggerVideoCue('teaching')
            narrationStarted = true
          }
          this.triggerNarration(tailNarration)
        }

        const narration = autoNarration ? (finalContent || target?.content || '').trim() : ''
        if (!narrationStarted && narration) {
          // 兜底：如果本次回复没有形成任何流式句子，仍然按完整文本播一次。
          this.triggerVideoCue('teaching')
          this.triggerNarration(narration)
          narrationStarted = true
        }

        if (!narrationStarted) {
          this.triggerVideoCue('idle')
        } else if (target) {
          target.videoCue = 'teaching'
        }
        this.persistSession()
        return { ok: true }
      } catch (error) {
        if (controller.signal.aborted || (error as Error)?.name === 'AbortError') {
          const target = findAssistant()
          // 已生成文本保留；没有内容也保持空文本，不写成错误文案。
          if (target) target.status = 'interrupted'
          this.clearNarration()
          this.triggerVideoCue('idle')
          this.persistSession()
          return { ok: false, errorCode: 'ABORTED' }
        }

        // 后端异常也要转成聊天消息，避免界面静默失败。
        const err = error as Error & { code?: string; sources?: unknown }
        const errorReply =
          typeof err?.message === 'string' && err.message.trim()
            ? `请求失败：${err.message}`
            : '请求失败，请稍后重试。'
        const errorCode = typeof err?.code === 'string' ? err.code : undefined
        const recoverySources = Array.isArray(err?.sources) ? err.sources : []

        if (errorCode === 'GUEST_LOGIN_REQUIRED' || errorCode === 'GUEST_RATE_LIMITED') {
          this.messages = this.messages.filter(
            (message) => message.id !== userMessage.id && message.id !== assistantMessageId,
          )
          this.clearNarration()
          this.triggerVideoCue('idle')
          this.persistSession()
          return { ok: false, errorCode }
        }

        const target = findAssistant()
        if (target) {
          target.content = errorReply
          target.status = 'error'
          target.sources = recoverySources
          target.errorCode = errorCode
        } else {
          this.messages.push(
            createMessage('assistant', errorReply, {
              status: 'error',
              sources: recoverySources,
              errorCode,
            }),
          )
        }
        this.clearNarration()
        this.triggerVideoCue('idle')
        this.persistSession()
        return { ok: false, errorCode }
      } finally {
        if (activeRun?.runId === runId) {
          activeRun = null
          this.loading = false
        } else if (!activeRun) {
          this.loading = false
        }
        releaseIdleWaiters()
      }
    },
  },
})
