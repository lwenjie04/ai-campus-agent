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

  return requestLightRag(LIGHTRAG_CONFIG.queryEndpoint, payload, {
    timeoutMs: options.timeoutMs,
  })
}
