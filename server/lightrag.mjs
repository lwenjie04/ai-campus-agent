import './env-loader.mjs'

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/g, '')

const toNumber = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const LIGHTRAG_CONFIG = {
  baseUrl: trimTrailingSlash(process.env.LIGHTRAG_API_BASE_URL || 'http://127.0.0.1:9621'),
  apiKey: process.env.LIGHTRAG_API_KEY || '',
  insertEndpoint: process.env.LIGHTRAG_INSERT_ENDPOINT || '/documents/texts',
  queryEndpoint: process.env.LIGHTRAG_QUERY_ENDPOINT || '/query',
  timeoutMs: toNumber(process.env.LIGHTRAG_TIMEOUT_MS, 120000),
  queryMode: process.env.LIGHTRAG_QUERY_MODE || 'hybrid',
}

const buildUrl = (endpoint) => {
  const path = String(endpoint || '').startsWith('/') ? endpoint : `/${endpoint}`
  return `${LIGHTRAG_CONFIG.baseUrl}${path}`
}

const buildHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (LIGHTRAG_CONFIG.apiKey) {
    headers.Authorization = `Bearer ${LIGHTRAG_CONFIG.apiKey}`
    headers['X-API-Key'] = LIGHTRAG_CONFIG.apiKey
  }

  return headers
}

export const requestLightRag = async (endpoint, payload, options = {}) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || LIGHTRAG_CONFIG.timeoutMs)

  try {
    const resp = await fetch(buildUrl(endpoint), {
      method: options.method || 'POST',
      headers: buildHeaders(),
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: controller.signal,
    })

    const text = await resp.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (!resp.ok) {
      const err = new Error(`LightRAG request failed: HTTP ${resp.status}`)
      err.code = 'LIGHTRAG_HTTP_ERROR'
      err.status = resp.status
      err.data = data
      throw err
    }

    return data
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('LightRAG request timeout')
      err.code = 'LIGHTRAG_TIMEOUT'
      throw err
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export const checkLightRagHealth = async () =>
  requestLightRag('/health', undefined, {
    method: 'GET',
    timeoutMs: Math.min(LIGHTRAG_CONFIG.timeoutMs, 15000),
  })

export const insertLightRagTexts = async (texts, options = {}) => {
  const cleanTexts = Array.isArray(texts)
    ? texts.map((item) => String(item || '').trim()).filter(Boolean)
    : [String(texts || '').trim()].filter(Boolean)

  if (cleanTexts.length === 0) {
    return { skipped: true, reason: 'empty_texts' }
  }

  const payload = {
    texts: cleanTexts,
  }

  if (Array.isArray(options.fileSources)) {
    payload.file_sources = options.fileSources.map((item) => String(item || '').trim())
  } else if (options.fileSource) {
    payload.file_sources = cleanTexts.map((_, index) => `${options.fileSource}#${index + 1}`)
  }
  if (options.metadata && typeof options.metadata === 'object') payload.metadata = options.metadata

  return requestLightRag(LIGHTRAG_CONFIG.insertEndpoint, payload, {
    timeoutMs: options.timeoutMs,
  })
}

export const queryLightRag = async (query, options = {}) => {
  const payload = {
    query: String(query || ''),
    mode: options.mode || LIGHTRAG_CONFIG.queryMode,
    only_need_context: Boolean(options.onlyNeedContext),
  }

  if (Number.isFinite(Number(options.topK))) payload.top_k = Number(options.topK)
  if (options.responseType) payload.response_type = options.responseType
  if (options.includeChunkContent) payload.include_chunk_content = true

  return requestLightRag(LIGHTRAG_CONFIG.queryEndpoint, payload, {
    timeoutMs: options.timeoutMs,
  })
}

// ---------------------------------------------------------------------------
// 辅助函数：把 LightRAG 的检索结果转换为与 rag.mjs 兼容的格式，
// 方便注入 LLM prompt 和返回给前端展示。
// ---------------------------------------------------------------------------

/**
 * 将 LightRAG 返回的 response / references 转换成前端 MessageSource 数组。
 * LightRAG 图谱检索的可信度固定为 0.75（介于官方通知和社区经验之间）。
 */
export const lightragContextToSources = (response, references) => {
  const sources = []

  if (Array.isArray(references) && references.length > 0) {
    references.slice(0, 5).forEach((ref, index) => {
      // ref.content 可能是字符串、字符串数组、或 null
      let snippet = `参考资料 ${ref.reference_id || index + 1}`
      if (typeof ref.content === 'string' && ref.content) {
        snippet = ref.content.substring(0, 200)
      } else if (Array.isArray(ref.content) && ref.content.length > 0) {
        snippet = String(ref.content[0]).substring(0, 200)
      }

      sources.push({
        attachments: [],
        type: 'lightrag',
        confidence: 0.75,
        title: ref.file_path || `LightRAG 参考 ${index + 1}`,
        url: undefined,
        postId: undefined,
        loginRequiredHint: false,
        snippet,
        note: '以下内容由 LightRAG 知识图谱检索。',
      })
    })
  }

  return sources
}

/**
 * 将 LightRAG response 格式化为注入 LLM 的参考资料块。
 * 风格与 rag.mjs 中的 buildRagContext 保持一致。
 */
export const formatLightragContext = (response, queryMode) => {
  if (typeof response !== 'string' || !response.trim()) return ''

  const modeLabel =
    queryMode === 'hybrid'
      ? '混合（图谱+向量+关键词）'
      : queryMode === 'local'
        ? '局部图谱'
        : queryMode === 'global'
          ? '全局图谱'
          : queryMode === 'naive'
            ? '纯向量'
            : queryMode || 'hybrid'

  return [
    `以下是与当前问题相关的校园知识资料（由 LightRAG 知识图谱检索，检索模式：${modeLabel}）。`,
    '请优先参考这些结构化知识进行回答。',
    '',
    '---- LightRAG 检索上下文 ----',
    response,
    '---- 上下文结束 ----',
    '',
    '请直接回答，不要写空泛开场白，也不要重复用户问题。',
    '输出格式要求：',
    '1. 先用"结论"给出 1 到 2 句直接答案；',
    '2. 再用"办理步骤/关键信息"列出 3 到 5 条最关键的信息；',
    '3. 如有时间、材料、适用对象或风险提示，再用"提醒"补充；',
    '4. 语言简洁，像办事指引，不要写成长篇宣传文；',
    '5. 如果信息不足，请明确说"目前无法确认"或"请以学校最新官方通知为准"。',
  ].join('\n')
}
