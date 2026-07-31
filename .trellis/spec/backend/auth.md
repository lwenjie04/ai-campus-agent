# Auth 鉴权约定（本项目专属）

本项目后端基于原生 Node HTTP，认证采用 **JWT（jsonwebtoken）+ 中间件函数**模式。

## 会话

- 登录/注册签发 JWT：`server/auth.mjs` 的 `signToken(user)`。
- Payload：`{ sub: userId, username, displayName, role }`，过期时间 `JWT_EXPIRES_IN`（默认 7d）。
- 密钥 `JWT_SECRET`：生产必配；缺失时用开发默认值并打 warning。
- `verifyToken(token)` 返回 `{ userId, username, displayName, role }`，失败返回 null。

## 中间件（server/auth-middleware.mjs）

| 函数 | 作用 | 失败返回 |
|---|---|---|
| `requireAuth(req, res, helpers)` | 校验 `Authorization: Bearer <token>` | 401 `AUTH_REQUIRED` |
| `requireAdmin(req, res, helpers)` | requireAuth + `role==='admin'` | 403 `AUTH_FORBIDDEN` |

调用约定：在受保护 handler 入口 `const auth = requireAuth(req, res, tools); if (!auth) return`。
`tools` 需含 `json`（错误响应用）。返回的 `auth` 对象携带登录用户信息。

## 接口保护清单

- 需登录：`/chat`、`/chat/stream`、`POST /community/posts`、`POST /community/posts/:id/replies`。
- 仅 admin：`/community/review/*`、`/community/knowledge/*`（含 generate/approve/reject）。
- 公开：`/health`、`/kb/download`、`/tts`、`/auth/login`、`/auth/register`、`/auth/send-register-code`。

## 身份防伪

发帖/回复的作者一律以登录用户为准（`auth.displayName || auth.username`），**忽略前端传的 authorName/authorRole**；对应校验已移除。

## 强制改密

- `auth_users.must_change_password` 标记；默认 admin 若仍是默认密码会被标记。
- `POST /auth/change-password`（需登录）：校验原密码 → 更新 → 清零标记。
- 登录响应 `user.mustChangePassword` 供前端引导改密。

## 限流（server/rate-limit.mjs，纯内存）

- 登录：同一 `account:ip` 15 分钟窗口 ≥5 次失败 → 429（`AUTH_RATE_LIMITED`）。
- 验证码发送：同一 `email:ip` 每小时 ≥10 次 → 429。
- 验证码校验：`auth_verification_codes.attempts` ≥5 → 置 expired。
- 单进程内有效；pm2 cluster 多实例时各自独立计数（已知限制）。

## 前端配合

- `web/src/auth/token.ts` 持有 token；`web/src/api/http.ts` 统一 axios 实例自动带 `Authorization` 头。
- 401 → 派发 `auth:unauthorized` 事件 → `App.vue` 统一登出回登录页。
- 登录态存 localStorage key `ai-campus-agent.auth.v5`（含 token + mustChangePassword）。
