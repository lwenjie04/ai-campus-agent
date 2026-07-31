# Git 分支约定

本项目采用 **单仓 + 前后端分分支** 的开发模式：前端和后端代码在同一个仓库里，但各用各的开发分支，`master` 作为合流主干。

## 分支
- `master` — 主干/合流分支，代码始终可运行、可部署
- `dev-frontend` — 前端开发分支
- `dev-backend` — 后端开发分支

## 文件归属

### dev-frontend（前端分支只管这些路径）
- `web/` 整个包：`web/src/`、`web/public/`、`web/package.json`、`web/vite.config.ts`、`web/index.html`、`web/.env.example` 等全部前端代码与依赖

### dev-backend（后端分支只管这些路径）
- `server/` 整个包：`server/package.json`、`server/index.mjs`、`server/data/`、`server/sql/`、`server/scripts/` 等全部后端代码与依赖

### master（共享/工具，直接在 master 改，再合入需要的地方）
- 根 `package.json`、`package-lock.json` —— **仅 npm workspaces 壳 + 总脚本；各包依赖在各包内 package.json，不再共享**
- `docs/`、`README.md`
- `.github/`、`.devcontainer/`、`.vscode/`
- `.gitattributes`、`.gitignore`、`.editorconfig`
- `.claude/`、`.trellis/`、`AGENTS.md`
- `mobile-uniapp/` —— 独立包，因 uni-app 依赖与 vue3 存在 peer 冲突，**未纳入根 workspaces**，需单独 `npm install`

## 工作流
1. 纯前端改动 → 在 `dev-frontend` 上做；纯后端改动 → 在 `dev-backend` 上做。
2. 依赖变更：各包只改自己的 `web/package.json` 或 `server/package.json`，互不干扰；根 `package.json` 一般不动。
3. 跨端功能（改接口 + 改页面）：先在 `dev-backend` 定好接口并合 master，
   `dev-frontend` 从 master 同步后再接页面；最后在 master 上端到端联调。
4. 文档、配置改动直接在 master 上提交。
5. 阶段性成果定期从 `dev-*` 合并回 master，保持 master 可运行。

> 注意：两条分支是**同一个工作区**来回切换（`git checkout dev-frontend` / `dev-backend`）。
> 若两人分工，建议各自 clone 一份，一人只动前端路径、一人只动后端路径。
