/**
 * 浏览器控制台导出脚本（在已登录的通知详情页执行）
 *
 * 用法：
 * 1. 打开通知详情页（已登录状态）
 * 2. F12 -> Console
 * 3. 粘贴本脚本并回车执行
 *
 * 效果：
 * - 自动提取：标题、发布时间、正文、附件链接
 * - 下载 JSON 文件到本地
 * - 同时在控制台打印结果对象
 */

;(() => {
  const FILE_EXT_RE = /\.(pdf|doc|docx|xls|xlsx|zip|rar|7z|ppt|pptx|txt)(?:$|\?)/i

  const textOf = (el) => (el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const qs = (selectors, root = document) => {
    for (const sel of selectors) {
      const el = root.querySelector(sel)
      if (el) return el
    }
    return null
  }

  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector))

  const sanitizeFileName = (name) =>
    String(name || 'notice-export')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120)

  const resolveUrl = (href) => {
    try {
      return new URL(href, location.href).toString()
    } catch {
      return href || ''
    }
  }

  const extractTitle = () => {
    const candidate = qs([
      'h1',
      '.article-title',
      '.news-title',
      '.title',
      '[class*="title"]',
      '[id*="title"]',
      'meta[property="og:title"]',
    ])

    if (!candidate) return document.title || '未命名通知'

    if (candidate.tagName?.toLowerCase() === 'meta') {
      return candidate.getAttribute('content')?.trim() || document.title || '未命名通知'
    }

    return textOf(candidate) || document.title || '未命名通知'
  }

  const extractPublishTime = () => {
    const timeEl = qs([
      'time',
      '.pub-time',
      '.publish-time',
      '.article-time',
      '.news-time',
      '[class*="time"]',
      '[class*="date"]',
    ])

    const pool = [
      textOf(timeEl),
      textOf(document.body).slice(0, 1500),
      document.querySelector('meta[name="publishdate"]')?.getAttribute('content') || '',
      document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') || '',
    ]
      .filter(Boolean)
      .join(' ')

    const match =
      pool.match(/\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/) ||
      pool.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)

    return match ? match[0] : ''
  }

  const scoreContentRoot = (el) => {
    if (!el) return -1
    const text = textOf(el)
    if (!text) return -1

    let score = Math.min(2000, text.length)
    const cls = `${el.className || ''} ${el.id || ''}`.toLowerCase()
    if (/content|article|detail|news|main|text/.test(cls)) score += 800
    if (/footer|header|nav|menu|sidebar|aside/.test(cls)) score -= 1000
    if (el.querySelectorAll('p').length >= 3) score += 300
    if (el.querySelectorAll('a').length > 30) score -= 400
    return score
  }

  const cloneAndClean = (root) => {
    const clone = root.cloneNode(true)
    qsa('script, style, noscript, iframe', clone).forEach((n) => n.remove())
    qsa('button, .share, .breadcrumb, .crumb, .toolbar, .pagination', clone).forEach((n) => n.remove())
    return clone
  }

  const extractContentRoot = () => {
    const explicit = qs([
      'article',
      'main article',
      '.article-content',
      '.news-content',
      '.detail-content',
      '.content',
      '[class*="article-content"]',
      '[class*="news-content"]',
      '[id*="content"]',
      'main',
    ])
    if (explicit && textOf(explicit).length > 80) return explicit

    const candidates = qsa('article, main, div, section')
      .map((el) => ({ el, score: scoreContentRoot(el) }))
      .filter((x) => x.score > 100)
      .sort((a, b) => b.score - a.score)

    return candidates[0]?.el || document.body
  }

  const extractContentText = (root) => {
    const cleanRoot = cloneAndClean(root)
    const blocks = qsa('p, li, h1, h2, h3, h4, h5, h6, tr', cleanRoot)
      .map((el) => textOf(el))
      .filter(Boolean)

    const merged = (blocks.length ? blocks.join('\n') : textOf(cleanRoot))
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return merged
  }

  const extractAttachments = (root) => {
    const anchors = qsa('a[href]', root)
    const seen = new Set()
    const list = []

    for (const a of anchors) {
      const href = a.getAttribute('href') || ''
      const abs = resolveUrl(href)
      if (!FILE_EXT_RE.test(abs)) continue
      if (seen.has(abs)) continue
      seen.add(abs)

      const nameGuess =
        textOf(a) ||
        decodeURIComponent(abs.split('/').pop() || '')
          .split('?')[0]
          .trim() ||
        '附件'

      list.push({
        name: nameGuess,
        url: abs,
      })
    }

    return list
  }

  const title = extractTitle()
  const contentRoot = extractContentRoot()
  const content = extractContentText(contentRoot)
  const attachments = extractAttachments(document)
  const publishedAt = extractPublishTime()

  const exportData = {
    schemaVersion: 1,
    source: {
      site: location.origin,
      pageUrl: location.href,
      pageTitle: document.title || '',
      exportedAt: new Date().toISOString(),
    },
    notice: {
      title,
      publishedAt,
      content,
      attachments,
    },
  }

  const fileName = `${sanitizeFileName(title || 'notice')}.json`
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)

  console.log('[notice-export] 导出成功：', exportData)
  console.log(
    `[notice-export] 标题="${title}"，正文长度=${content.length}，附件数=${attachments.length}，文件=${fileName}`,
  )

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(JSON.stringify(exportData, null, 2))
      .then(() => console.log('[notice-export] JSON 已复制到剪贴板（同时已下载文件）'))
      .catch(() => {})
  }
})()

