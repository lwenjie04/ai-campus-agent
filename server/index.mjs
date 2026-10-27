import { createServer } from 'node:http'
import { request as httpRequest } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { handleAuthRoute } from './auth.mjs'
import { handleCommunityRoute } from './community.mjs'
import { buildRuleBasedSources } from './sources-rules.mjs'
import { adaptMessageSources } from './source-adapter.mjs'
import {
  buildRagContext,
  filterConfidentRagHits,
  getKnowledgeBaseEntryById,
  ragHitsToSources,
  searchKnowledgeBase,
} from './rag.mjs'
import { checkLightRagHealth, formatLightragContext, lightragContextToSources, queryLightRag } from './lightrag.mjs'
import { policyUpdatesToSources } from './policy-updates.mjs'
import { handleTtsRoute } from './tts.mjs'
import { beginChatAccess } from './guest-quota.mjs'
import { requireAdmin } from './session.mjs'
import { createChatCancellation, createClientDisconnectError } from './chat-cancellation.mjs'
import { saveRequestReceipt } from './request-receipts.mjs'
import { handleFeedbackRoute } from './feedback-route.mjs'

// 读取 .env 文件并注入到 process.env。
// 这里没有依赖 dotenv，而是自己做了一个极简解析器，便于保持后端零额外依赖。
const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) return

  const text = readFileSync(filePath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue

    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadEnvFile(resolve(process.cwd(), 'server/.env'))
loadEnvFile(resolve(process.cwd(), '.env.server'))

// 后端运行时配置。
// 这里集中定义服务端口、模型提供商地址、模型名称和 CORS 来源。
const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '127.0.0.1'
const PROVIDER_MODE = process.env.LLM_PROVIDER_MODE === 'mock' ? 'mock' : 'deepseek'
const LLM_API_BASE_URL = process.env.LLM_API_BASE_URL || 'https://api.deepseek.com'
const LLM_API_KEY = process.env.LLM_API_KEY || ''
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat'
const ALLOW_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
const LIGHTRAG_PRIMARY = process.env.LIGHTRAG_PRIMARY === 'true'
const LIGHTRAG_API_BASE_URL = process.env.LIGHTRAG_API_BASE_URL || 'http://127.0.0.1:9621'
const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
const LLM_REQUEST_TIMEOUT_MS = toPositiveInteger(process.env.LLM_REQUEST_TIMEOUT_MS, 30_000)
const LLM_STREAM_IDLE_TIMEOUT_MS = toPositiveInteger(process.env.LLM_STREAM_IDLE_TIMEOUT_MS, 30_000)
const CHAT_LIGHTRAG_TIMEOUT_MS = toPositiveInteger(process.env.CHAT_LIGHTRAG_TIMEOUT_MS, 6_000)

// LightRAG 健康状态缓存，避免每次聊天请求都做健康检查。
let lightragIsHealthy = false
const refreshLightragHealth = async () => {
  try {
    await checkLightRagHealth()
    lightragIsHealthy = true
    console.log('[LightRAG] 健康检查通过，已切换为 LightRAG 主力检索')
  } catch (err) {
    lightragIsHealthy = false
    console.log('[LightRAG] 健康检查失败:', err.message)
  }
}

// 启动时检查一次，之后每 60 秒刷新。
if (LIGHTRAG_PRIMARY) {
  console.log('[LightRAG] LIGHTRAG_PRIMARY=true，开始健康检查...')
  refreshLightragHealth()
  setInterval(refreshLightragHealth, 60_000)
} else {
  console.log('[LightRAG] LIGHTRAG_PRIMARY=false，使用关键词 RAG')
}

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.zip': 'application/zip',
}

// 统一输出 JSON 响应。
// 这样所有接口返回结构、CORS 头和编码方式都保持一致。
const json = (res, statusCode, data, headers = {}) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
    Vary: 'Origin',
    ...headers,
  })
  res.end(JSON.stringify(data))
}

const requireAdminOrRespond = (req, res) => {
  try {
    return requireAdmin(req)
  } catch (error) {
    json(res, error?.statusCode || 401, {
      error: {
        code: error?.code || 'AUTH_REQUIRED',
        message: error?.message || '请先登录',
      },
    })
    return null
  }
}

// 生成兼容中文文件名的下载响应头。
// fallback 用于兼容只支持 ASCII 文件名的客户端；
// filename* 用于现代浏览器正确识别 UTF-8 中文名。
const fileNameHeaders = (fileName) => {
  const fallback = String(fileName || 'download.bin').replace(/[^\x20-\x7E]+/g, '_')
  const encoded = encodeURIComponent(String(fileName || 'download.bin'))
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

// 解析请求体中的 JSON。
// 同时做 2MB 限制，避免请求体异常大导致后端被拖垮。
const parseJsonBody = async (req) =>
  new Promise((resolvePromise, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('BODY_TOO_LARGE'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolvePromise(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('INVALID_JSON'))
      }
    })
    req.on('error', reject)
  })

