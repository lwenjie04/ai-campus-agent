# Git 分支约定

本项目采用 **单仓 + 前后端分分支** 的开发模式：前端和后端代码在同一个仓库里，但各用各的开发分支，`master` 作为合流主干。

## 分支
- `master` — 主干/合流分支，代码始终可运行、可部署
- `dev-frontend` — 前端开发分支
- `dev-backend` — 后端开发分支

## 文件归属

### dev-frontend（前端分支只管这些路径）
- `src/`、`public/`、`mobile-uniapp/`
- `index.html`、`vite.config.ts`、`env.d.ts`、`tsconfig*.json`
- `eslint.config.ts`、`.oxlintrc.json`、`.prettierrc.json`
- `.env.example`（根目录，VITE_* 前端变量）

### dev-backend（后端分支只管这些路径）
- `server/`（含 `server/.env.example`、`server/sql/` 等）

### master（共享/工具，直接在 master 改，再合入需要的地方）
- `package.json`、`package-lock.json` —— **前后端依赖共存于根目录，两边共享**
- `docs/`、`README.md`
- `.github/`、`.devcontainer/`、`.vscode/`
- `.gitattributes`、`.gitignore`、`.editorconfig`
- `.claude/`、`.trellis/`、`AGENTS.md`

## 工作流
1. 纯前端改动 → 在 `dev-frontend` 上做；纯后端改动 → 在 `dev-backend` 上做。
2. 共享文件 `package.json` / `package-lock.json`：谁需要新增依赖就在谁的分支改，
   改完**尽快合并回 master 并同步到另一分支**；package-lock 冲突以重新 `npm install` 解决。
3. 跨端功能（改接口 + 改页面）：先在 `dev-backend` 定好接口并合 master，
   `dev-frontend` 从 master 同步后再接页面；最后在 master 上端到端联调。
4. 文档、配置改动直接在 master 上提交。
5. 阶段性成果定期从 `dev-*` 合并回 master，保持 master 可运行。

> 注意：两条分支是**同一个工作区**来回切换（`git checkout dev-frontend` / `dev-backend`）。
> 若两人分工，建议各自 clone 一份，一人只动前端路径、一人只动后端路径。
