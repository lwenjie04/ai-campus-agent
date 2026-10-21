import { describe, expect, it } from 'vitest'
import {
  buildCommunityQuery,
  clampCommunityPage,
  communityTotalPages,
  parseCommunityQuery,
} from '../community-query'

describe('community-query', () => {
  it('默认解析为无筛选、最新、第 1 页', () => {
    expect(parseCommunityQuery({}, ['teaching', 'life'])).toEqual({
      keyword: '',
      category: '',
      sort: 'latest',
      page: 1,
    })
  })

  it('读取合法筛选并忽略未知分类/排序/页码', () => {
    expect(
      parseCommunityQuery(
        { q: ' 转专业 ', category: 'teaching', sort: 'hot', page: '2' },
        ['teaching', 'life'],
      ),
    ).toEqual({ keyword: '转专业', category: 'teaching', sort: 'hot', page: 2 })

    expect(parseCommunityQuery({ category: 'unknown', sort: 'bad', page: '-3' }, ['teaching'])).toEqual({
      keyword: '',
      category: '',
      sort: 'latest',
      page: 1,
    })
  })

  it('构建 URL 时省略默认值，保留有效筛选', () => {
    expect(
      buildCommunityQuery({ keyword: ' 宿舍 ', category: 'life', sort: 'hot', page: 3 }),
    ).toEqual({ q: '宿舍', category: 'life', sort: 'hot', page: '3' })
    expect(buildCommunityQuery({ keyword: '', category: '', sort: 'latest', page: 1 })).toEqual({})
  })

  it('分页数与越界页码回落在最后一页', () => {
    expect(communityTotalPages(0, 10)).toBe(1)
    expect(communityTotalPages(21, 10)).toBe(3)
    expect(communityTotalPages(21, 0)).toBe(3)
    expect(clampCommunityPage(9, 21, 10)).toBe(3)
    expect(clampCommunityPage(0, 21, 10)).toBe(1)
    expect(clampCommunityPage(2, 0, 10)).toBe(1)
  })
})