const isValidRole = (role) => ['system', 'user', 'assistant'].includes(role)

// 校验前端传来的 messages 是否符合聊天接口要求。
// 如果消息结构不合法，就直接在这里拦截，不进入后续模型调用。
const validateMessages = (messages) => {
  if (!Array.isArray(messages)) return 'messages must be an array'
  if (messages.length === 0) return 'messages cannot be empty'

  for (const item of messages) {
    if (!item || typeof item !== 'object') return 'message must be an object'
    if (!isValidRole(item.role)) return `invalid role: ${String(item.role)}`
    if (typeof item.content !== 'string') return 'message.content must be a string'
  }

  return null
}

// 确保消息列表里存在一条 system prompt。
// 如果前端没有传 system 消息，后端会自动补一条默认提示词。
const ensureSystemPrompt = (messages) => {
  const hasSystem = messages.some((m) => m.role === 'system')
  if (hasSystem) return messages

  return [
    {
      role: 'system',
      content: [
        '你是广东第二师范学院校园智能问答助手。',
        '请基于学校真实信息回答，语言简洁、准确、易懂。',
        '如果用户只是打招呼，请用 1 到 2 句话简短回应，不要输出冗长欢迎词。',
        '如果用户询问具体事务，请优先给结论，再补充办理步骤、关键信息和提醒。',
        '如果信息不足，请明确说明无法确认，并提醒用户以学校最新官方通知为准。',
        '不要编造不存在的流程，也不要写空泛套话。',
        '不要使用 Markdown 粗体、斜体或星号强调，例如不要输出 **标题**、*重点* 这类格式。',
      ].join(''),
    },
    ...messages,
  ]
}

// 根据回答内容粗略判断意图，并决定数字人应该切到哪个视频 cue。
// 这是一个轻量级规则分类，不是严格的 NLP 意图识别。
const classifyIntentAndVideoCue = (content) => {
  if (/你好|您好|hi|hello/i.test(content)) return { intent: 'greeting', videoCue: 'greeting' }
  if (/课程|课表|选课|教务/.test(content)) return { intent: 'teaching', videoCue: 'teaching' }
  if (/考试|补考|重修/.test(content)) return { intent: 'exam', videoCue: 'exam' }
  if (/宿舍|饭堂|食堂|图书馆|生活/.test(content)) return { intent: 'life', videoCue: 'life' }
  if (/奖学金|资助|助学金/.test(content)) return { intent: 'scholarship', videoCue: 'idle' }
  return { intent: 'general', videoCue: 'idle' }
}

const isSmallTalk = (text) =>
  /^(?:你好|您好|嗨|哈喽|hello|hi|hey|谢谢|感谢|再见|拜拜)[\s!！,.，。?？]*$/i.test(
    String(text || '').trim(),
  )

const buildLowConfidenceResult = (userText) => ({
  content:
    '我目前没有检索到与这个问题足够匹配的校内资料，暂时不能可靠确认答案。请补充具体事项、所属学期或年份、办理部门等信息后再问；涉及时间、条件或流程时，请以学校官网和相关部门最新通知为准。',
  ...classifyIntentAndVideoCue(userText),
  sources: [],
})

// Mock 回复。
// 仅在没有接入真实模型时用于前后端联调，现在保留它主要是为了兜底和演示。
const mockChatResult = (messages) => {
  const userText = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

  if (/课程|课表|选课|教务/.test(userText)) {
    return {
      content:
        '你可以先登录教务系统查看课表和选课安排。若你告诉我年级、专业和想查询的学期，我可以给你更具体的查询步骤。',
      ...classifyIntentAndVideoCue(userText),
      sources: buildRuleBasedSources(userText, 'teaching', 'mock'),
    }
  }

  if (/考试|补考|重修/.test(userText)) {
    return {
      content:
        '考试类问题通常需要确认课程名称、学期和考试类型（期末/补考/重修）。你先告诉我是哪一类，我会按步骤给出办理路径。',
      ...classifyIntentAndVideoCue(userText),
      sources: buildRuleBasedSources(userText, 'exam', 'mock'),
    }
  }

  if (/宿舍|饭堂|食堂|图书馆|生活/.test(userText)) {
    return {
      content:
        '校园生活服务问题建议优先确认具体场景，例如宿舍报修、饭堂营业时间或图书馆借阅规则。我可以继续帮你细化查询路径。',
      ...classifyIntentAndVideoCue(userText),
      sources: buildRuleBasedSources(userText, 'life', 'mock'),
    }
  }

  if (/奖学金|资助|助学金/.test(userText)) {
    return {
      content:
        '奖学金政策通常要区分奖项类型、评定学年、申请条件和材料要求。建议你先确认是国家奖学金、国家励志奖学金还是校内奖学金，我可以帮你梳理查询路径。',
      intent: 'scholarship',
      videoCue: 'idle',
      sources: buildRuleBasedSources(userText, 'scholarship', 'mock'),
    }
  }

  return {
    content:
      '这是后端 Mock 回复（当前未接入真实大模型）。后续将切换为“通用大模型 + 提示词工程”，并逐步接入校园知识库。',
    intent: 'general',
    videoCue: 'idle',
    sources: buildRuleBasedSources(userText, 'general', 'mock'),
  }
}

