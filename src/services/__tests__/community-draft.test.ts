import { describe, expect, it } from 'vitest'
import {
  clearPostDraft,
  clearReplyDraft,
  communityDraftScope,
  hasPostDraftContent,
  readPostDraft,
  readReplyDraft,
  savePostDraft,
  saveReplyDraft,
  type DraftStorage,
} from '../community-draft'

const createStorage = (): DraftStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

describe('community-draft', () => {
  it('按登录身份隔离草稿，游客与用户互不覆盖', () => {
    const storage = createStorage()
    savePostDraft('guest:local', { authorName: '游客', category: 'teaching', title: '游客草稿', content: '内容', tagsText: '' }, storage)
    savePostDraft(communityDraftScope('u1'), { authorName: '张同学', category: 'life', title: '用户草稿', content: '内容', tagsText: '' }, storage)

    expect(readPostDraft('guest:local', storage)?.title).toBe('游客草稿')
    expect(readPostDraft('user:u1', storage)?.title).toBe('用户草稿')
    expect(storage.data.size).toBe(2)
  })

  it('空草稿不落盘，多于空白会被规范化', () => {
    const storage = createStorage()
    savePostDraft('guest:local', { authorName: '', category: '', title: '   ', content: '', tagsText: '' }, storage)
    expect(readPostDraft('guest:local', storage)).toBeNull()

    savePostDraft('guest:local', { authorName: ' 张 同学 ', category: 'teaching', title: ' 标题 ', content: ' 正文 ', tagsText: ' a，b ' }, storage)
    expect(readPostDraft('guest:local', storage)).toEqual({
      authorName: '张 同学',
      category: 'teaching',
      title: '标题',
      content: '正文',
      tagsText: 'a，b',
    })
  })

  it('回复草稿按帖子 ID 隔离，清理只影响目标帖', () => {
    const storage = createStorage()
    saveReplyDraft('user:u1', 'post_a', { authorName: '李同学', content: '回复 A' }, storage)
    saveReplyDraft('user:u1', 'post_b', { authorName: '李同学', content: '回复 B' }, storage)

    clearReplyDraft('user:u1', 'post_a', storage)
    expect(readReplyDraft('user:u1', 'post_a', storage)).toBeNull()
    expect(readReplyDraft('user:u1', 'post_b', storage)?.content).toBe('回复 B')
  })

  it('损坏或非对象 JSON 读取为 null，清空草稿后不再恢复', () => {
    const storage = createStorage()
    storage.setItem('ai-campus-agent.community-draft.v1.guest:local.post', 'not-json')
    expect(readPostDraft('guest:local', storage)).toBeNull()

    savePostDraft('guest:local', { authorName: '', category: '', title: '标题', content: '', tagsText: '' }, storage)
    expect(hasPostDraftContent(readPostDraft('guest:local', storage)!)).toBe(true)
    clearPostDraft('guest:local', storage)
    expect(readPostDraft('guest:local', storage)).toBeNull()
  })
})
