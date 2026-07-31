# PRD: CI workflow（push/PR 自动 type-check + lint + build）

## 背景

仓库目前 `.github/` 下只有 `dependabot.yml`，没有 CI。前端代码结构（web/server workspaces 双包）已稳定，需要一个自动化门禁防止回归：依赖漂移、lint 违规、类型错误、构建失败应在合并前被拦住。

## 目标

新增 `.github/workflows/ci.yml`：
1. **web 包**：`type-check` + `lint` + `build`（对应根 `npm run type-check/lint/build -w web`）。
2. **server 包**：全量 `.mjs` 语法检查 + 启动后端冒烟测试（`/health` 返回 ok，不依赖 MySQL）。
3. 触发：push 到 `master` / `dev-frontend` / `dev-backend` / `feat/**` 分支，以及所有 PR。

## 验收标准

1. `.github/workflows/ci.yml` 存在且 YAML 合法。
2. web job：`npm ci` → `type-check` → `lint` → `build` 全部通过（本地命令已验证为绿）。
3. server job：`node --check` 遍历 `server/*.mjs` 与 `server/scripts/*.mjs` 全过；启动 `npm run server -w server` 后轮询 `/health` 返回 `{"ok":true,...}`。
4. 不依赖任何外部服务（无 MySQL、无 LLM key）；任务失败时 job 退出码非 0。
5. 提交推送到 `chore/ci-workflow` 分支。
