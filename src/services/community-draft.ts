// 6.2：社区投稿/回复草稿，按 ownerScope 隔离；取消保留，只有显式丢弃或提交成功才清空。
export type CommunityPostDraft = {
  authorName: string
  category: string
  title: string
  content: string
  tagsText: string
}

export type CommunityReplyDraft = {
  authorName: string
  content: string
}

export type DraftStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const KEY_PREFIX = 'ai-campus-agent.community-draft.v1'
const POST_LIMITS = { authorName: 20, category: 50, title: 150, content: 1000, tagsText: 300 }
const REPLY_LIMITS = { authorName: 20, content: 800 }

const getDefaultStorage = (): DraftStorage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

// 与对话仓库一致：登录用户按 userId 隔离，未登录使用 guest:local。
export const communityDraftScope = (userId?: string) => (userId ? `user:${userId}` : 'guest:local')

const postKey = (scope: string) => `${KEY_PREFIX}.${scope}.post`
const replyKey = (scope: string, postId: string) => `${KEY_PREFIX}.${scope}.reply.${postId}`

const text = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''

const readJson = (storage: DraftStorage | null, key: string) => {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const writeJson = (storage: DraftStorage | null, key: string, value: unknown) => {
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // 无痕模式/配额不足时仅保留内存状态。
  }
}

const remove = (storage: DraftStorage | null, key: string) => {
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    // ignore
  }
}

export const hasPostDraftContent = (draft: CommunityPostDraft) =>
  Boolean(draft.title || draft.content || draft.tagsText || draft.authorName)

export const hasReplyDraftContent = (draft: CommunityReplyDraft) =>
  Boolean(draft.content || draft.authorName)

export const savePostDraft = (
  scope: string,
  draft: CommunityPostDraft,
  storage: DraftStorage | null = getDefaultStorage(),
) => {
  const normalized: CommunityPostDraft = {
    authorName: text(draft.authorName, POST_LIMITS.authorName),
    category: text(draft.category, POST_LIMITS.category),
    title: text(draft.title, POST_LIMITS.title),
    content: text(draft.content, POST_LIMITS.content),
    tagsText: text(draft.tagsText, POST_LIMITS.tagsText),
  }
  if (!hasPostDraftContent(normalized)) {
    remove(storage, postKey(scope))
    return
  }
  writeJson(storage, postKey(scope), normalized)
}

export const readPostDraft = (
  scope: string,
  storage: DraftStorage | null = getDefaultStorage(),
): CommunityPostDraft | null => {
  const parsed = readJson(storage, postKey(scope))
  if (!parsed) return null
  const draft: CommunityPostDraft = {
    authorName: text(parsed.authorName, POST_LIMITS.authorName),
    category: text(parsed.category, POST_LIMITS.category),
    title: text(parsed.title, POST_LIMITS.title),
    content: text(parsed.content, POST_LIMITS.content),
    tagsText: text(parsed.tagsText, POST_LIMITS.tagsText),
  }
  return hasPostDraftContent(draft) ? draft : null
}

export const clearPostDraft = (
  scope: string,
  storage: DraftStorage | null = getDefaultStorage(),
) => remove(storage, postKey(scope))

export const saveReplyDraft = (
  scope: string,
  postId: string,
  draft: CommunityReplyDraft,
  storage: DraftStorage | null = getDefaultStorage(),
) => {
  if (!postId) return
  const normalized: CommunityReplyDraft = {
    authorName: text(draft.authorName, REPLY_LIMITS.authorName),
    content: text(draft.content, REPLY_LIMITS.content),
  }
  if (!hasReplyDraftContent(normalized)) {
    remove(storage, replyKey(scope, postId))
    return
  }
  writeJson(storage, replyKey(scope, postId), normalized)
}

export const readReplyDraft = (
  scope: string,
  postId: string,
  storage: DraftStorage | null = getDefaultStorage(),
): CommunityReplyDraft | null => {
  if (!postId) return null
  const parsed = readJson(storage, replyKey(scope, postId))
  if (!parsed) return null
  const draft: CommunityReplyDraft = {
    authorName: text(parsed.authorName, REPLY_LIMITS.authorName),
    content: text(parsed.content, REPLY_LIMITS.content),
  }
  return hasReplyDraftContent(draft) ? draft : null
}

export const clearReplyDraft = (
  scope: string,
  postId: string,
  storage: DraftStorage | null = getDefaultStorage(),
) => {
  if (!postId) return
  remove(storage, replyKey(scope, postId))
}
