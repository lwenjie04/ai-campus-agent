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

const createMessage = (role: Message['role'], content: string, extra?: Partial<Message>): Message => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  createdAt: Date.now(),
  status: 'sent',
  ...extra,
})

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

        const narration = (finalContent || target?.content || '').trim()
        if (narration) {
          this.triggerVideoCue('teaching')
          this.triggerNarration(narration)
        } else {
          this.triggerVideoCue('idle')
        }
        this.persistSession()
      } catch (error: any) {
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
