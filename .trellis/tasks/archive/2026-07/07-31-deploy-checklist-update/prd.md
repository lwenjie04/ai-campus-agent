# PRD: 更新服务器部署清单

## 背景

项目经过前后端分离重构（web/server workspaces）、P0 安全加固（JWT/限流/强制改密）、pm2 配置固化后，`docs/deploy-server-checklist.md` 里的结构、环境变量、启动命令已过时：
- 前端构建产物从根 `dist/` 变为 `web/dist/`
- 缺 `JWT_SECRET`、`JWT_EXPIRES_IN`、`AUTH_LOGIN_*`、`AUTH_CODE_MAX_ATTEMPTS`
- pm2 已有 `ecosystem.config.cjs`，不再需要手写 `pm2 start server/index.mjs`
- 默认 admin 首次登录须改密，验收清单需更新

## 目标

更新 `docs/deploy-server-checklist.md`，使其与当前代码/分支状态一致。

## 验收标准

1. 环境变量示例含 `JWT_SECRET`（注明必配随机密钥）、`JWT_EXPIRES_IN`、`AUTH_LOGIN_MAX_FAILURES`、`AUTH_LOGIN_WINDOW_MINUTES`、`AUTH_CODE_MAX_ATTEMPTS`。
2. 前端构建产物目录更新为 `web/dist/`；`npm run build` 命令不变。
3. pm2 章节改为使用 `ecosystem.config.cjs` + `npm run pm2:start`。
4. 登录验收说明"默认管理员首次登录需强制改密"。
5. Nginx 示例：前端 root 改 `web/dist`；`/chat/stream` 流式接口加 `proxy_buffering off` 提示。
6. 数据库说明补充"启动时自动迁移 `must_change_password`/`attempts` 列（幂等）"。
7. 提交推送至 `chore/deploy-checklist` 分支。
