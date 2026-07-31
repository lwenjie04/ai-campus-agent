import { resolveRequestAuth } from './auth.mjs'

// 需要登录的接口：校验失败返回 401。
// 调用方传入 helpers = { json }；返回 auth 对象或 null（null 表示已写响应，调用方应 return）。
export const requireAuth = (req, res, helpers) => {
  const auth = resolveRequestAuth(req)
  if (!auth) {
    helpers.json(res, 401, {
      error: { code: 'AUTH_REQUIRED', message: '请先登录' },
    })
    return null
  }
  return auth
}

// 需要管理员：登录校验后还需 role === 'admin'，否则 403。
export const requireAdmin = (req, res, helpers) => {
  const auth = requireAuth(req, res, helpers)
  if (!auth) return null
  if (auth.role !== 'admin') {
    helpers.json(res, 403, {
      error: { code: 'AUTH_FORBIDDEN', message: '无权限执行该操作' },
    })
    return null
  }
  return auth
}
