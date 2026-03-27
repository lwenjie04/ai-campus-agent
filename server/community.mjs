import { randomUUID } from 'node:crypto'
import { isMySqlConfigured, query } from './mysql.mjs'

// 社区模块的定位：
// 1. 先把接口边界和数据结构稳定下来
// 2. 当前阶段允许用模块内 mock 数据支持前端联调
// 3. 后续再把这里的 mock 存储替换成 MySQL 查询

const COMMUNITY_CATEGORIES = [
  { label: '奖学金', value: 'scholarship' },
  { label: '教务', value: 'teaching' },
  { label: '考试', value: 'exam' },
  { label: '生活服务', value: 'life' },
  { label: '其他', value: 'general' },
]

const HOT_TAGS = ['转专业', '奖学金', '补退选', '宿舍', '交通车']

// 当前先使用进程内 mock 数据支撑接口联调。
// 这样前端可以先把页面和交互做起来，后面接 MySQL 时再把这层替换掉。
const mockPosts = [
  {
    id: 'post_demo_001',
    authorName: '张同学',
    authorRole: 'student',
    title: '转专业后课程补退选怎么操作？',
    content:
      '我想问一下转专业之后课程补退选具体流程是什么？有没有同学办过，可以分享一下实际操作经验吗？',
    category: 'teaching',
    tags: ['转专业', '补退选'],
    status: 'approved',
    knowledgeStatus: 'none',
    replyCount: 1,
    likeCount: 6,
    viewCount: 38,
    createdAt: '2026-03-24T09:00:00.000Z',
    updatedAt: '2026-03-24T10:10:00.000Z',
  },
]

const mockReplies = [
  {
    id: 'reply_demo_001',
    postId: 'post_demo_001',
    authorName: '李同学',
    authorRole: 'student',
    content: '我去年是先看教务通知，再联系学院确认课程安排，然后按时间完成补退选。',
    status: 'approved',
    likeCount: 2,
    createdAt: '2026-03-24T10:00:00.000Z',
    updatedAt: '2026-03-24T10:00:00.000Z',
  },
]

const mockKnowledge = []

const ok = (res, data, message = 'ok') => json(res, 200, { code: 0, message, data })
const badRequest = (res, message) => json(res, 400, { code: 4001, message, data: null })
const notFound = (res, message = '未找到对应资源') => json(res, 404, { code: 4044, message, data: null })

let json = null
let parseJsonBody = null

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0

const normalizeTags = (value) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 10)
}

const validatePostPayload = (body) => {
  if (!isNonEmptyString(body.authorName)) return 'authorName 不能为空'
  if (!isNonEmptyString(body.title)) return 'title 不能为空'
  if (!isNonEmptyString(body.content)) return 'content 不能为空'
  if (!isNonEmptyString(body.category)) return 'category 不能为空'
  return null
}

const validateReplyPayload = (body) => {
  if (!isNonEmptyString(body.authorName)) return 'authorName 不能为空'
  if (!isNonEmptyString(body.content)) return 'content 不能为空'
  return null
}

const getApprovedRepliesByPostId = (postId) =>
  mockReplies.filter((reply) => reply.postId === postId && reply.status === 'approved')

const buildPostPreview = (post) => ({
  ...post,
  contentPreview: post.content.slice(0, 80),
})

const normalizeMySqlTags = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean)
      }
    } catch {
      // 字段不是 JSON 字符串时，退回空数组。
    }
  }
  return []
}

const mapMySqlPost = (row) => ({
  id: row.id,
  authorName: row.author_name,
  authorRole: row.author_role,
  title: row.title,
  content: row.content,
  contentPreview: String(row.content || '').slice(0, 80),
  category: row.category,
  tags: normalizeMySqlTags(row.tags),
  status: row.status,
  knowledgeStatus: row.knowledge_status || 'none',
  replyCount: Number(row.reply_count || 0),
  likeCount: Number(row.like_count || 0),
  viewCount: Number(row.view_count || 0),
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
  knowledgeCandidate: Boolean(row.knowledge_candidate ?? false),
  knowledgeCandidateScore: Number(row.knowledge_candidate_score || 0),
  knowledgeCandidateReasons: Array.isArray(row.knowledge_candidate_reasons)
    ? row.knowledge_candidate_reasons
    : normalizeMySqlTags(row.knowledge_candidate_reasons),
})

const mapMySqlReply = (row) => ({
  id: row.id,
  postId: row.post_id,
  authorName: row.author_name,
  authorRole: row.author_role,
  content: row.content,
  status: row.status,
  likeCount: Number(row.like_count || 0),
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
})

