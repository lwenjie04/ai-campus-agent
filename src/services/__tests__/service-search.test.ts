import { describe, expect, it } from 'vitest'
import { SERVICE_ITEMS } from '@/data/services'
import { buildAskQuestion, matchServiceItem, searchServiceItems } from '../service-search'

const ids = (term: string) => searchServiceItems(term).map((item) => item.id)

describe('办事事项搜索', () => {
  it('匹配事项标题', () => {
    expect(ids('转专业')).toContain('teaching-transfer-major')
    expect(ids('大学英语')).toEqual(['exam-cet-registration'])
    expect(ids('报修')).toEqual(['life-facility-repair'])
  })

  it('匹配关键词，忽略大小写与首尾空白', () => {
    expect(ids('cet')).toEqual(['exam-cet-registration'])
    expect(ids(' CET ')).toEqual(['exam-cet-registration'])
    expect(ids('挂失')).toEqual(['life-campus-card-library'])
    expect(ids('国家奖学金')).toContain('scholarship-national-awards')
  })

  it('不匹配只出现在用途或来源中的词', () => {
    // “材料”“时间安排”只出现在 purpose，不在任何事项标题与关键词中。
    expect(ids('材料')).toEqual([])
    expect(ids('时间安排')).toEqual([])
    expect(ids('结果查询')).toEqual([])
  })

  it('空搜索词不返回结果', () => {
    expect(ids('')).toEqual([])
    expect(ids('   ')).toEqual([])
  })

  it('匹配函数只检查标题与关键词', () => {
    const item = SERVICE_ITEMS.find((entry) => entry.id === 'teaching-transfer-major')
    expect(item).toBeTruthy()
    expect(matchServiceItem(item!, '转专业')).toBe(true)
    expect(matchServiceItem(item!, '时间安排')).toBe(false)
    expect(matchServiceItem(item!, '')).toBe(false)
  })

  it('无结果转问的问题包含搜索词', () => {
    const question = buildAskQuestion(' 材料 ')
    expect(question).toContain('材料')
    expect(question).toContain('帮我查一下')
    expect(buildAskQuestion('   ')).toBe('')
  })
})