// 非流式模型调用。
// 适用于一次性拿完整答案的接口 /chat。
const requestOpenAICompatibleChat = async (messages, requestId) => {
  if (PROVIDER_MODE === 'mock') {
    return mockChatResult(messages).content
  }
  if (!LLM_API_KEY) {
    const err = new Error('LLM_API_KEY is missing')
    err.code = 'LLM_API_KEY_MISSING'
    throw err
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LLM_REQUEST_TIMEOUT_MS)

  try {
    const resp = await fetch(`${LLM_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
        'X-Request-Id': requestId,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        temperature: 0.3,
        stream: false,
      }),
      signal: controller.signal,
    })

    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      const err = new Error(data?.error?.message || `LLM HTTP ${resp.status}`)
      err.code = 'LLM_UPSTREAM_ERROR'
      err.details = data
      throw err
    }

    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      const err = new Error('Empty LLM content')
      err.code = 'LLM_EMPTY_CONTENT'
      err.details = data
      throw err
    }

    return content.trim()
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('LLM request timeout')
      err.code = 'LLM_TIMEOUT'
      throw err
    }
    if (!error?.code && (error?.name === 'TypeError' || error?.cause)) {
      const err = new Error('LLM network request failed')
      err.code = 'LLM_NETWORK_ERROR'
      throw err
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

// 流式模型调用。
// 这里按 OpenAI 兼容 SSE 流格式逐段读取 delta，并实时回调给外层。
const waitOrAbort = (milliseconds, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || createClientDisconnectError())
      return
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(signal.reason || createClientDisconnectError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })

const requestOpenAICompatibleChatStream = async (messages, requestId, handlers = {}) => {
  if (PROVIDER_MODE === 'mock') {
    const content = mockChatResult(messages).content
    for (const chunk of content.match(/.{1,12}/gs) || [content]) {
      if (handlers.signal?.aborted) throw handlers.signal.reason || createClientDisconnectError()
      handlers.onDelta?.(chunk)
      await waitOrAbort(2, handlers.signal)
    }
    return content
  }
  if (!LLM_API_KEY) {
    const err = new Error('LLM_API_KEY is missing')
    err.code = 'LLM_API_KEY_MISSING'
    throw err
  }

  const controller = new AbortController()
  let timeout
  let timeoutTriggered = false
  const refreshIdleTimeout = () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      timeoutTriggered = true
      controller.abort()
    }, LLM_STREAM_IDLE_TIMEOUT_MS)
  }
  const relayClientAbort = () =>
    controller.abort(handlers.signal?.reason || createClientDisconnectError())

  if (handlers.signal?.aborted) relayClientAbort()
  else handlers.signal?.addEventListener('abort', relayClientAbort, { once: true })
  refreshIdleTimeout()

  try {
    const resp = await fetch(`${LLM_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
        'X-Request-Id': requestId,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        temperature: 0.3,
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}))
      const err = new Error(data?.error?.message || `LLM HTTP ${resp.status}`)
      err.code = 'LLM_UPSTREAM_ERROR'
      err.details = data
      throw err
    }

    if (!resp.body) {
      const err = new Error('LLM stream body is empty')
      err.code = 'LLM_EMPTY_STREAM'
      throw err
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let doneSeen = false

    while (!doneSeen) {
      const { value, done } = await reader.read()
      if (done) break
      refreshIdleTimeout()

      buffer += decoder.decode(value, { stream: true })
      let eventBoundary = buffer.indexOf('\n\n')

      while (eventBoundary !== -1) {
        const rawEvent = buffer.slice(0, eventBoundary)
        buffer = buffer.slice(eventBoundary + 2)

        const lines = rawEvent.split(/\r?\n/)
        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line || !line.startsWith('data:')) continue

          const payloadText = line.slice(5).trim()
          if (!payloadText) continue
          if (payloadText === '[DONE]') {
            doneSeen = true
            break
          }

          let payload
          try {
            payload = JSON.parse(payloadText)
          } catch {
            continue
          }

          const delta = payload?.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta.length > 0) {
            fullContent += delta
            handlers.onDelta?.(delta)
          }
        }

        if (doneSeen) break
        eventBoundary = buffer.indexOf('\n\n')
      }
    }

    const trimmed = fullContent.trim()
    if (!trimmed) {
      const err = new Error('Empty LLM content')
      err.code = 'LLM_EMPTY_CONTENT'
      throw err
    }

    return trimmed
  } catch (error) {
    if (handlers.signal?.aborted) {
      throw handlers.signal.reason || createClientDisconnectError()
    }
    if (timeoutTriggered || error?.name === 'AbortError') {
      const timeoutError = new Error('LLM request timeout')
      timeoutError.code = 'LLM_TIMEOUT'
      throw timeoutError
    }
    if (!error?.code && (error?.name === 'TypeError' || error?.cause)) {
      const err = new Error('LLM network request failed')
      err.code = 'LLM_NETWORK_ERROR'
      throw err
    }
    throw error
  } finally {
    clearTimeout(timeout)
    handlers.signal?.removeEventListener('abort', relayClientAbort)
  }
}

