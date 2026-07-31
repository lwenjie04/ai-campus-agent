# Design: P0 安全加固（JWT 鉴权、管理员接口防护、登录/验证码限流）

## 1. JWT 会话

- 依赖：`server/package.json` 新增 `jsonwebtoken`。
- 环境变量：`JWT_SECRET`（生产必填；缺失时用内置 dev secret 并在启动打 warning）、`JWT_EXPIRES_IN`（默认 `7d`）。
- Payload：`{ sub: userId, username, role }`。
- 签发点：`auth.mjs` 的 login/register 成功时 `sign({ sub, username, role })`。
- 校验：中间件从 `Authorization: Bearer <token>` 解析 → `verify` → 返回 `{ userId, username, role }`；失败抛 401。

## 2. 后端中间件

新建 `server/auth-middleware.mjs`（或并入 auth.mjs）导出：

```js
// 从 req 头解析并校验 JWT，成功返回 { userId, username, role }
export const resolveAuth = (req) => { /* 401 if invalid */ }
export const requireAuth = (req) => { /* 同 resolveAuth，缺省即 401 */ }
export const requireAdmin = (req) => { /* resolveAuth + role==='admin'，否则 403 */ }
```

`index.mjs` / `community.mjs` 在每个需要保护的 handler 入口调用，失败用现有 `json(res, 401/403, { error: { code, message } })` 返回（code：`AUTH_REQUIRED` / `AUTH_INVALID` / `AUTH_EXPIRED` / `AUTH_FORBIDDEN`）。

## 3. 接口保护清单

| 接口 | 保护 |
|---|---|
| `POST /chat`、`POST /chat/stream` | requireAuth（前端本就登录后使用；无 key 时仍 502，但不再是无鉴权访问） |
| `POST /community/posts`（发帖） | requireAuth |
| `POST /community/posts/:id/replies`（回复） | requireAuth |
| `GET /community/review/posts`、`/replies` | requireAdmin |
| `POST /community/review/posts/:id/approve`、`/replies/:id/approve` | requireAdmin |
| `POST /community/knowledge/generate` | requireAdmin |
| `/auth/login`、`/auth/register`、`/auth/send-register-code`、`/auth/change-password` | 公开（change-password 本身 requireAuth，仅登录返回 token 前可用） |
| `/health`、`/kb/download`、`/tts` | 公开（TTS 保留现有 token 机制，本轮不改） |

发帖/回复的 `authorName`：登录后以后端 token 对应用户为准（覆盖/忽略前端传的 authorName），杜绝伪造身份。社区表无 user_id 列——本轮不改表结构，仅校验登录并把 authorName 强制为登录用户名（`displayName`），`authorRole` 强制为 `user`。

## 4. 限流（`server/rate-limit.mjs`，纯内存，单进程）

通用固定窗口计数器：`createRateLimiter({ windowMs, max })` 返回 `(key) => { allowed: boolean, remaining, retryAfterMs }`，定期清理过期键。

| 场景 | 策略 |
|---|---|
| 登录失败 | key = `login:{account}`（含 IP 前缀可后续加）；15 分钟窗口内失败 ≥5 次 → 429，返回 `retryAfterSeconds` |
| 验证码尝试 | 在 `auth_verification_codes` 表加 `attempts INT DEFAULT 0` 列；每次校验失败 +1，≥5 → 状态置 `expired` 并返回「尝试次数过多，请重新获取」 |

登录成功时清空该 key 的失败计数。登录失败计数在密码错误后写入；锁定期间即使密码正确也返回 429。

## 5. 强制改密

- `auth_users` 增加 `must_change_password TINYINT(1) NOT NULL DEFAULT 0`。
- `ensureDefaultAdmin` 创建默认 admin 时置 1。
- 迁移幂等：`ensureAuthSchema` 里先 `information_schema.COLUMNS` 查列，缺失则 `ALTER TABLE auth_users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0`（MySQL 不支持 ADD COLUMN IF NOT EXISTS，需查列）。
- `normalizeUser` 增加 `mustChangePassword` 字段；login/register 响应 `data` 变为 `{ token, user: {...} }`。
- 新接口 `POST /auth/change-password`（requireAuth）：
  - body：`{ oldPassword, newPassword }`
  - 校验旧密码 → 更新 `password_hash` → `UPDATE ... SET must_change_password = 0`
  - 新密码规则与注册一致（≥6 位）

## 6. 前端

**token 持有（避免循环依赖）**：新建 `web/src/auth/token.ts`
```ts
let token = ''
export const setAuthToken = (t: string) => { token = t }
export const getAuthToken = () => token
```
auth store 写入 token；http 层读取 token，互不 import store。

**统一请求层**：新建 `web/src/api/http.ts` 导出共享 `http`（axios 实例）：
- 请求拦截器：有 token 时加 `Authorization: Bearer <token>`
- 响应拦截器：401 时清空 auth store 登录态并跳转登录（通过 `window.location` 或回调，避免 store 循环依赖——用 `window.dispatchEvent(new CustomEvent('auth:unauthorized'))`，App.vue 监听处理）

**改动文件**：
- `api/auth.ts`：loginByPassword 返回 `{ token, user, mustChangePassword }`；改用 `http`；新增 `changePassword(oldPassword, newPassword)`；登录/注册成功时 `setAuthToken(token)`
- `api/community.ts`、`api/llm.ts`（fetch 方式需手动带 `Authorization` 头，读取 `getAuthToken()`）
- `store/auth.ts`：state 增加 `token`、`mustChangePassword`；`applyUser(user, token)` 保存并 `setAuthToken`；`hydrate` 恢复 token；`logout` 清 token；localStorage key 升版为 `v5`
- `views/LoginView.vue`：登录后若 `mustChangePassword` 展示改密表单（含旧/新密码，调用 changePassword 后完成登录态）
- `App.vue`：监听 `auth:unauthorized` → 登出回登录页
- `views/AdminReviewView.vue`：保持现有 UI 角色门控（服务端现在强校验）

## 7. 分支与提交

- 实施分支：`feat/security-auth`（基于 `feat/workspaces-split`，master 未合并新结构）。
- 完成后提交 → push → 可选 PR（base `feat/workspaces-split`）。

## 8. 兼容与回滚

- 旧前端（无 token）调用受保护接口会 401 —— 前后端需同步部署；本次前端一并改造。
- 回滚：单分支 `git revert` 提交即可。
- 内存限流在 pm2 cluster 多实例下各自独立——当前部署为单实例，可接受；文档注明。
- 迁移仅在启动时执行一次 ALTER，失败不阻塞启动（log 告警）。
