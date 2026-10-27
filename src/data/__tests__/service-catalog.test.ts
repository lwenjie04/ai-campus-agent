import { describe, expect, it } from 'vitest'
import catalog from '../../../docs/service-catalog-v2.json'
import {
  DEFAULT_SERVICE_CATEGORY,
  SERVICE_CATEGORIES,
  SERVICE_ITEMS,
  getServiceCategory,
  getServiceItem,
  listServiceItems,
} from '@/data/services'
import type { ServiceCategoryId } from '@/types/service'

// 5.1 已人工确认的清单字段；5.2 只做前端适配，不在此复制政策正文。
const CATEGORY_IDS: ServiceCategoryId[] = ['teaching', 'exam', 'scholarship', 'life']

describe('办事事项数据适配', () => {
  it('四类与事项清单的分类 ID 一致', () => {
    expect(SERVICE_CATEGORIES.map((category) => category.id).sort()).toEqual([...CATEGORY_IDS].sort())
    expect(SERVICE_CATEGORIES.map((category) => category.id).sort()).toEqual(
      [...catalog.categoryIds].sort(),
    )
  })

  it('清单中的 12 项全部载入，且四类各 3 项', () => {
    expect(SERVICE_ITEMS).toHaveLength(catalog.items.length)
    expect(SERVICE_ITEMS).toHaveLength(12)

    for (const categoryId of CATEGORY_IDS) {
      expect(listServiceItems(categoryId)).toHaveLength(3)
    }
    expect(
      new Set(SERVICE_ITEMS.map((item) => item.id)),
    ).toEqual(new Set(catalog.items.map((item) => item.id)))
  })

  it('事项 ID 唯一，页面必需字段齐全', () => {
    const ids = SERVICE_ITEMS.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const item of SERVICE_ITEMS) {
      expect(item.title.length).toBeGreaterThan(0)
      expect(item.purpose.length).toBeGreaterThan(0)
      expect(item.keywords.length).toBeGreaterThan(0)
      expect(item.source.title.length).toBeGreaterThan(0)
      expect(item.source.checkedAt).toBeTruthy()
    }
  })

  it('当前清单的 actionUrl 全部为空，页面不渲染办理入口', () => {
    expect(catalog.items.every((item) => item.actionUrl === null)).toBe(true)
    expect(SERVICE_ITEMS.every((item) => item.actionUrl === null)).toBe(true)
  })

  it('按 ID 查找事项，不存在时返回 undefined', () => {
    expect(getServiceItem('teaching-transfer-major')?.title).toBe('转专业申请')
    expect(getServiceItem('life-facility-repair')?.category).toBe('life')
    expect(getServiceItem('not-a-service')).toBeUndefined()
    expect(getServiceItem('')).toBeUndefined()
    expect(getServiceItem(['teaching-transfer-major'])).toBeUndefined()
  })

  it('分类元数据可用于面包屑与筛选标题', () => {
    expect(getServiceCategory('exam').label).toBe('考试安排')
    expect(getServiceCategory(DEFAULT_SERVICE_CATEGORY.id)).toBe(DEFAULT_SERVICE_CATEGORY)
  })
})
