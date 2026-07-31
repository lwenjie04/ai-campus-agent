# PRD: P0 安全加固（JWT 鉴权、管理员接口防护、登录/验证码限流）

## 背景

当前后端**几乎无真实鉴权**：登录只返回用户信息、不签发任何会话凭证；社区发帖/回复无需登录；管理员审核接口（approve、knowledge/generate 等）任何人可直接调用；登录无速率限制可被爆破；注册验证码 6 位数字无尝试次数上限；默认管理员 `admin123` 无强制改密。前端只是把用户信息存 localStorage 展示，接口本身裸奔。

本轮修复这些 P0 级安全缺口。基于已完成的 `web/` + `server/` workspaces 结构。

## 目标

1. **JWT 会话**：登录/注册签发 JWT；受保护接口校验 `Authorization: Bearer <token>`。
2. **接口鉴权分层**：
   - 问答 `/chat`、`/chat/stream` → 需登录（requireAuth）
   - 社区发帖/回复 → 需登录
   - 社区审核、知识生成等管理接口 → 仅 admin（requireAdmin）
3. **限流**：
   - 登录：同一账号/来源失败次数超限后临时锁定（返回 429）
   - 注册验证码：同一验证码尝试次数超限即作废；发送频率已有 60s 冷却，保留
4. **默认管理员强制改密**：首次登录 `admin123` 时必须修改密码（`must_change_password` 标记）。
5. **前端配合**：存储 token、请求统一带 `Authorization` 头、401 自动登出、强制改密流程 UI。

## 非目标

- 不引入 OAuth/第三方登录、不实现刷新令牌与登出吊销（JWT 有效期短即可，可后续扩展）。
- 不做密码找回、不做 TTS 接口鉴权改造（保留现有 token 机制，后续任务处理）。
- 不重构现有路由注册方式（仍在原生 HTTP + 中间件函数内校验）。
- 不迁移 web 框架。

## 验收标准

1. **登录/注册返回 JWT**：`POST /auth/login`、`POST /auth/register` 响应含 `data.token`（与 `user` 并列）。
2. **受保护接口**：
   - 无 token 调 `/chat/stream`、`POST /community/posts`、`POST /community/posts/:id/replies` → 401
   - 普通用户 token 调审核接口（`/community/review/*`、`/community/knowledge/generate`）→ 403
   - admin token 调审核接口 → 200
   - 带有效 token 调 `/chat` → 正常走通（无 key 时返回 502 LLM 错误而非 401）
3. **限流**：
   - 同一账号连续错误密码 ≥5 次 → 429「尝试次数过多，请稍后再试」，恢复时间后可用
   - 同一验证码验证失败 ≥5 次 → 验证码作废，需重新获取
4. **强制改密**：
   - 默认管理员首次登录返回 `mustChangePassword: true`
   - `POST /auth/change-password`（需登录）校验旧密码后可改，改后清除标记
   - 再次登录不再提示
5. **前端**：
   - token 持久化到 localStorage，请求自动带 `Authorization` 头
   - 收到 401 自动清空登录态并回登录页
   - 登录返回 `mustChangePassword` 时弹出改密引导
   - `npm run type-check`、`npm run build`、`npm run lint -w web` 通过
6. **后端**：`npm run server -w server` 启动正常，`/health` 正常；`server/sql/auth-users.sql` 与运行时代码一致（含 `must_change_password` 字段）。
7. 新依赖 `jsonwebtoken` 写入 `server/package.json`；`JWT_SECRET` 加入 `server/.env.example`。