// 把 RAG 命中的资料拼接成额外的 system 上下文，发送给大模型。
// 这样模型在生成答案时，就能优先参考知识库内容。
const appendRagContextToMessages = (messages, ragHits, query) => {
  if (!Array.isArray(ragHits) || ragHits.length === 0) return messages

  const context = buildRagContext(ragHits, { query })
  if (!context) return messages

  return [
    ...messages,
    {
      role: 'system',
      content: context,
    },
  ]
}

// 5.4：命中现行政策提示时，把政策来源放在来源列表前面，避免只展示被取代的手册旧条文。
const mergePolicySources = (query, sources) => {
  const policySources = policyUpdatesToSources(query)
  if (policySources.length === 0) return sources

  const sourceKey = (source) => `${source.type || ''}|${source.title || ''}|${source.url || ''}`
  const seen = new Set(sources.map(sourceKey))
  return [...policySources.filter((source) => !seen.has(sourceKey(source))), ...sources]
}

// 知识库附件下载接口。
// 前端点击来源中的附件链接时，会通过这个接口下载本地知识库文件。
const handleKnowledgeBaseDownload = (req, res) => {
  const requestUrl = new URL(req.url || '/kb/download', `http://${req.headers.host || `localhost:${PORT}`}`)
  const id = requestUrl.searchParams.get('id') || ''
  const item = getKnowledgeBaseEntryById(id)

  if (!item?.downloadPath) {
    return json(res, 404, { error: { code: 'KB_FILE_NOT_FOUND', message: '知识库文件不存在' } })
  }

  const absolutePath = resolve(process.cwd(), item.downloadPath)
  if (!existsSync(absolutePath)) {
    return json(res, 404, { error: { code: 'KB_FILE_MISSING', message: '知识库源文件缺失' } })
  }

  const fileExt = extname(absolutePath).toLowerCase()
  const contentType = MIME_BY_EXT[fileExt] || 'application/octet-stream'
  const fileName = item.downloadName || item.title || `kb-${id}${fileExt}`
  const fileSize = statSync(absolutePath).size

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': String(fileSize),
    'Content-Disposition': fileNameHeaders(fileName),
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  })

  const stream = createReadStream(absolutePath)
  stream.on('error', () => {
    if (!res.headersSent) {
      json(res, 500, { error: { code: 'KB_FILE_STREAM_ERROR', message: '文件读取失败' } })
    } else {
      res.destroy()
    }
  })
  stream.pipe(res)
}

// 流式接口采用 NDJSON（一行一个 JSON 对象）返回事件。
const writeNdjson = (res, payload) => {
  res.write(`${JSON.stringify(payload)}\n`)
}

const saveFeedbackReceipt = async ({ requestId, chatAccess, sources }) => {
  const owner =
    chatAccess?.kind === 'authenticated' && chatAccess.session?.userId
      ? { ownerType: 'user', ownerId: chatAccess.session.userId }
      : chatAccess?.kind === 'guest' && chatAccess.guestId
        ? { ownerType: 'guest', ownerId: chatAccess.guestId }
        : null
  if (!owner) return false

  try {
    await saveRequestReceipt({
      requestId,
      ...owner,
      sourceIds: sources.map((source) => source?.sourceId).filter(Boolean),
    })
    return true
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        requestId,
        feedback: 'receipt_unavailable',
        code: error?.code || 'FEEDBACK_STORAGE_UNAVAILABLE',
      }),
    )
    return false
  }
}

