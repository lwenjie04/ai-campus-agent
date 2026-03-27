import axios from 'axios'
import type { Message, MessageSource } from '@/types/agent'
import { appConfig } from '@/config/app'

export interface ChatApiResponse {
  content: string
  intent?: string
  videoCue?: string
  sources?: MessageSource[]
  requestId?: string
}

export interface StreamChatHandlers {
  onStart?: (payload: { requestId?: string }) => void
  onDelta?: (delta: string) => void
  onMeta?: (payload: ChatApiResponse) => void
}

// Mock 回复用于后端未启动或演示模式下的前端联调。
const mockReply = (messages: Message[]): ChatApiResponse => {
  const lastUser = [...messages].reverse().find((msg) => msg.role === 'user')?.content ?? ''

  if (/课程|课表|选课|教务/.test(lastUser)) {
    return {
      content:
        '关于课程安排，建议先查看教务系统课表页面；如果你告诉我具体年级和专业，我可以按步骤帮你确认查询路径。',
      intent: 'teaching',
      videoCue: 'teaching',
      sources: [
        {
          type: 'academic_system',
          confidence: 0.72,
          title: '教务系统（示例）',
          snippet: '此处为前端 Mock 来源示例，后续接入 RAG 后展示真实来源。',
        },
      ],
    }
  }

  if (/考试|补考|重修/.test(lastUser)) {
    return {
      content:
        '考试相关问题通常需要确认课程、学期和考试类型。你可以先说明是期末考试、补考还是重修报名，我再给你对应流程。',
      intent: 'exam',
      videoCue: 'exam',
      sources: [],
    }
  }

  if (/宿舍|饭堂|食堂|图书馆|生活/.test(lastUser)) {
    return {
      content:
        '校园生活服务问题我可以协助整理查询路径。请告诉我是宿舍报修、饭堂开放时间，还是图书馆借阅规则。',
      intent: 'life',
      videoCue: 'life',
      sources: [],
    }
  }

  return {
    content:
      '这是前端 Mock 回复（当前未接入后端）。后续会接入通用大模型与提示词工程，并逐步增加校园知识库检索能力。',
    intent: 'general',
    videoCue: 'idle',
    sources: [],
  }
}

export const sendChat = async (messages: Message[]): Promise<ChatApiResponse> => {
  if (appConfig.useMockChat) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return mockReply(messages)
  }

  // 非流式接口适合简单请求，直接等待后端一次性返回完整结果。
  const res = await axios.post<ChatApiResponse>(`${appConfig.apiBaseUrl}/chat`, {
    messages,
  })

  return res.data
}

export const streamChat = async (
  messages: Message[],
  handlers: StreamChatHandlers = {},
): Promise<ChatApiResponse> => {
  if (appConfig.useMockChat) {
    // Mock 模式也模拟字符级流式输出，方便前端调试打字机效果。
    const reply = mockReply(messages)
    handlers.onStart?.({ requestId: `mock-${Date.now()}` })
    for (const ch of reply.content) {
      handlers.onDelta?.(ch)
      await new Promise((r) => setTimeout(r, 12))
    }
    handlers.onMeta?.(reply)
    return reply
  }

  const resp = await fetch(`${appConfig.apiBaseUrl}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  })

  if (!resp.ok || !resp.body) {
    let errData: any = null
    try {
      errData = await resp.json()
    } catch {
      // ignore
    }
    const err = new Error(errData?.error?.message || `HTTP ${resp.status}`)
    ;(err as any).code = errData?.error?.code || 'HTTP_ERROR'
    throw err
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalMeta: ChatApiResponse | null = null

  // 后端按 NDJSON 一行一个事件返回，这里负责逐行解析并分发给回调。
  const processLine = (lineRaw: string) => {
    const line = lineRaw.trim()
    if (!line) return

    let event: any
    try {
      event = JSON.parse(line)
    } catch {
      return
    }

    if (event.type === 'start') {
      handlers.onStart?.({ requestId: event.requestId })
      return
    }
    if (event.type === 'delta' && typeof event.delta === 'string') {
      handlers.onDelta?.(event.delta)
      return
    }
    if (event.type === 'meta') {
      finalMeta = {
        content: typeof event.content === 'string' ? event.content : '',
        intent: event.intent,
        videoCue: event.videoCue,
        sources: Array.isArray(event.sources) ? event.sources : [],
        requestId: event.requestId,
      }
      handlers.onMeta?.(finalMeta)
      return
    }
    if (event.type === 'error') {
      const err = new Error(event?.error?.message || '流式请求失败')
      ;(err as any).code = event?.error?.code || 'STREAM_ERROR'
      throw err
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    // 分块读取后先拼接到 buffer，再按换行切出完整事件。
    buffer += decoder.decode(value, { stream: true })

    let newlineIdx = buffer.indexOf('\n')
    while (newlineIdx !== -1) {
      const line = buffer.slice(0, newlineIdx)
      buffer = buffer.slice(newlineIdx + 1)
      processLine(line)
      newlineIdx = buffer.indexOf('\n')
    }
  }

  if (buffer.trim()) {
    processLine(buffer)
  }

  return finalMeta || { content: '' }
}
