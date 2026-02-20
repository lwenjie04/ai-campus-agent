import { defineStore } from 'pinia'
import type { Message } from '@/types/agent'
import { streamChat } from '@/api/llm'

const STORAGE_KEY = 'ai-campus-agent.session.v1'

type PersistedAgentSession = {
  userProfile?: {
    role?: string
    grade?: string
    major?: string
  }
  messages?: Message[]
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
    videoCueKey: 'idle',
    videoPlayTick: 0,
  }),

  actions: {
    persistSession() {
      if (!canUseStorage()) return

      const payload = {
        userProfile: this.userProfile,
        messages: this.messages,
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

    buildSystemPrompt() {
      const roleLabelMap: Record<string, string> = {
        student: '学生',
        teacher: '教师',
        guest: '访客',
      }

      return `你是广二师校园智能问答助手。
当前用户信息：
- 身份：${roleLabelMap[this.userProfile.role] || this.userProfile.role}
- 专业：${this.userProfile.major || '未填写'}
- 年级：${this.userProfile.grade || '未填写'}

回答要求：
1. 优先提供准确、清晰、步骤化的校园服务信息
2. 信息不确定时明确说明，并提示用户去官方渠道核实
3. 不编造校内政策、流程或时间安排`
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

    initAgent() {
      if (this.messages.length > 0) {
        this.refreshSystemPrompt()
        return
      }

      this.messages = [createMessage('system', this.buildSystemPrompt())]
      this.videoCueKey = 'idle'
      this.videoPlayTick = 0
      this.persistSession()
    },

    resetSession() {
      this.messages = [createMessage('system', this.buildSystemPrompt())]
      this.videoCueKey = 'idle'
      this.videoPlayTick = 0
      this.persistSession()
    },

    resolveVideoCue(content: string) {
      if (/你好|您好|hi|hello/i.test(content)) return 'greeting'
      if (/课程|课表|选课|教务/.test(content)) return 'teaching'
      if (/考试|补考|重修/.test(content)) return 'exam'
      if (/宿舍|饭堂|食堂|图书馆|生活/.test(content)) return 'life'
      return 'idle'
    },

    triggerVideoCue(cue?: string, replyContent?: string) {
      this.videoCueKey = cue || this.resolveVideoCue(replyContent || '')
      this.videoPlayTick += 1
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
      this.persistSession()

      let finalContent = ''
      let finalVideoCue: string | undefined
      let finalSources: any[] = []
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
            finalVideoCue = meta.videoCue
            finalSources = meta.sources ?? []
          },
        })

        const target = this.messages.find((msg) => msg.id === assistantPlaceholder.id)
        if (target) {
          target.content = (finalContent || target.content || '').trim()
          target.videoCue = finalVideoCue
          target.sources = finalSources
          target.requestId = finalRequestId || target.requestId
          target.status = 'sent'
        }

        this.triggerVideoCue(finalVideoCue, finalContent)
        this.persistSession()
      } catch (error: any) {
        const errorReply = '请求失败，请稍后重试。'
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
        this.triggerVideoCue(undefined, errorReply)
        this.persistSession()
      } finally {
        this.loading = false
      }
    },

  },
})
