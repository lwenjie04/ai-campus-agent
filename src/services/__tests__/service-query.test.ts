import { describe, expect, it } from 'vitest'
import { DEFAULT_SERVICE_CATEGORY } from '@/data/services'
import {
  buildServiceListQuery,
  parseServiceListCategory,
  serviceDetailLocation,
  serviceListLocation,
} from '../service-query'

describe('service-query', () => {
  it('缺失或非法分类回落到默认分类', () => {
    expect(parseServiceListCategory({})).toBe(DEFAULT_SERVICE_CATEGORY.id)
    expect(parseServiceListCategory({ category: 'unknown' })).toBe(DEFAULT_SERVICE_CATEGORY.id)
    expect(parseServiceListCategory({ category: '' })).toBe(DEFAULT_SERVICE_CATEGORY.id)
  })

  it('读取合法分类，数组查询取第一个值并去除空白', () => {
    expect(parseServiceListCategory({ category: 'exam' })).toBe('exam')
    expect(parseServiceListCategory({ category: ' life ' })).toBe('life')
    expect(parseServiceListCategory({ category: ['scholarship', 'exam'] })).toBe('scholarship')
  })

  it('列表筛选始终写入 URL，保证刷新、分享与返回可还原', () => {
    expect(buildServiceListQuery('life')).toEqual({ category: 'life' })
    expect(serviceListLocation('exam')).toEqual({
      path: '/services',
      query: { category: 'exam' },
    })
  })

  it('详情地址按事项 ID 编码，避免特殊字符破坏路径', () => {
    expect(serviceDetailLocation({ id: 'teaching-transfer-major' })).toEqual({
      path: '/services/teaching-transfer-major',
    })
    expect(serviceDetailLocation({ id: 'a b/c' })).toEqual({ path: '/services/a%20b%2Fc' })
  })
})
