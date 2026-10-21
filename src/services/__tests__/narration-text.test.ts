import { describe, expect, it } from 'vitest'
import {
  TTS_SEGMENT_MAX_LENGTH,
  normalizeNarrationText,
  splitNarrationText,
} from '../narration-text'

describe('narration-text', () => {
  it('清理 markdown 符号与多余空白', () => {
    expect(normalizeNarrationText('**先看通知**，`再确认` [原文](https://example.com)')).toBe(
      '先看通知 ， 再确认 原文',
    )
    expect(normalizeNarrationText('   \n  ')).toBe('')
  })

  it('短文本保持单段，空文本不生成片段', () => {
    expect(splitNarrationText('先核对本学年通知。')).toEqual(['先核对本学年通知。'])
    expect(splitNarrationText('   ')).toEqual([])
  })

  it('长文本按句末标点拆分且每段不超限', () => {
    const sentence = '这是一句用于测试分段策略的中文句子，包含办理条件与材料说明。'
    const text = sentence.repeat(12)
    const segments = splitNarrationText(text, TTS_SEGMENT_MAX_LENGTH)
    expect(segments.length).toBeGreaterThan(1)
    expect(segments.every((segment) => segment.length <= TTS_SEGMENT_MAX_LENGTH)).toBe(true)
    expect(segments.join('').replace(/\s/g, '')).toBe(text.replace(/\s/g, ''))
  })

  it('超长单句会被硬切而不是整段丢弃', () => {
    const segments = splitNarrationText('长'.repeat(300))
    expect(segments.length).toBe(3)
    expect(segments.every((segment) => segment.length <= TTS_SEGMENT_MAX_LENGTH)).toBe(true)
  })
})