const buildChatError = (code, recoverySources = []) => {
  const hasRecoverySources = recoverySources.length > 0
  const message =
    code === 'GUEST_LOGIN_REQUIRED'
      ? '本次游客体验已使用，请登录后继续提问'
      : code === 'INVALID_JSON'
        ? '请求体不是有效 JSON'
        : code === 'BODY_TOO_LARGE'
          ? '请求体过大'
          : code === 'LLM_TIMEOUT'
            ? hasRecoverySources
              ? '模型响应超时，本次未生成答案；已保留检索到的官方资料，请先查看来源。本次不消耗游客体验次数。'
              : '模型响应超时，本次未生成答案，请稍后重试。本次不消耗游客体验次数。'
            : code.startsWith('LLM_')
              ? hasRecoverySources
                ? '模型服务暂时不可用，本次未生成答案；已保留检索到的官方资料，请先查看来源。本次不消耗游客体验次数。'
                : '模型服务暂时不可用，本次未生成答案，请稍后重试。本次不消耗游客体验次数。'
              : '服务暂时不可用，请稍后重试。本次不消耗游客体验次数。'

  return {
    code,
    message,
    retryable: !['GUEST_LOGIN_REQUIRED', 'INVALID_JSON', 'BODY_TOO_LARGE'].includes(code),
    quotaConsumed: false,
    sources: recoverySources,
  }
}

