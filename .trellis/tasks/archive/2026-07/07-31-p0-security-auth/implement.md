# Implement: P0 安全加固（JWT 鉴权、管理员接口防护、登录/验证码限流）

执行分支：`feat/security-auth`（基于 `feat/workspaces-split`）。

> **执行状态（2026-07-31）**：代码全部完成。前端 type-check/build/lint 全绿；后端语法检查全过；本地（无 MySQL）验证 7/7 通过：401/403 鉴权、伪造无效 token 拒绝、DB 不可用时进程不再崩溃、发帖保护、限流器单测。
> **待服务器环境验证**：登录签发 token、强制改密（mustChangePassword）、登录 429——依赖 MySQL，本机无库，需在服务器部署后验证。
> 实现中顺带修复：接口异常（如 DB 不可用）导致整个进程崩溃的健壮性 bug（index.mjs 加兜底 catch）。

## 0. 准备

- [ ] `git checkout feat/workspaces-split` → `git checkout -b feat/security-auth`
- [ ] `server/package.json` 加 `jsonwebtoken`，`npm install`
- [ ] `server/.env.example` 加 `JWT_SECRET=`、`JWT_EXPIRES_IN=7d`

## 1. 后端：JWT + 中间件

- [ ] `server/auth.mjs`：引入 jsonwebtoken；`signToken(user)` / `verifyToken(token)`；login/register 返回 `{ token, user }`
- [ ] 新建 `server/auth-middleware.mjs`：`resolveAuth` / `requireAuth` / `requireAdmin`（401/403 错误对象）
- [ ] `server/index.mjs`：/chat、/chat/stream 加 requireAuth；注册 `/auth/change-password` 路由；启动时若 `JWT_SECRET` 缺失打 warning

## 2. 后端：社区接口鉴权

- [ ] `server/community.mjs`：发帖/回复 requireAuth，且 authorName 用登录用户名、authorRole 固定 user；审核/知识生成接口 requireAdmin
- [ ] 校验：普通用户调审核接口 403、无 token 调发帖 401

## 3. 后端：限流

- [ ] 新建 `server/rate-limit.mjs`（固定窗口计数器 + 过期清理）
- [ ] `server/auth.mjs`：登录失败计数（key=`login:{account}`），≥5 次/15 分钟 → 429；成功清空
- [ ] `auth_verification_codes` 加 `attempts` 列（幂等迁移）；register 校验失败 attempts+1，≥5 置 expired

## 4. 后端：强制改密 + 迁移

- [ ] `auth_users` 加 `must_change_password` 列（幂等：查 information_schema 后 ALTER）
- [ ] `ensureDefaultAdmin` 默认 admin 置 `must_change_password=1`
- [ ] `normalizeUser` 返回 `mustChangePassword`；新增 `POST /auth/change-password`
- [ ] 更新 `server/sql/auth-users.sql` 建表语句（含新列）

## 5. 前端：token + 请求层

- [ ] 新建 `web/src/auth/token.ts`、`web/src/api/http.ts`（axios 实例 + 拦截器 + 401 事件）
- [ ] `api/auth.ts`：改 `http`、返回 `{ token, user, mustChangePassword }`、新增 changePassword、登录成功后 setAuthToken
- [ ] `api/community.ts`、`api/llm.ts`：带 `Authorization` 头
- [ ] `store/auth.ts`：state 加 token/mustChangePassword，persist 升 v5，hydrate 恢复 token，logout 清 token
- [ ] `LoginView.vue`：mustChangePassword 改密表单
- [ ] `App.vue`：监听 `auth:unauthorized` → 登出回登录页

## 6. 验证

- [ ] 后端启动：`npm run server -w server`，`/health` ok
- [ ] curl 用例（用 `$CLAUDE_JOB_DIR/tmp` 脚本）：
  - 登录 admin → 拿 token + `mustChangePassword`
  - 无 token 调 `/chat/stream` → 401
  - 普通用户 token 调 approve → 403；admin token → 200
  - 登录失败 5 次 → 429
  - 验证码错误 5 次 → 作废
  - change-password 后再次登录 → `mustChangePassword: false`
- [ ] 前端：`npm run type-check -w web`、`npm run build -w web`、`npm run lint -w web` 全过
- [ ] 顺带校验既有功能未回归：社区列表、登录页 UI 正常（type-check/build 兜底）

## 7. 收尾

- [ ] 更新 `.trellis/spec/backend/api-module.md` 或相关 spec（鉴权约定）
- [ ] 提交（refactor/feat 消息）→ push `feat/security-auth`
- [ ] 提示用户是否开 PR（base feat/workspaces-split）

## 回滚点

- 每步可 `git checkout -- <file>`；整体 `git revert` 提交。
- 数据库迁移幂等，可重跑；加列失败不阻塞启动（告警即可）。
