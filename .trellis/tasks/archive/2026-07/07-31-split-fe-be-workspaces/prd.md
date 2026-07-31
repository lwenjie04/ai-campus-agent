# PRD: 前后端分离重构（同仓双包 + npm workspaces）

## 背景

当前前端（`src/`）与后端（`server/`）混在**同一个 `package.json`** 下：依赖、脚本、构建耦合在一起。已确定的分支方案（`dev-frontend` / `dev-backend`）要求前后端代码真正分离，否则 `package.json` 始终是共享冲突点，跨端功能无法在各自分支独立开发。

用户已确认方案：**同仓双包 + npm workspaces**（同一 git 仓库内拆成 `web/` + `server/` + `mobile-uniapp/` 三个独立 npm 包）。

## 目标

1. 拆成同仓三包：`web/`（前端）、`server/`（后端）、`mobile-uniapp/`（移动端，已有独立包），根目录用 npm workspaces。
2. 每个包拥有独立的 `package.json`、依赖、`scripts`，可单独安装/构建/运行。
3. 数据文件归属理顺：
   - `src/project-text/`（学校通知导出数据，后端导入脚本的唯一数据源）→ 移到 `server/data/project-text/`
   - `_ingest/`（原始资料）→ 移到 `server/_ingest/`
4. 后端所有 `process.cwd()` 路径改为相对模块自身（`import.meta.dirname` / REPO_ROOT），保证从任意目录启动都正确。
5. 分支归属与新结构对齐：`web/` → `dev-frontend`，`server/` → `dev-backend`，迁移后两条分支快进到新 master。
6. 原有功能行为不变：智能问答（流式/非流式）、社区、认证、TTS、知识库附件下载、导入脚本、邮件测试。

## 非目标

- 不引入 Web 框架（仍保持原生 Node HTTP 服务）。
- 不改业务逻辑、不调接口契约。
- 不顺手清理无关代码（`ChatView.vue` 空壳、`model.ts` 空文件等另立任务）。
- 不拆成两个独立 git 仓库。
- 不做 P0 安全改造（那是下一个任务）。

## 验收标准

1. `npm install`（仓库根）一次装齐 `web` / `server` 两包依赖；`mobile-uniapp/` 因 `@dcloudio/uni-app` 依赖要求 vue<2.7 与 vue3 冲突，**不纳入根 workspaces**，独立安装（实现时发现）。
2. 根目录脚本可用：
   - `npm run dev` 启动前端（vite，默认 5173）
   - `npm run server` 启动后端（默认 3000）
   - `npm run dev:all` 同时启动前后端
   - 各包内亦可直接 `npm run dev` / `npm run server` 独立运行
3. 前端 `npm run type-check`、`npm run build`、`npm run lint` 全部通过。
4. 后端 `npm run server` 启动后 `/health` 返回 `ok: true`；`/chat`、`/chat/stream`、社区、认证、TTS、`/kb/download` 行为与迁移前一致。
5. 后端在 `server/` 目录内启动，能正确定位 `.env`、`data/knowledge-base.json`、`logs/`、`scripts/tts-synthesize.ps1`。
6. 导入脚本 `ingest:local`、`ingest:browser-json`、`kb:repair` 默认输入/输出路径指向迁移后的位置，能正常读取数据。
7. `server/data/knowledge-base.json` 的 `downloadPath` 全部指向迁移后的新位置，附件下载接口（`/kb/download?id=...`）返回正常。
8. git：迁移在 `feat/workspaces-split` 分支完成后合并回 master，`dev-frontend` / `dev-backend` 快进到新 master；此后前端改动只落在 `web/`，后端只落在 `server/`。
9. `docs/git-branch-convention.md` 与 `.trellis/spec/` 中涉及的目录/脚本描述同步更新。
