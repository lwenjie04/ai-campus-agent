import { defineStore } from 'pinia'
import type { Message, MessageSource } from '@/types/agent'
import { streamChat } from '@/api/llm'
import { appConfig } from '@/config/app'

const STORAGE_KEY = 'ai-campus-agent.session.v2'

type PersistedAgentSession = {
  userProfile?: {
    role?: string
    grade?: string
    major?: string
  }
  messages?: Message[]
  demoMode?: boolean
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
  '你好，我是广东第二师范学院校园智能问答助手。你可以直接告诉我想查询的事项，例如奖学金、选课、转专业、宿舍服务等。'

// 访问 localStorage 前先做环境判断，避免测试环境或非浏览器环境报错。
const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage

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
    userProfile: {
      role: 'student',
      grade: '',
      major: '',
    },
    videoCueKey: 'idle' as 'greeting' | 'idle' | 'teaching',
    videoPlayTick: 0,
    narrationText: '',
    narrationTick: 0,
    demoMode: appConfig.demoMode,
  }),

  actions: {
    persistSession() {
      if (!canUseStorage()) return

      // 只持久化恢复界面所需的最小状态，避免无关数据写入缓存。
      const payload: PersistedAgentSession = {
        userProfile: this.userProfile,
        messages: this.messages,
        demoMode: this.demoMode,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    },

    hydrateSession() {
      if (!canUseStorage()) return

      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return

      try {
        const parsed = JSON.parse(raw) as PersistedAgentSession

        // 只恢复可信字段，因为 localStorage 本质上是用户可修改的数据。
        if (parsed.userProfile && typeof parsed.userProfile === 'object') {
          this.userProfile = {
            ...this.userProfile,
            ...parsed.userProfile,
          }
        }

        if (Array.isArray(parsed.messages)) {
          this.messages = parsed.messages.filter(
            (msg) =>
              msg &&
              typeof msg === 'object' &&
              typeof msg.content === 'string' &&
              ['system', 'user', 'assistant'].includes(msg.role) &&
              !looksGarbledText(msg.content),
          )
        }

        if (typeof parsed.demoMode === 'boolean') {
          this.demoMode = parsed.demoMode
        }
      } catch {
        // 缓存损坏时直接清掉，避免污染后续会话。
        localStorage.removeItem(STORAGE_KEY)
      }
    },

    setUserProfile(profile: Partial<typeof this.userProfile>) {
      this.userProfile = {
        ...this.userProfile,
        ...profile,
      }
      this.persistSession()
    },

    setDemoMode(enabled: boolean) {
      this.demoMode = !!enabled
      this.persistSession()
    },

    buildSystemPrompt() {
      // 用户画像会被拼进 system prompt，帮助模型生成更贴合当前用户身份的表达。
      const roleLabelMap: Record<string, string> = {
        student: '学生',
        teacher: '教师',
        guest: '访客',
      }

      return `你是广东第二师范学院校园智能问答助手。请基于学校真实信息进行回答，语言简洁、直接、易懂。

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
      this.messages = [createMessage('system', this.buildSystemPrompt())]
      this.ensureWelcomeMessage()
      this.clearNarration()
      this.triggerVideoCue('greeting')
      this.persistSession()
    },

    async sendMessage(content: string) {
      // 这里串起完整的发送链路：写入用户消息 -> 创建占位回复 -> 流式更新 -> 触发讲解。
      const trimmed = content.trim()
      if (!trimmed || this.loading) return

      this.messages.push(createMessage('user', trimmed))
      const assistantPlaceholder = createMessage('assistant', '', {
        status: 'pending',
        sources: [],
      })
      this.messages.push(assistantPlaceholder)
      this.loading = true
      this.clearNarration()
      this.triggerVideoCue('idle')
      this.persistSession()

      let finalContent = ''
      let finalSources: MessageSource[] = []
      let finalRequestId: string | undefined
      let narrationBuffer = ''
      let narrationStarted = false

      try {
        await streamChat(this.messages.filter((msg) => msg.id !== assistantPlaceholder.id), {
          onStart: ({ requestId }) => {
            finalRequestId = requestId
            const target = this.messages.find((msg) => msg.id === assistantPlaceholder.id)
            if (target) target.requestId = requestId
          },
          onDelta: (delta) => {
            // 每一段流式文本都直接追加到占位消息里，用户能实时看到生成过程。
            const target = this.messages.find((msg) => msg.id === assistantPlaceholder.id)
            if (!target) return
            target.content += delta

            // 同时把文本累计成完整句子，一旦成句就立即送给数字人播报。
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
            finalContent = meta.content || finalContent
            finalSources = meta.sources ?? []
          },
        })

        const target = this.messages.find((msg) => msg.id === assistantPlaceholder.id)
        if (target) {
          target.content = (finalContent || target.content || '').trim()
          target.videoCue = 'teaching'
          target.sources = finalSources
          target.requestId = finalRequestId || target.requestId
          target.status = 'sent'
        }

        // 流式结束后，把最后一个没凑成完整句号的尾句补进播报队列。
        const tailNarration = narrationBuffer.trim()
        if (tailNarration) {
          if (!narrationStarted) {
            this.triggerVideoCue('teaching')
            narrationStarted = true
          }
          this.triggerNarration(tailNarration)
        }

        const narration = (finalContent || target?.content || '').trim()
        if (!narrationStarted && narration) {
          // 兜底：如果本次回复没有形成任何流式句子，仍然按完整文本播一次。
          this.triggerVideoCue('teaching')
          this.triggerNarration(narration)
          narrationStarted = true
        }

        if (!narrationStarted) {
          this.triggerVideoCue('idle')
        } else {
          target && (target.videoCue = 'teaching')
        }
        this.persistSession()
      } catch (error: any) {
        // 后端异常也要转成聊天消息，避免界面静默失败。
        const errorReply =
          typeof error?.message === 'string' && error.message.trim()
            ? `请求失败：${error.message}`
            : '请求失败，请稍后重试。'
        const errorCode = typeof error?.code === 'string' ? error.code : undefined
        const target = this.messages.find((msg) => msg.id === assistantPlaceholder.id)
        if (target) {
          target.content = errorReply
          target.status = 'error'
          target.sources = []
          target.errorCode = errorCode
        } else {
          this.messages.push(
            createMessage('assistant', errorReply, { status: 'error', sources: [], errorCode }),
          )
        }
        this.clearNarration()
        this.triggerVideoCue('idle')
        this.persistSession()
      } finally {
        this.loading = false
      }
    },
  },
})