// /chat/stream 主流程：
// 1. 解析并校验前端消息
// 2. 从知识库检索相关内容
// 3. 把检索结果转成 sources 和额外上下文
// 4. 调用 DeepSeek 流式生成
// 5. 按 start / delta / meta / done 逐段返回给前端
const handleChatStream = async (req, res) => {
  const requestId = randomUUID()
  const startedAt = Date.now()
  let chatAccess = null
  let recoverySources = []
  const cancellation = createChatCancellation(req, res, (outcome) => {
    if (chatAccess) chatAccess[outcome]()
  })
  const signal = cancellation.signal
  const ensureClientConnected = () => {
    if (signal.aborted) throw signal.reason || createClientDisconnectError()
  }
  const writeEvent = (payload) => {
    if (signal.aborted || res.destroyed || res.writableEnded) return false
    writeNdjson(res, payload)
    return true
  }

  try {
    const body = await parseJsonBody(req)
    ensureClientConnected()
    const validationError = validateMessages(body.messages)
    if (validationError) {
      return json(res, 400, {
        error: { code: 'INVALID_MESSAGES', message: validationError },
        requestId,
      })
    }

    chatAccess = beginChatAccess(req)
    ensureClientConnected()

    // Reserve quota first, then acknowledge the request before starting retrieval.
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      Vary: 'Origin',
      'X-Accel-Buffering': 'no',
      ...chatAccess.responseHeaders,
    })
    writeEvent({ type: 'start', requestId })
    writeEvent({ type: 'phase', phase: 'retrieval', requestId })
    ensureClientConnected()

    // 先确保 system prompt 存在，再提取最后一条用户问题做 RAG 检索。
    const messages = ensureSystemPrompt(body.messages)
    const userText = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

    // ---- RAG 检索：LightRAG 优先，关键词 RAG 回退 ----
    let ragHits = []
    let ragSources = []
    let ragContext = ''
    let ragUsed = 'none'
    let ragCandidateCount = 0

    if (LIGHTRAG_PRIMARY && lightragIsHealthy) {
      try {
        const lightragResult = await queryLightRag(userText, {
          mode: 'hybrid',
          onlyNeedContext: true,
          includeChunkContent: true,
          timeoutMs: CHAT_LIGHTRAG_TIMEOUT_MS,
          signal,
        })
        ragContext = formatLightragContext(lightragResult?.response, lightragResult?.mode, {
          query: userText,
        })
        try {
          ragSources = lightragContextToSources(
            lightragResult?.response,
            lightragResult?.references,
          )
        } catch (srcErr) {
          console.log(
            JSON.stringify({
              level: 'warn',
              requestId,
              rag: 'lightrag_sources_error',
              message: srcErr?.message || 'unknown',
            }),
          )
          ragSources = []
        }
        if (ragContext) {
          ragUsed = 'lightrag'
        }
      } catch (err) {
        if (signal.aborted) throw signal.reason || createClientDisconnectError()
        console.log(
          JSON.stringify({
            level: 'warn',
            requestId,
            rag: 'lightrag_error',
            message: err?.message || 'unknown',
          }),
        )
        ragContext = ''
      }
    }

    if (!ragContext) {
      // 回退到关键词 + 向量混合检索
      const ragCandidates = await searchKnowledgeBase(userText, { limit: 3, signal })
      ragCandidateCount = ragCandidates.length
      ragHits = filterConfidentRagHits(ragCandidates)
      ragSources = ragHitsToSources(ragHits)
      ragContext = buildRagContext(ragHits, { query: userText })
      if (ragHits.length > 0) ragUsed = 'keyword'
    }
    if (ragContext) ragSources = mergePolicySources(userText, ragSources)
    ensureClientConnected()
    recoverySources = ragSources
    const useLowConfidenceResponse = !ragContext && !isSmallTalk(userText)
    if (useLowConfidenceResponse) ragUsed = 'low_confidence'

    // 把 RAG 上下文注入到消息列表
    const messagesForLlm =
      ragHits.length > 0
        ? appendRagContextToMessages(messages, ragHits, userText)
        : ragContext
          ? [...messages, { role: 'system', content: ragContext }]
          : messages

    // 低置信度时直接返回可解释的安全答复，不让模型基于无关资料猜测。
    // 其他情况保持原有模型流式生成路径。
    const lowConfidenceResult = useLowConfidenceResponse ? buildLowConfidenceResult(userText) : null
    if (!lowConfidenceResult) writeEvent({ type: 'phase', phase: 'generation', requestId })
    const content = lowConfidenceResult
      ? lowConfidenceResult.content
      : await requestOpenAICompatibleChatStream(messagesForLlm, requestId, {
          signal,
          onDelta(delta) {
            if (!delta || signal.aborted || res.destroyed || res.writableEnded) return
            cancellation.markFirstDelta()
            writeEvent({ type: 'delta', delta })
          },
        })
    if (lowConfidenceResult) {
      cancellation.markFirstDelta()
      writeEvent({ type: 'delta', delta: content })
    }
    ensureClientConnected()

    // sources 优先使用真实 RAG 命中；如果没命中，再退回规则型来源。
    const classified = lowConfidenceResult || classifyIntentAndVideoCue(content)
    const sourceCandidates = lowConfidenceResult
      ? []
      : ragSources.length > 0
        ? ragSources
        : buildRuleBasedSources(userText, classified.intent, 'real')
    const sources = adaptMessageSources(sourceCandidates)
    const feedbackEligible = await saveFeedbackReceipt({ requestId, chatAccess, sources })
    ensureClientConnected()

    writeEvent({
      type: 'meta',
      content,
      intent: classified.intent,
      videoCue: classified.videoCue,
      sources,
      requestId,
      feedbackEligible,
    })
    writeEvent({ type: 'done', requestId })
    cancellation.settle('commit')
    cancellation.markResponseFinished()
    res.end()

    const durationMs = Date.now() - startedAt
    console.log(
      JSON.stringify({
        level: 'info',
        requestId,
        path: '/chat/stream',
        providerMode: PROVIDER_MODE,
        intent: classified.intent,
        rag: ragUsed,
        ragHits: ragHits.length,
        ragCandidates: ragCandidateCount,
        durationMs,
      }),
    )
  } catch (error) {
    if (signal.aborted || error?.code === 'CLIENT_DISCONNECTED') {
      cancellation.settle('rollback')
      cancellation.dispose()
      return
    }
    cancellation.settle('rollback')
    // 流式接口分两种错误场景：
    // 1. 还没写响应头：直接返回普通 JSON 错误
    // 2. 已经开始流式输出：继续写一条 error 事件，再结束响应
    const durationMs = Date.now() - startedAt
    const code =
      error?.message === 'INVALID_JSON'
        ? 'INVALID_JSON'
        : error?.message === 'BODY_TOO_LARGE'
          ? 'BODY_TOO_LARGE'
          : error?.code || 'INTERNAL_ERROR'

    console.error(
      JSON.stringify({
        level: 'error',
        requestId,
        path: '/chat/stream',
        code,
        durationMs,
        message: error?.message || 'Unknown error',
      }),
    )

    if (res.headersSent) {
      writeEvent({
        type: 'error',
        error: buildChatError(code, recoverySources),
        requestId,
      })
      cancellation.markResponseFinished()
      return res.end()
    }

    const statusCode =
      code === 'GUEST_LOGIN_REQUIRED'
        ? 401
        : code === 'INVALID_JSON' || code === 'BODY_TOO_LARGE'
        ? 400
        : code.startsWith('LLM_')
          ? 502
          : 500

    cancellation.dispose()
    return json(res, statusCode, {
      error: buildChatError(code, recoverySources),
      requestId,
    })
  }
}