const mapMySqlKnowledge = (row) => ({
  id: row.id,
  postId: row.post_id,
  title: row.title,
  summary: row.summary,
  content: row.content,
  category: row.category,
  keywords: normalizeMySqlTags(row.keywords),
  confidence: Number(row.confidence || 0.45),
  status: row.status,
  sourceType: row.source_type,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
})

const listPostsFromMySql = async (requestUrl) => {
  const page = Math.max(1, Number(requestUrl.searchParams.get('page') || 1))
  const pageSize = Math.min(50, Math.max(1, Number(requestUrl.searchParams.get('pageSize') || 10)))
  const category = String(requestUrl.searchParams.get('category') || '').trim()
  const keyword = String(requestUrl.searchParams.get('keyword') || '').trim()
  const sortBy = String(requestUrl.searchParams.get('sortBy') || 'latest')
  const offset = (page - 1) * pageSize

  const where = ['status = ?']
  const params = ['approved']

  if (category) {
    where.push('category = ?')
    params.push(category)
  }

  if (keyword) {
    where.push('(title LIKE ? OR content LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  const orderBy =
    sortBy === 'hot'
      ? 'reply_count DESC, like_count DESC, created_at DESC'
      : 'created_at DESC'

  const whereSql = `WHERE ${where.join(' AND ')}`

  const listSql = `
    SELECT
      id,
      author_name,
      author_role,
      title,
      content,
      category,
      tags,
      status,
      knowledge_status,
      reply_count,
      like_count,
      view_count,
      created_at,
      updated_at
    FROM community_posts
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `

  const countSql = `
    SELECT COUNT(*) AS total
    FROM community_posts
    ${whereSql}
  `

  const [rows, countRows] = await Promise.all([
    query(listSql, [...params, pageSize, offset]),
    query(countSql, params),
  ])

  return {
    list: rows.map(mapMySqlPost),
    pagination: {
      page,
      pageSize,
      total: Number(countRows[0]?.total || 0),
    },
  }
}

const getPostDetailFromMySql = async (postId) => {
  const posts = await query(
    `
      SELECT
        id,
        author_name,
        author_role,
        title,
        content,
        category,
        tags,
        status,
        knowledge_status,
        reply_count,
        like_count,
        view_count,
        created_at,
        updated_at
      FROM community_posts
      WHERE id = ? AND status = 'approved'
      LIMIT 1
    `,
    [postId],
  )

  if (!posts.length) return null

  // 详情页浏览时顺带累加浏览数，不影响主流程。
  query(
    `
      UPDATE community_posts
      SET view_count = view_count + 1
      WHERE id = ?
    `,
    [postId],
  ).catch(() => {})

  const replies = await query(
    `
      SELECT
        id,
        post_id,
        author_name,
        author_role,
        content,
        status,
        like_count,
        created_at,
        updated_at
      FROM community_replies
      WHERE post_id = ? AND status = 'approved'
      ORDER BY created_at ASC
    `,
    [postId],
  )

  return {
    post: mapMySqlPost(posts[0]),
    replies: replies.map(mapMySqlReply),
  }
}

const getReviewPostDetailFromMySql = async (postId) => {
  const posts = await query(
    `
      SELECT
        id,
        author_name,
        author_role,
        title,
        content,
        category,
        tags,
        status,
        knowledge_status,
        reply_count,
        like_count,
        view_count,
        created_at,
        updated_at
      FROM community_posts
      WHERE id = ?
      LIMIT 1
    `,
    [postId],
  )

  if (!posts.length) return null

  const replies = await query(
    `
      SELECT
        id,
        post_id,
        author_name,
        author_role,
        content,
        status,
        like_count,
        created_at,
        updated_at
      FROM community_replies
      WHERE post_id = ?
      ORDER BY created_at ASC
    `,
    [postId],
  )

  return {
    post: mapMySqlPost(posts[0]),
    replies: replies.map(mapMySqlReply),
  }
}

const shouldUseMySql = async () => {
  if (!isMySqlConfigured()) return false

  try {
    await query('SELECT 1 AS ok')
    return true
  } catch (error) {
    console.warn(
      `[community] MySQL unavailable, fallback to mock: ${error?.code || error?.message || 'UNKNOWN_ERROR'}`,
    )
    return false
  }
}

const listPosts = (requestUrl) => {
  const page = Math.max(1, Number(requestUrl.searchParams.get('page') || 1))
  const pageSize = Math.min(50, Math.max(1, Number(requestUrl.searchParams.get('pageSize') || 10)))
  const category = String(requestUrl.searchParams.get('category') || '').trim()
  const keyword = String(requestUrl.searchParams.get('keyword') || '').trim().toLowerCase()
  const sortBy = String(requestUrl.searchParams.get('sortBy') || 'latest')

  let rows = mockPosts.filter((post) => post.status === 'approved')

  if (category) {
    rows = rows.filter((post) => post.category === category)
  }

  if (keyword) {
    rows = rows.filter((post) => {
      const target = `${post.title} ${post.content} ${post.tags.join(' ')}`.toLowerCase()
      return target.includes(keyword)
    })
  }

  rows = [...rows].sort((a, b) => {
    if (sortBy === 'hot') return b.replyCount + b.likeCount - (a.replyCount + a.likeCount)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const total = rows.length
  const start = (page - 1) * pageSize
  const list = rows.slice(start, start + pageSize).map(buildPostPreview)

  return {
    list,
    pagination: {
      page,
      pageSize,
      total,
    },
  }
}

const getPostDetail = (postId) => {
  const post = mockPosts.find((item) => item.id === postId && item.status === 'approved')
  if (!post) return null

  post.viewCount += 1
  post.updatedAt = new Date().toISOString()

  return {
    post,
    replies: getApprovedRepliesByPostId(postId),
  }
}

const getReviewPostDetail = (postId) => {
  const post = mockPosts.find((item) => item.id === postId)
  if (!post) return null

  return {
    post,
    replies: mockReplies.filter((reply) => reply.postId === postId),
  }
}

const createPostInMySql = async (body) => {
  const id = `post_${randomUUID().slice(0, 8)}`
  const authorName = body.authorName.trim()
  const authorRole = body.authorRole === 'teacher' ? 'teacher' : 'student'
  const title = body.title.trim()
  const content = body.content.trim()
  const category = body.category.trim()
  const tags = normalizeTags(body.tags)

  await query(
    `
      INSERT INTO community_posts (
        id,
        author_name,
        author_role,
        title,
        content,
        category,
        tags,
        status,
        knowledge_status,
        quality_score,
        reply_count,
        like_count,
        view_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'none', 0.00, 0, 0, 0)
    `,
    [id, authorName, authorRole, title, content, category, JSON.stringify(tags)],
  )

  return {
    id,
    status: 'pending',
  }
}

const createPost = async (req, res) => {
  const body = await parseJsonBody(req)
  const validationError = validatePostPayload(body)
  if (validationError) return badRequest(res, validationError)

  if (await shouldUseMySql()) {
    const result = await createPostInMySql(body)
    return ok(res, result, '发布成功')
  }

  const now = new Date().toISOString()
  const post = {
    id: `post_${randomUUID().slice(0, 8)}`,
    authorName: body.authorName.trim(),
    authorRole: body.authorRole === 'teacher' ? 'teacher' : 'student',
    title: body.title.trim(),
    content: body.content.trim(),
    category: body.category.trim(),
    tags: normalizeTags(body.tags),
    status: 'pending',
    knowledgeStatus: 'none',
    replyCount: 0,
    likeCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  mockPosts.unshift(post)
  return ok(
    res,
    {
      id: post.id,
      status: post.status,
    },
    '发布成功',
  )
}

const createReplyInMySql = async (postId, body) => {
  const postRows = await query(
    `
      SELECT id
      FROM community_posts
      WHERE id = ?
      LIMIT 1
    `,
    [postId],
  )

  if (!postRows.length) {
    const err = new Error('POST_NOT_FOUND')
    err.code = 'POST_NOT_FOUND'
    throw err
  }

  const id = `reply_${randomUUID().slice(0, 8)}`
  const authorName = body.authorName.trim()
  const authorRole = body.authorRole === 'teacher' ? 'teacher' : 'student'
  const content = body.content.trim()

  await query(
    `
      INSERT INTO community_replies (
        id,
        post_id,
        author_name,
        author_role,
        content,
        status,
        quality_score,
        like_count
      ) VALUES (?, ?, ?, ?, ?, 'pending', 0.00, 0)
    `,
    [id, postId, authorName, authorRole, content],
  )

  return {
    id,
    status: 'pending',
  }
}

const createReply = async (req, res, postId) => {
  const body = await parseJsonBody(req)
  const validationError = validateReplyPayload(body)
  if (validationError) return badRequest(res, validationError)

  if (await shouldUseMySql()) {
    try {
      const result = await createReplyInMySql(postId, body)
      return ok(res, result, '回复成功')
    } catch (error) {
      if (error?.code === 'POST_NOT_FOUND') {
        return notFound(res, '帖子不存在')
      }
      throw error
    }
  }

  const post = mockPosts.find((item) => item.id === postId)
  if (!post) return notFound(res, '帖子不存在')

  const now = new Date().toISOString()
  const reply = {
    id: `reply_${randomUUID().slice(0, 8)}`,
    postId,
    authorName: body.authorName.trim(),
    authorRole: body.authorRole === 'teacher' ? 'teacher' : 'student',
    content: body.content.trim(),
    status: 'pending',
    likeCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  mockReplies.push(reply)
  return ok(
    res,
    {
      id: reply.id,
      status: reply.status,
    },
    '回复成功',
  )
}

const writeReviewLog = async ({ targetType, targetId, action, reviewer = 'admin', note = '' }) => {
  await query(
    `
      INSERT INTO community_review_logs (
        target_type,
        target_id,
        action,
        reviewer,
        note
      ) VALUES (?, ?, ?, ?, ?)
    `,
    [targetType, targetId, action, reviewer, note || null],
  )
}

const listPendingPostsFromMySql = async () => {
  const rows = await query(
    `
      SELECT
        id,
        author_name,
        author_role,
        title,
        content,
        category,
        tags,
        status,
        knowledge_status,
        reply_count,
        like_count,
        view_count,
        created_at,
        updated_at
      FROM community_posts
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `,
  )

  return {
    list: rows.map(mapMySqlPost),
  }
}

const listPendingPosts = () => ({
  list: mockPosts.filter((post) => post.status === 'pending'),
})

const listPendingRepliesFromMySql = async () => {
  const rows = await query(
    `
      SELECT
        id,
        post_id,
        author_name,
        author_role,
        content,
        status,
        like_count,
        created_at,
        updated_at
      FROM community_replies
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `,
  )

  return {
    list: rows.map(mapMySqlReply),
  }
}

const listPendingReplies = () => ({
  list: mockReplies.filter((reply) => reply.status === 'pending'),
})

const computeKnowledgeCandidateMeta = (post) => {
  const reasons = []
  let score = 0

  if (['teaching', 'scholarship', 'exam', 'life'].includes(String(post.category || ''))) {
    reasons.push('重点分类')
    score += 2
  }

  if (Number(post.replyCount || 0) >= 1) {
    reasons.push('已有有效回复')
    score += 1
  }

  if (Number(post.viewCount || 0) >= 20) {
    reasons.push('浏览量达到阈值')
    score += 1
  }

  if (Number(post.replyCount || 0) >= 2) {
    reasons.push('回复数达到阈值')
    score += 1
  }

  if (Number(post.likeCount || 0) >= 3) {
    reasons.push('点赞数达到阈值')
    score += 1
  }

  return {
    knowledgeCandidate: reasons.length > 0,
    knowledgeCandidateScore: score,
    knowledgeCandidateReasons: reasons,
  }
}

const listKnowledgeCandidatesFromMock = () => ({
  list: mockPosts
    .filter(
      (post) =>
        post.status === 'approved' &&
        post.replyCount >= 1 &&
        (!post.knowledgeStatus || post.knowledgeStatus === 'none'),
    )
    .map((post) => ({
      ...post,
      ...computeKnowledgeCandidateMeta(post),
    }))
    .filter((post) => post.knowledgeCandidate),
})

const listKnowledgeCandidatesFromMySql = async () => {
  const rows = await query(
    `
      SELECT
        id,
        author_name,
        author_role,
        title,
        content,
        category,
        tags,
        status,
        knowledge_status,
        reply_count,
        like_count,
        view_count,
        created_at,
        updated_at
      FROM community_posts
      WHERE
        status = 'approved'
        AND knowledge_status = 'none'
        AND reply_count >= 1
        AND category IN ('teaching', 'scholarship', 'exam', 'life')
        AND (
          view_count >= 20
          OR reply_count >= 2
          OR like_count >= 3
        )
      ORDER BY updated_at DESC, created_at DESC
    `,
  )

  return {
    list: rows.map((row) => {
      const post = mapMySqlPost(row)
      return {
        ...post,
        ...computeKnowledgeCandidateMeta(post),
      }
    }),
  }
}

const listKnowledgeItemsFromMySql = async (requestUrl) => {
  const status = String(requestUrl.searchParams.get('status') || 'pending').trim() || 'pending'
  const rows = await query(
    `
      SELECT
        id,
        post_id,
        title,
        summary,
        content,
        category,
        keywords,
        confidence,
        status,
        source_type,
        created_at,
        updated_at
      FROM community_knowledge
      WHERE status = ?
      ORDER BY updated_at DESC, created_at DESC
    `,
    [status],
  )

  return {
    list: rows.map(mapMySqlKnowledge),
  }
}

const listKnowledgeItemsFromMock = (requestUrl) => {
  const status = String(requestUrl.searchParams.get('status') || 'pending').trim() || 'pending'
  return {
    list: mockKnowledge.filter((item) => item.status === status),
  }
}

const updateKnowledgeStatusFromMock = (knowledgeId, status) => {
  const target = mockKnowledge.find((item) => item.id === knowledgeId)
  if (!target) return null

  target.status = status
  target.updatedAt = new Date().toISOString()

  const sourcePost = mockPosts.find((post) => post.id === target.postId)
  if (sourcePost) {
    sourcePost.knowledgeStatus = status
  }

  return {
    id: knowledgeId,
    status,
  }
}

const updatePostStatusInMySql = async (postId, status, action, note = '') => {
  const rows = await query(
    `
      SELECT id
      FROM community_posts
      WHERE id = ?
      LIMIT 1
    `,
    [postId],
  )

  if (!rows.length) {
    const err = new Error('POST_NOT_FOUND')
    err.code = 'POST_NOT_FOUND'
    throw err
  }

  await query(
    `
      UPDATE community_posts
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [status, postId],
  )

  await writeReviewLog({
    targetType: 'post',
    targetId: postId,
    action,
    reviewer: 'admin',
    note,
  })

  return {
    id: postId,
    status,
  }
}

const updatePostStatus = (res, postId, status, message) => {
  const post = mockPosts.find((item) => item.id === postId)
  if (!post) return notFound(res, '帖子不存在')

  post.status = status
  post.updatedAt = new Date().toISOString()
  return ok(res, { id: post.id, status: post.status }, message)
}

const updateReplyStatus = (res, replyId, status, message) => {
  const reply = mockReplies.find((item) => item.id === replyId)
  if (!reply) return notFound(res, '回复不存在')

  reply.status = status
  reply.updatedAt = new Date().toISOString()

  const approvedReplies = getApprovedRepliesByPostId(reply.postId)
  const post = mockPosts.find((item) => item.id === reply.postId)
  if (post) {
    post.replyCount = approvedReplies.length
    post.updatedAt = new Date().toISOString()
  }

  return ok(res, { id: reply.id, status: reply.status }, message)
}

const updateReplyStatusInMySql = async (replyId, status, action, note = '') => {
  const rows = await query(
    `
      SELECT id, post_id
      FROM community_replies
      WHERE id = ?
      LIMIT 1
    `,
    [replyId],
  )

  if (!rows.length) {
    const err = new Error('REPLY_NOT_FOUND')
    err.code = 'REPLY_NOT_FOUND'
    throw err
  }

  const postId = rows[0].post_id

  await query(
    `
      UPDATE community_replies
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [status, replyId],
  )

  if (status === 'approved') {
    await query(
      `
        UPDATE community_posts
        SET
          reply_count = (
            SELECT COUNT(*)
            FROM community_replies
            WHERE post_id = ? AND status = 'approved'
          ),
          last_replied_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [postId, postId],
    )
  } else {
    await query(
      `
        UPDATE community_posts
        SET
          reply_count = (
            SELECT COUNT(*)
            FROM community_replies
            WHERE post_id = ? AND status = 'approved'
          ),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [postId, postId],
    )
  }

  await writeReviewLog({
    targetType: 'reply',
    targetId: replyId,
    action,
    reviewer: 'admin',
    note,
  })

  return {
    id: replyId,
    status,
  }
}

const updateKnowledgeStatusInMySql = async (knowledgeId, status, action, note = '') => {
  const rows = await query(
    `
      SELECT id, post_id
      FROM community_knowledge
      WHERE id = ?
      LIMIT 1
    `,
    [knowledgeId],
  )

  if (!rows.length) {
    const err = new Error('KNOWLEDGE_NOT_FOUND')
    err.code = 'KNOWLEDGE_NOT_FOUND'
    throw err
  }

  await query(
    `
      UPDATE community_knowledge
      SET status = ?, review_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [status, note || null, knowledgeId],
  )

  await query(
    `
      UPDATE community_posts
      SET knowledge_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [status, rows[0].post_id],
  )

  await writeReviewLog({
    targetType: 'knowledge',
    targetId: knowledgeId,
    action,
    reviewer: 'admin',
    note,
  })

  return {
    id: knowledgeId,
    status,
  }
}

const buildCommunityKnowledgeSummary = ({ post, replies }) => {
  const cleanedTitle = String(post.title || '').replace(/[？?]$/, '')
  const replyCount = replies.length
  const categoryHint =
    post.category === 'teaching'
      ? '学院安排和教务通知'
      : post.category === 'scholarship'
        ? '材料要求和最新评审通知'
        : post.category === 'exam'
          ? '考试安排和教务要求'
          : post.category === 'life'
            ? '学校相关服务通知'
            : '学校最新通知'

  if (replyCount > 0) {
    return `根据学生社区讨论，${cleanedTitle}通常需要结合${categoryHint}办理。当前整理基于主帖和${replyCount}条已审核回复，仅供参考，请以学校官方通知为准。`
  }

  return `根据学生社区主帖内容整理，${cleanedTitle}目前主要反映的是学生提问场景和初步经验，后续仍建议结合${categoryHint}进一步核实。`
}

const buildCommunityKnowledgeContent = ({ post, replies }) => {
  const sections = [
    `主题：${post.title}`,
    `主帖内容：${post.content}`,
  ]

  if (replies.length > 0) {
    sections.push(
      [
        '已审核回复整理：',
        ...replies.map((reply, index) => `${index + 1}. ${reply.authorName}：${reply.content}`),
      ].join('\n'),
    )
  }

  sections.push('提示：以上内容来自学生社区经验整理，仅供参考，请以学校官方通知为准。')

  return sections.join('\n\n')
}

const buildCommunityKnowledgeKeywords = ({ post, replies }) => {
  const seed = new Set([...(post.tags || [])])

  for (const token of String(post.title || '').split(/[、，,。；：:\s]+/)) {
    const normalized = token.trim()
    if (normalized.length >= 2 && normalized.length <= 12) {
      seed.add(normalized)
    }
  }

  for (const reply of replies) {
    for (const token of String(reply.content || '').split(/[、，,。；：:\s]+/)) {
      const normalized = token.trim()
      if (normalized.length >= 2 && normalized.length <= 12 && seed.size < 12) {
        seed.add(normalized)
      }
    }
  }

  return Array.from(seed).slice(0, 12)
}

const generateKnowledgeInMySql = async (postId) => {
  const posts = await query(
    `
      SELECT
        id,
        author_name,
        author_role,
        title,
        content,
        category,
        tags,
        status,
        reply_count,
        like_count,
        view_count,
        created_at,
        updated_at
      FROM community_posts
      WHERE id = ?
      LIMIT 1
    `,
    [postId],
  )

  if (!posts.length) {
    const err = new Error('POST_NOT_FOUND')
    err.code = 'POST_NOT_FOUND'
    throw err
  }

  const post = mapMySqlPost(posts[0])
  const replies = (
    await query(
      `
        SELECT
          id,
          post_id,
          author_name,
          author_role,
          content,
          status,
          like_count,
          created_at,
          updated_at
        FROM community_replies
        WHERE post_id = ? AND status = 'approved'
        ORDER BY created_at ASC
      `,
      [postId],
    )
  ).map(mapMySqlReply)

  const knowledgeId = `ck_${randomUUID().slice(0, 8)}`
  const title = `学生社区经验总结：${post.title}`
  const summary = buildCommunityKnowledgeSummary({ post, replies })
  const content = buildCommunityKnowledgeContent({ post, replies })
  const keywords = buildCommunityKnowledgeKeywords({ post, replies })

  const existingRows = await query(
    `
      SELECT id
      FROM community_knowledge
      WHERE post_id = ?
      LIMIT 1
    `,
    [postId],
  )

  if (existingRows.length) {
    const existingId = existingRows[0].id
    await query(
      `
        UPDATE community_knowledge
        SET
          title = ?,
          summary = ?,
          content = ?,
          category = ?,
          keywords = ?,
          confidence = 0.45,
          status = 'pending',
          source_type = 'community_summary',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [title, summary, content, post.category, JSON.stringify(keywords), existingId],
    )

    await query(
      `
        UPDATE community_posts
        SET knowledge_status = 'pending', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [postId],
    )

    await writeReviewLog({
      targetType: 'knowledge',
      targetId: existingId,
      action: 'generate_knowledge',
      reviewer: 'admin',
      note: '更新社区知识条目',
    })

    return {
      knowledgeId: existingId,
      status: 'pending',
      summary,
    }
  }

  await query(
    `
      INSERT INTO community_knowledge (
        id,
        post_id,
        title,
        summary,
        content,
        category,
        keywords,
        confidence,
        status,
        source_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.45, 'pending', 'community_summary')
    `,
    [knowledgeId, postId, title, summary, content, post.category, JSON.stringify(keywords)],
  )

  await query(
    `
      UPDATE community_posts
      SET knowledge_status = 'pending', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [postId],
  )

  await writeReviewLog({
    targetType: 'knowledge',
    targetId: knowledgeId,
    action: 'generate_knowledge',
    reviewer: 'admin',
    note: '生成社区知识条目',
  })

  return {
    knowledgeId,
    status: 'pending',
    summary,
  }
}

const generateKnowledge = async (req, res) => {
  const body = await parseJsonBody(req)
  const postId = String(body.postId || '').trim()
  if (!postId) return badRequest(res, 'postId 不能为空')

  if (await shouldUseMySql()) {
    try {
      const result = await generateKnowledgeInMySql(postId)
      return ok(res, result, '生成成功')
    } catch (error) {
      if (error?.code === 'POST_NOT_FOUND') {
        return notFound(res, '帖子不存在')
      }
      throw error
    }
  }

  const post = mockPosts.find((item) => item.id === postId)
  if (!post) return notFound(res, '帖子不存在')

  const replies = getApprovedRepliesByPostId(postId)
  const summary = `根据学生社区讨论，${post.title.replace(/[？?]$/, '')}通常需要结合学院安排和最新教务通知办理，具体仍建议以学校官方通知为准。`

  const existing = mockKnowledge.find((item) => item.postId === postId)
  if (existing) {
    existing.summary = summary
    existing.content = [post.content, ...replies.map((item) => item.content)].join('\n')
    existing.updatedAt = new Date().toISOString()
    return ok(
      res,
      {
        knowledgeId: existing.id,
        status: existing.status,
        summary: existing.summary,
      },
      '更新社区知识成功',
    )
  }

  const now = new Date().toISOString()
  const knowledge = {
    id: `ck_${randomUUID().slice(0, 8)}`,
    postId,
    title: `学生社区经验总结：${post.title}`,
    summary,
    content: [post.content, ...replies.map((item) => item.content)].join('\n'),
    category: post.category,
    keywords: [...post.tags],
    confidence: 0.45,
    status: 'pending',
    sourceType: 'community_summary',
    createdAt: now,
    updatedAt: now,
  }

  mockKnowledge.push(knowledge)
  return ok(
    res,
    {
      knowledgeId: knowledge.id,
      status: knowledge.status,
      summary: knowledge.summary,
    },
    '生成成功',
  )
}

// 统一处理社区模块的路由。
// 这里保持和 index.mjs 中 isPath 的兼容思路一致，同时支持 /community 与 /api/community。
export const handleCommunityRoute = async (req, res, requestUrl, tools) => {
  json = tools.json
  parseJsonBody = tools.parseJsonBody

  const path = requestUrl.pathname.replace(/^\/api/, '')

  if (req.method === 'GET' && path === '/community/meta') {
    return ok(res, { categories: COMMUNITY_CATEGORIES, hotTags: HOT_TAGS })
  }

  if (req.method === 'GET' && path === '/community/posts') {
    if (await shouldUseMySql()) {
      return ok(res, await listPostsFromMySql(requestUrl))
    }
    return ok(res, listPosts(requestUrl))
  }

  const postDetailMatch = path.match(/^\/community\/posts\/([^/]+)$/)
  if (req.method === 'GET' && postDetailMatch) {
    const detail = (await shouldUseMySql())
      ? await getPostDetailFromMySql(postDetailMatch[1])
      : getPostDetail(postDetailMatch[1])
    if (!detail) return notFound(res, '帖子不存在或未通过审核')
    return ok(res, detail)
  }

  const reviewPostDetailMatch = path.match(/^\/community\/review\/posts\/([^/]+)\/detail$/)
  if (req.method === 'GET' && reviewPostDetailMatch) {
    const detail = (await shouldUseMySql())
      ? await getReviewPostDetailFromMySql(reviewPostDetailMatch[1])
      : getReviewPostDetail(reviewPostDetailMatch[1])
    if (!detail) return notFound(res, '帖子不存在')
    return ok(res, detail)
  }

  if (req.method === 'POST' && path === '/community/posts') {
    return createPost(req, res)
  }

  const replyMatch = path.match(/^\/community\/posts\/([^/]+)\/replies$/)
  if (req.method === 'POST' && replyMatch) {
    return createReply(req, res, replyMatch[1])
  }

  if (req.method === 'GET' && path === '/community/review/posts') {
    if (await shouldUseMySql()) {
      return ok(res, await listPendingPostsFromMySql())
    }
    return ok(res, listPendingPosts())
  }

  if (req.method === 'GET' && path === '/community/review/replies') {
    if (await shouldUseMySql()) {
      return ok(res, await listPendingRepliesFromMySql())
    }
    return ok(res, listPendingReplies())
  }

  if (req.method === 'GET' && path === '/community/knowledge/candidates') {
    if (await shouldUseMySql()) {
      return ok(res, await listKnowledgeCandidatesFromMySql())
    }
    return ok(res, listKnowledgeCandidatesFromMock())
  }

  if (req.method === 'GET' && path === '/community/knowledge') {
    if (await shouldUseMySql()) {
      return ok(res, await listKnowledgeItemsFromMySql(requestUrl))
    }
    return ok(res, listKnowledgeItemsFromMock(requestUrl))
  }

  const approvePostMatch = path.match(/^\/community\/review\/posts\/([^/]+)\/approve$/)
  if (req.method === 'POST' && approvePostMatch) {
    if (await shouldUseMySql()) {
      try {
        const result = await updatePostStatusInMySql(
          approvePostMatch[1],
          'approved',
          'approve',
          '帖子审核通过',
        )
        return ok(res, result, '帖子审核通过')
      } catch (error) {
        if (error?.code === 'POST_NOT_FOUND') {
          return notFound(res, '帖子不存在')
        }
        throw error
      }
    }
    return updatePostStatus(res, approvePostMatch[1], 'approved', '帖子审核通过')
  }

  const rejectPostMatch = path.match(/^\/community\/review\/posts\/([^/]+)\/reject$/)
  if (req.method === 'POST' && rejectPostMatch) {
    if (await shouldUseMySql()) {
      try {
        const result = await updatePostStatusInMySql(
          rejectPostMatch[1],
          'rejected',
          'reject',
          '帖子已拒绝',
        )
        return ok(res, result, '帖子已拒绝')
      } catch (error) {
        if (error?.code === 'POST_NOT_FOUND') {
          return notFound(res, '帖子不存在')
        }
        throw error
      }
    }
    return updatePostStatus(res, rejectPostMatch[1], 'rejected', '帖子已拒绝')
  }

  const approveReplyMatch = path.match(/^\/community\/review\/replies\/([^/]+)\/approve$/)
  if (req.method === 'POST' && approveReplyMatch) {
    if (await shouldUseMySql()) {
      try {
        const result = await updateReplyStatusInMySql(
          approveReplyMatch[1],
          'approved',
          'approve',
          '回复审核通过',
        )
        return ok(res, result, '回复审核通过')
      } catch (error) {
        if (error?.code === 'REPLY_NOT_FOUND') {
          return notFound(res, '回复不存在')
        }
        throw error
      }
    }
    return updateReplyStatus(res, approveReplyMatch[1], 'approved', '回复审核通过')
  }

  const rejectReplyMatch = path.match(/^\/community\/review\/replies\/([^/]+)\/reject$/)
  if (req.method === 'POST' && rejectReplyMatch) {
    if (await shouldUseMySql()) {
      try {
        const result = await updateReplyStatusInMySql(
          rejectReplyMatch[1],
          'rejected',
          'reject',
          '回复已拒绝',
        )
        return ok(res, result, '回复已拒绝')
      } catch (error) {
        if (error?.code === 'REPLY_NOT_FOUND') {
          return notFound(res, '回复不存在')
        }
        throw error
      }
    }
    return updateReplyStatus(res, rejectReplyMatch[1], 'rejected', '回复已拒绝')
  }

  if (req.method === 'POST' && path === '/community/knowledge/generate') {
    return generateKnowledge(req, res)
  }

  const approveKnowledgeMatch = path.match(/^\/community\/knowledge\/([^/]+)\/approve$/)
  if (req.method === 'POST' && approveKnowledgeMatch) {
    if (await shouldUseMySql()) {
      try {
        const result = await updateKnowledgeStatusInMySql(
          approveKnowledgeMatch[1],
          'approved',
          'approve',
          '社区知识审核通过',
        )
        return ok(res, result, '社区知识审核通过')
      } catch (error) {
        if (error?.code === 'KNOWLEDGE_NOT_FOUND') {
          return notFound(res, '社区知识不存在')
        }
        throw error
      }
    }
    const result = updateKnowledgeStatusFromMock(approveKnowledgeMatch[1], 'approved')
    if (!result) return notFound(res, '社区知识不存在')
    return ok(res, result, '社区知识审核通过')
  }

  const rejectKnowledgeMatch = path.match(/^\/community\/knowledge\/([^/]+)\/reject$/)
  if (req.method === 'POST' && rejectKnowledgeMatch) {
    if (await shouldUseMySql()) {
      try {
        const result = await updateKnowledgeStatusInMySql(
          rejectKnowledgeMatch[1],
          'rejected',
          'reject',
          '社区知识已拒绝',
        )
        return ok(res, result, '社区知识已拒绝')
      } catch (error) {
        if (error?.code === 'KNOWLEDGE_NOT_FOUND') {
          return notFound(res, '社区知识不存在')
        }
        throw error
      }
    }
    const result = updateKnowledgeStatusFromMock(rejectKnowledgeMatch[1], 'rejected')
    if (!result) return notFound(res, '社区知识不存在')
    return ok(res, result, '社区知识已拒绝')
  }

  return false
}
