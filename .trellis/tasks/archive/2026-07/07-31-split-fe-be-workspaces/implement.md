# Implement: 前后端分离重构（同仓双包 + npm workspaces）

执行分支：`feat/workspaces-split`（基于 master）。

> **执行状态（2026-07-31）**：全部代码步骤已完成并验证（type-check / build / lint / server /health / KB 下载 / kb:repair dry-run 全绿）。3 个提交已 push 到 `origin/feat/workspaces-split`。
> **用户决定**：master **暂不合并**，`dev-frontend` / `dev-backend` 保持旧基线。待后续需要时再合。
> 实现中发现并记录的偏差：`mobile-uniapp` 因 uni-app 依赖与 vue3 peer 冲突未纳入根 workspaces；顺带修复了迁移前既存的 16 个 lint 错误（BOM/未用导入/空文件/any 等）。

## 0. 准备

- [ ] 确认当前在 master、工作区干净（工具链已提交）
- [ ] 创建分支：`git checkout -b feat/workspaces-split`
- [ ] 备份知识库：`cp server/data/knowledge-base.json $CLAUDE_JOB_DIR/tmp/kb-backup.json`

## 1. 移动数据文件（先移出 project-text 和 _ingest）

- [ ] `git mv src/project-text server/data/project-text`（先建 `server/data` 已存在）
- [ ] `git mv _ingest server/_ingest`
- [ ] 校验：`ls server/data/project-text/exports | head`、`ls server/_ingest`

## 2. 前端整体迁入 web/

- [ ] `git mv src web/src`（此时 src 只剩前端代码）
- [ ] `git mv public web/public`
- [ ] `git mv index.html vite.config.ts env.d.ts web/`
- [ ] `git mv tsconfig.json tsconfig.app.json tsconfig.node.json web/`
- [ ] `git mv eslint.config.ts .oxlintrc.json .prettierrc.json web/`
- [ ] `git mv .env.example web/.env.example`
- [ ] 校验：`git status` 确认移动完整、无遗漏在根目录的前端文件

## 3. 拆分 package.json

- [ ] 用根 package.json 现有前端依赖 + devDependencies 写 `web/package.json`（scripts: dev/build/build-only/preview/type-check/lint/format）
- [ ] 写 `server/package.json`（dependencies: mysql2/nodemailer/tencentcloud-sdk-nodejs-tts；scripts: server/mail:test/ingest:local/ingest:browser-json/kb:repair/kb:repair:dry）
- [ ] 根 `package.json` 改为 workspaces 根（见 design §2），保留 `npm-run-all2` devDep
- [ ] `npm install`（根，重新生成 lock，一次装齐三包）
- [ ] 校验：`npm ls --workspaces` 无 missing

## 4. 后端路径重构

- [ ] `index.mjs`：env 加载改 `resolve(import.meta.dirname, '.env')`（保留 `.env.server` 兼容），`REPO_ROOT` 常量，`/kb/download` 用 `resolve(REPO_ROOT, item.downloadPath)`
- [ ] `mysql.mjs`：env 加载同上
- [ ] `rag.mjs`：KB_PATH、LOG_DIR 改 `import.meta.dirname`
- [ ] `tts.mjs`：ps1 脚本路径改 `import.meta.dirname`
- [ ] `scripts/batch-ingest-local.mjs`：默认输入 `data/project-text`、输出 `data/knowledge-base.json`
- [ ] `scripts/import-browser-export-json.mjs`：默认 input `data/project-text`
- [ ] `scripts/kb-clean-tag-qc.mjs`、`scripts/test-auth-mail.mjs`：路径基于 server 目录
- [ ] 校验：`grep -rn "process.cwd()" server/` 仅剩 `resolve(import.meta.dirname,...)` 相关或无 cwd 依赖

## 5. 改写 KB downloadPath

- [ ] 一次性脚本原地替换 `server/data/knowledge-base.json`：`src/project-text/` → `server/data/project-text/`、`_ingest/` → `server/_ingest/`
- [ ] 校验：`grep -oE '"downloadPath": "[^"]*"' server/data/knowledge-base.json | grep -vE 'server/(data/project-text|_ingest)'` 无结果

## 6. 验证（每个关键门禁）

- [ ] 前端：`npm run type-check -w web` 通过
- [ ] 前端：`npm run build -w web` 通过
- [ ] 前端：`npm run lint -w web` 通过
- [ ] 后端：`npm run server -w server` 启动无报错，`curl http://localhost:3000/health` 返回 `ok:true`（起后台进程验证后杀掉）
- [ ] 知识库下载：对一条含 downloadPath 的条目 `curl "http://localhost:3000/kb/download?id=<id>"` 返回 200 非空
- [ ] 导入脚本 dry-run：`npm run kb:repair:dry -w server` 正常输出
- [ ] 根脚本：`npm run dev`（前端）能起、`npm run server` 能起（dev:all 可选验证）

## 7. 收尾

- [ ] 更新 `docs/git-branch-convention.md`：`web/` 归 dev-frontend（含 web/package.json）、`server/` 归 dev-backend（含 server/package.json），根 package.json 仅为 workspaces 壳
- [ ] 更新 `.trellis/spec/backend/*` 与 `frontend/*` 中涉及目录/脚本的描述
- [ ] 更新 `README.md` 目录说明与开发命令（如依赖拆分）
- [ ] 提交（见 Phase 3.4 计划）
- [ ] 合并 master：`git checkout master && git merge --no-ff feat/workspaces-split`
- [ ] 快进分支：`git branch -f dev-frontend master && git branch -f dev-backend master`
- [ ] 提示用户 `npm run dev` + `npm run server` 手动联调一轮

## 回滚点

- 每步结束验证；第 4/5 步前均可用 `git checkout -- <file>` 或备份恢复。
- 整体回滚：`git revert feat/workspaces-split`（在 master 上），文件位置经 git 历史还原。