// /chat 非流式接口：
// 逻辑与 /chat/stream 基本一致，只是最后一次性返回完整结果。
const handleChat = async (req, res) => {
  const requestId = randomUUID()
  const startedAt = Date.now()
  let chatAccess = null
  let recoverySources = []

  try {
    const body = await parseJsonBody(req)
    const validationError = validateMessages(body.messages)
    if (validationError) {
      return json(res, 400, {
        error: { code: 'INVALID_MESSAGES', message: validationError },
        requestId,
      })
    }

    chatAccess = beginChatAccess(req)

    // 先做 system prompt 补全，再拿用户问题做检索。
    const messages = ensureSystemPrompt(body.messages)
    const userText = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

    // ---- RAG 检索：LightRAG 优先，关键词 RAG 回退 ----
    let ragHits = []
    let ragSources = []
    let ragContext = ''
    let ragUsed = 'keyword'
    let ragCandidateCount = 0

    if (LIGHTRAG_PRIMARY && lightragIsHealthy) {
      try {
        const lightragResult = await queryLightRag(userText, {
          mode: 'hybrid',
          onlyNeedContext: true,
          includeChunkContent: true,
          timeoutMs: CHAT_LIGHTRAG_TIMEOUT_MS,
        })
        ragContext = formatLightragContext(lightragResult?.response, lightragResult?.mode, {
          query: userText,
        })
        try {
          ragSources = lightragContextToSources(
            lightragResult?.response,
            lightragResult?.references,
          )
        } catch {
          ragSources = []
        }
        if (ragContext) ragUsed = 'lightrag'
      } catch {
        // LightRAG 查询本身失败，清空 context 触发回退
        ragContext = ''
        ragSources = []
      }
    }

    if (!ragContext) {
      const ragCandidates = await searchKnowledgeBase(userText, { limit: 3 })
      ragCandidateCount = ragCandidates.length
      ragHits = filterConfidentRagHits(ragCandidates)
      ragSources = ragHitsToSources(ragHits)
      ragContext = buildRagContext(ragHits, { query: userText })
    }
    if (ragContext) ragSources = mergePolicySources(userText, ragSources)
    recoverySources = ragSources
    const useLowConfidenceResponse = !ragContext && !isSmallTalk(userText)
    if (useLowConfidenceResponse) ragUsed = 'low_confidence'

    let content = ''
    let intent = 'general'
    let videoCue = 'idle'
    let sources = []

    // 把知识库上下文附加到消息列表中，让大模型带着资料回答。
    const messagesForLlm =
      ragHits.length > 0
        ? appendRagContextToMessages(messages, ragHits, userText)
        : ragContext
          ? [...messages, { role: 'system', content: ragContext }]
          : messages
    if (useLowConfidenceResponse) {
      const lowConfidenceResult = buildLowConfidenceResult(userText)
      content = lowConfidenceResult.content
      intent = lowConfidenceResult.intent
      videoCue = lowConfidenceResult.videoCue
      sources = lowConfidenceResult.sources
    } else {
      content = await requestOpenAICompatibleChat(messagesForLlm, requestId)
      const classified = classifyIntentAndVideoCue(content)
      intent = classified.intent
      videoCue = classified.videoCue
      sources = ragSources.length > 0 ? ragSources : buildRuleBasedSources(userText, intent, 'real')
    }
    sources = adaptMessageSources(sources)
    const feedbackEligible = await saveFeedbackReceipt({ requestId, chatAccess, sources })

    const durationMs = Date.now() - startedAt
    console.log(
      JSON.stringify({
        level: 'info',
        requestId,
        path: '/chat',
        providerMode: PROVIDER_MODE,
        intent,
        rag: ragUsed,
        ragHits: ragHits.length,
        ragCandidates: ragCandidateCount,
        durationMs,
      }),
    )

    chatAccess.commit()
    return json(
      res,
      200,
      {
        content,
        intent,
        videoCue,
        sources,
        requestId,
        feedbackEligible,
      },
      chatAccess.responseHeaders,
    )
  } catch (error) {
    chatAccess?.rollback()
    // 非流式接口的错误处理更简单，统一返回一个 JSON 错误对象即可。
    const durationMs = Date.now() - startedAt
    const code =
      error?.message === 'INVALID_JSON'
        ? 'INVALID_JSON'
        : error?.message === 'BODY_TOO_LARGE'
          ? 'BODY_TOO_LARGE'
          : error?.code || 'INTERNAL_ERROR'

    const statusCode =
      code === 'GUEST_LOGIN_REQUIRED'
        ? 401
        : code === 'INVALID_JSON' || code === 'BODY_TOO_LARGE'
        ? 400
        : code.startsWith('LLM_')
          ? 502
          : 500

    console.error(
      JSON.stringify({
        level: 'error',
        requestId,
        path: '/chat',
        code,
        durationMs,
        message: error?.message || 'Unknown error',
      }),
    )

    return json(res, statusCode, {
      error: buildChatError(code, recoverySources),
      requestId,
    })
  }
}

