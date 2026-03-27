import { defineStore } from 'pinia'
import type { Message, MessageSource } from '@/types/agent'
import { streamChat } from '@/api/llm'
import { appConfig } from '@/config/app'

const STORAGE_KEY = 'ai-campus-agent.session.v1'

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

// 访问 localStorage 前先做环境判断，避免测试环境或非浏览器环境报错。
const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage

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
              ['system', 'user', 'assistant'].includes(msg.role),
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
      // 把用户画像信息注入 system prompt，让模型按当前用户背景回答。
      const roleLabelMap: Record<string, string> = {
        student: '学生',
        teacher: '教师',
        guest: '访客',
      }

      return `你是广东第二师范学院校园智能问答助手。
当前用户信息：
- 身份：${roleLabelMap[this.userProfile.role] || this.userProfile.role}
- 专业：${this.userProfile.major || '未填写'}
- 年级：${this.userProfile.grade || '未填写'}

回答要求：
1. 优先提供准确、清晰、步骤化的校园服务信息。
2. 信息不确定时明确说明，并提示用户去官方渠道核实。
3. 不编造校内政策、流程或时间安排。`
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
      // 初始化时补齐 system prompt，并把数字人切到欢迎开场状态。
      if (this.messages.length > 0) {
        this.refreshSystemPrompt()
      } else {
        this.messages = [createMessage('system', this.buildSystemPrompt())]
      }
      this.clearNarration()
      this.triggerVideoCue('greeting')
      this.persistSession()
    },

    resetSession() {
      this.messages = [createMessage('system', this.buildSystemPrompt())]
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

        // 只有最终回复文本稳定后，才开始讲解视频和语音播报。
        const narration = (finalContent || target?.content || '').trim()
        if (narration) {
          this.triggerVideoCue('teaching')
          this.triggerNarration(narration)
        } else {
          this.triggerVideoCue('idle')
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
