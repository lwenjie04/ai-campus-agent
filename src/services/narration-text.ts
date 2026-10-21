// 4.5：TTS 文本清洗与分段策略，单独收口以便单测和复用。

// 腾讯云 TextToVoice 基础语音合成对中文长度限制较严（官方约 150 字），
// 这里保守收紧到 140，避免长回答第一段就因超限失败。
export const TTS_SEGMENT_MAX_LENGTH = 140

// 清理 markdown 痕迹与多余空白，避免 TTS 把符号读出来。
export const normalizeNarrationText = (raw: string) =>
  String(raw || '')
    .replace(/[`*_#>-]/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

// 按句末标点优先拆分；超长句再按最大长度硬切。
export const splitNarrationText = (raw: string, maxLength = TTS_SEGMENT_MAX_LENGTH) => {
  const normalized = normalizeNarrationText(raw)
  if (!normalized) return []
  if (normalized.length <= maxLength) return [normalized]

  const coarseParts = normalized
    .split(/(?<=[。！？；;.!?\n])/)
    .map((part) => part.trim())
    .filter(Boolean)

  const result: string[] = []
  let buffer = ''

  const flushBuffer = () => {
    const text = buffer.trim()
    if (text) result.push(text)
    buffer = ''
  }

  for (const part of coarseParts) {
    if (!part) continue

    if (part.length > maxLength) {
      flushBuffer()
      let start = 0
      while (start < part.length) {
        result.push(part.slice(start, start + maxLength).trim())
        start += maxLength
      }
      continue
    }

    const next = buffer ? `${buffer} ${part}`.trim() : part
    if (next.length > maxLength) {
      flushBuffer()
      buffer = part
    } else {
      buffer = next
    }
  }

  flushBuffer()
  return result
}