// 原生 Node HTTP 服务入口。
// 这里统一处理 CORS、健康检查、聊天接口和知识库下载接口。
const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    return json(res, 400, { error: { code: 'BAD_REQUEST', message: 'Invalid request' } })
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`)
  // 同时兼容 /chat 和 /api/chat 两种前缀，避免前端代理配置差异导致 404。
  const isPath = (path) => requestUrl.pathname === path || requestUrl.pathname === `/api${path}`

  // 预检请求：浏览器跨域时会先发 OPTIONS。
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
      Vary: 'Origin',
    })
    return res.end()
  }

  // 健康检查接口，用于确认后端是否正常启动。
  if (req.method === 'GET' && isPath('/health')) {
    return json(res, 200, {
      ok: true,
      service: 'ai-campus-agent-backend',
      releaseId: process.env.DEPLOY_RELEASE_ID || 'local',
      providerMode: PROVIDER_MODE,
      model: LLM_MODEL,
      time: new Date().toISOString(),
    })
  }

  const authHandled = await handleAuthRoute(req, res, requestUrl, {
    json,
    parseJsonBody,
  })
  if (authHandled !== false) {
    return authHandled
  }

  const feedbackHandled = await handleFeedbackRoute(req, res, requestUrl, {
    json,
    parseJsonBody,
    allowOrigin: ALLOW_ORIGIN,
  })
  if (feedbackHandled !== false) {
    return feedbackHandled
  }

  // 学生社区模块接口。
  // 当前先接入“可联调骨架”，后续再逐步替换为 MySQL 实现。
  const communityHandled = await handleCommunityRoute(req, res, requestUrl, {
    json,
    parseJsonBody,
  })
  if (communityHandled !== false) {
    return communityHandled
  }

  const ttsHandled = await handleTtsRoute(req, res, {
    json,
    parseJsonBody,
    allowOrigin: ALLOW_ORIGIN,
  })
  if (ttsHandled !== false) {
    return ttsHandled
  }

  // 非流式聊天接口。
  if (req.method === 'POST' && isPath('/chat')) {
    return handleChat(req, res)
  }

  // 流式聊天接口。
  if (req.method === 'POST' && isPath('/chat/stream')) {
    return handleChatStream(req, res)
  }

  // 知识库文件下载接口。
  if (req.method === 'GET' && isPath('/kb/download')) {
    if (!requireAdminOrRespond(req, res)) return
    return handleKnowledgeBaseDownload(req, res)
  }

  // LightRAG 反向代理：让前端管理面板通过后端访问 LightRAG 自带的 Web UI。
  // /lightrag/xxx → http://127.0.0.1:9621/xxx
  if (requestUrl.pathname.startsWith('/lightrag') || requestUrl.pathname.startsWith('/api/lightrag')) {
    if (!requireAdminOrRespond(req, res)) return
    const targetPath = requestUrl.pathname.replace(/^\/api\/lightrag/, '/lightrag').replace(/^\/lightrag/, '')
    const targetUrl = new URL(targetPath || '/', LIGHTRAG_API_BASE_URL)

    const proxyReq = httpRequest(
      targetUrl,
      {
        method: req.method,
        headers: { ...req.headers, host: targetUrl.host },
      },
      (proxyRes) => {
        // 复制响应头；先删除上游的 CORS 头，避免与 ALLOW_ORIGIN 冲突导致浏览器拦截
        const headers = { ...proxyRes.headers }
        delete headers['access-control-allow-origin']
        delete headers['Access-Control-Allow-Origin']
        headers['Access-Control-Allow-Origin'] = ALLOW_ORIGIN
        res.writeHead(proxyRes.statusCode, headers)
        proxyRes.pipe(res)
      },
    )

    proxyReq.on('error', () => {
      if (!res.headersSent) {
        json(res, 502, {
          error: { code: 'LIGHTRAG_PROXY_ERROR', message: 'LightRAG 服务不可达，请确认服务已启动' },
        })
      } else {
        res.destroy()
      }
    })

    // 转发请求体（POST 等）
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq)
    } else {
      proxyReq.end()
    }

    return
  }

  return json(res, 404, {
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  })
})

server.listen(PORT, HOST, () => {
  console.log(
    `AI Campus backend listening on http://${HOST}:${PORT} (provider: ${PROVIDER_MODE}, model: ${LLM_MODEL})`,
  )
})
