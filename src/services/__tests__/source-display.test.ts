import { describe, expect, it } from 'vitest'
import {
  resolveSourceHref,
  sourceMetaText,
  sourceTypeLabel,
  sourceTypeTagLabel,
  sourceValidityLabel,
  sourceValidityNote,
} from '../source-display'

describe('source-display', () => {
  it('把后端来源类型映射为稳定中文标签', () => {
    expect(sourceTypeTagLabel('official')).toBe('官方来源')
    expect(sourceTypeTagLabel('community')).toBe('社区经验')
    expect(sourceTypeTagLabel('rule')).toBe('规则依据')
    expect(sourceTypeTagLabel('knowledge_base')).toBe('知识库')
    expect(sourceTypeTagLabel(undefined)).toBe('知识库')
    expect(sourceTypeLabel('official')).toBe('官方来源')
  })

  it('缺失日期时明确显示“日期未提供”，而不是留空或编造', () => {
    expect(sourceMetaText({ title: '通知' })).toBe('日期未提供')
    expect(
      sourceMetaText({
        title: '通知',
        applicablePeriod: '2025-2026 学年',
        publishedAt: '2025-09-01',
      }),
    ).toBe('适用 2025-2026 学年 · 发布 2025/09/01')
  })

  it('无效日期不会被当成真实时间展示', () => {
    expect(sourceMetaText({ title: '通知', publishedAt: 'not-a-date' })).toBe('日期未提供')
  })

  it('时效状态与来源栏提示一致', () => {
    expect(sourceValidityLabel('current')).toBe('现行有效')
    expect(sourceValidityLabel('expired')).toBe('已失效')
    expect(sourceValidityLabel('unknown')).toBe('时效未知')
    expect(sourceValidityNote([{ validity: 'expired' }])).toContain('历史通知')
    expect(sourceValidityNote([{ validity: 'current' }])).toContain('有效期内')
    expect(sourceValidityNote([])).toContain('最新通知')
  })

  it('来源链接走统一 API 根，空地址不构造链接', () => {
    expect(resolveSourceHref()).toBe('')
    expect(resolveSourceHref('/kb/download?docId=1')).toMatch(/\/api\/kb\/download\?docId=1$/)
    expect(resolveSourceHref('/kb/download?docId=1')).not.toContain('/api/api/')
    expect(resolveSourceHref('https://example.com/a.pdf')).toBe('https://example.com/a.pdf')
  })
})
