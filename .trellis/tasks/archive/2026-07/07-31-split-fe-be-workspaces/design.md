# Design: 前后端分离重构（同仓双包 + npm workspaces）

## 1. 目标目录结构

```
ai-campus-agent/                     # 仓库根（npm workspaces 根）
├── package.json                     # 仅 workspaces + 总脚本 + npm-run-all2
├── package-lock.json                # npm install 重新生成
├── docs/、README.md、.gitattributes、.gitignore、.editorconfig
├── .github/、.devcontainer/、.vscode/
├── .claude/、.trellis/、AGENTS.md
├── project-proposal.pdf、_proposal_extract.txt
│
├── web/                             # 前端独立包
│   ├── package.json                 # vue / element-plus / pinia / axios + 前端 devDeps
│   ├── index.html、vite.config.ts、env.d.ts
│   ├── tsconfig.json、tsconfig.app.json、tsconfig.node.json
│   ├── eslint.config.ts、.oxlintrc.json、.prettierrc.json
│   ├── .env.example                 # VITE_*（从根移入）
│   ├── src/                         # 原根 src/（不含 project-text）
│   └── public/                      # 原根 public/（数字人视频等静态资源）
│
├── server/                          # 后端独立包
│   ├── package.json                 # mysql2 / nodemailer / tencentcloud-sdk-nodejs-tts
│   ├── index.mjs、auth.mjs、community.mjs、rag.mjs、mysql.mjs、tts.mjs、sources-rules.mjs
│   ├── .env.example、.env（本地，gitignored）
│   ├── data/knowledge-base.json
│   ├── data/project-text/           # 原根 src/project-text/ 移入
│   ├── _ingest/                     # 原根 _ingest/ 移入
│   ├── logs/                        # RAG 检索日志（运行时生成，gitignored）
│   ├── sql/、scripts/
│   └── README.md
│
└── mobile-uniapp/                   # 移动端独立包（已有 package.json，加入 workspaces）
```

## 2. 依赖拆分

### 根 `package.json`（workspaces 根）
```json
{
  "name": "ai-campus-agent",
  "private": true,
  "type": "module",
  "workspaces": ["web", "server", "mobile-uniapp"],
  "scripts": {
    "dev": "npm run dev -w web",
    "build": "npm run build -w web",
    "preview": "npm run preview -w web",
    "type-check": "npm run type-check -w web",
    "lint": "npm run lint -w web",
    "format": "npm run format -w web",
    "server": "npm run server -w server",
    "mail:test": "npm run mail:test -w server",
    "ingest:local": "npm run ingest:local -w server",
    "ingest:browser-json": "npm run ingest:browser-json -w server",
    "kb:repair": "npm run kb:repair -w server",
    "kb:repair:dry": "npm run kb:repair:dry -w server",
    "dev:all": "run-p dev server"
  },
  "devDependencies": { "npm-run-all2": "^8.0.4" }
}
```
`engines` 保留。`jiti`（vite 解析 config 用）移入 web。

### `web/package.json`
- dependencies：`vue`、`element-plus`、`pinia`、`axios`（当前根 package.json 的 4 个前端依赖原样搬入）
- devDependencies：`vite`、`@vitejs/plugin-vue`、`vue-tsc`、`typescript`、`@vue/eslint-config-typescript`、`@vue/tsconfig`、`@tsconfig/node24`、`eslint`、`eslint-plugin-oxlint`、`eslint-plugin-vue`、`oxlint`、`prettier`、`jiti`、`vite-plugin-vue-devtools`、`npm-run-all2`
- scripts：`dev`(vite)、`build`(type-check + build-only)、`build-only`(vite build)、`preview`、`type-check`(vue-tsc --build)、`lint`(oxlint + eslint)、`format`

### `server/package.json`
- dependencies：`mysql2`、`nodemailer`、`tencentcloud-sdk-nodejs-tts`（当前根 package.json 的 3 个后端依赖搬入）
- scripts：`server`(node index.mjs)、`mail:test`、`ingest:local`、`ingest:browser-json`、`kb:repair`、`kb:repair:dry`
- engines：`node >=20`

### `mobile-uniapp/`
- 独立包，但**未纳入根 workspaces**（实现时发现）：`@dcloudio/uni-app@2.0.2-5000520260324002` 依赖 `@vue/composition-api`，其 peer 要求 vue `>= 2.5 < 2.7`，与 vue3 冲突导致 `npm install` ERESOLVE 失败。保持独立，在 `mobile-uniapp/` 内单独 `npm install`。

## 3. 后端路径重构（核心）

后端目前依赖 `process.cwd()` = 仓库根。改为模块相对路径：

| 文件 | 现状 | 改为 |
|---|---|---|
| `index.mjs:40-41` | `resolve(process.cwd(), 'server/.env')` / `.env.server` | `loadEnvFile(resolve(import.meta.dirname, '.env'))`（含 `.env.server` 兼容：若存在则同样加载） |
| `mysql.mjs:38-39` | 同上 | 同上 |
| `rag.mjs:5` | `resolve(process.cwd(), 'server/data/knowledge-base.json')` | `resolve(import.meta.dirname, 'data/knowledge-base.json')` |
| `rag.mjs:6` | `resolve(process.cwd(), 'server/logs')` | `resolve(import.meta.dirname, 'logs')` |
| `index.mjs:475` | `resolve(process.cwd(), item.downloadPath)` | 定义 `const REPO_ROOT = resolve(import.meta.dirname, '..')`，改 `resolve(REPO_ROOT, item.downloadPath)`（downloadPath 存仓库相对路径） |
| `tts.mjs:39` | `resolve(process.cwd(), 'server/scripts/tts-synthesize.ps1')` | `resolve(import.meta.dirname, 'scripts/tts-synthesize.ps1')` |
| `scripts/batch-ingest-local.mjs` | `cwd = process.cwd()`，默认输入 `['src/project-text']`，输出仓库相对 | 默认输入 `['data/project-text']`，输出 `data/knowledge-base.json`，统一基于 server 目录 |
| `scripts/import-browser-export-json.mjs` | 默认 `input: 'src/project-text'` | 默认 `input: 'data/project-text'` |
| `scripts/kb-clean-tag-qc.mjs` | 基于 `process.cwd()` | 改为基于 server 目录（保留 CLI 参数覆盖） |
| `scripts/test-auth-mail.mjs` | 读 `server/.env` | 读本目录 `.env` |

说明：`import.meta.dirname` 需要 Node ≥20.11（项目 engines 已是 `^20.19.0 || >=22.12.0`，满足）。

## 4. 数据文件迁移

- `git mv src/project-text server/data/project-text`（保留 git 历史）
- `git mv _ingest server/_ingest`
- `git mv src web/src`（先把 project-text 挪走，再整体移 src）
- 改写 `server/data/knowledge-base.json` 全部 396 条的 `downloadPath`：
  - 前缀 `src/project-text/` → `server/data/project-text/`
  - 前缀 `_ingest/` → `server/_ingest/`
  - 用一次性 node 脚本做原地替换并校验。

## 5. 前端迁移

- `git mv`：`src`（去 project-text 后）→ `web/src`、`public` → `web/public`、`index.html`、`vite.config.ts`、`env.d.ts`、`tsconfig*.json`、`eslint.config.ts`、`.oxlintrc.json`、`.prettierrc.json`、`.env.example` → `web/`
- `vite.config.ts` 的 `@` 别名 `path.resolve(__dirname, './src')` 在 web/ 下仍指向 web/src，无需改；如构建报 `__dirname` 未定义，改 `fileURLToPath(new URL('./src', import.meta.url))`。
- 前端 `src/config/app.ts` 的 `apiBaseUrl` 逻辑（dev=localhost:3000，prod=同源）不变。

## 6. 分支与提交策略

- 在 `feat/workspaces-split` 分支（基于 master）上完成全部迁移 → 合并回 master。
- 合并后 `git branch -f dev-frontend master`、`git branch -f dev-backend master` 快进两条开发分支。
- 此后 `dev-frontend` 只动 `web/`，`dev-backend` 只动 `server/`（更新 `docs/git-branch-convention.md` 以覆盖包内 package.json 归各分支，不再共享依赖清单）。
- Trellis 任务记录分支：`task.py set-branch 07-31-split-fe-be-workspaces feat/workspaces-split`。

## 7. 风险与回滚

- **npm workspaces 安装变化**：`node_modules` 会重组；若 `npm install` 后某包找不到依赖，逐包 `npm install` 验证。
- **路径遗漏**：搜索残留 `process.cwd()` / `src/project-text` / `server/data` 前缀引用。
- **KB downloadPath 改写出错**：迁移前备份 `knowledge-base.json`。
- **回滚**：迁移提交在 `feat/workspaces-split` 上，`git revert` 单个提交即可回到单包结构（文件通过 git 历史恢复位置）。
- **.env.server 兼容**：迁移后只读 `server/.env`；如线上在根目录有 `.env.server` 自定义变量，需并入 `server/.env`（在 deploy 清单中提示）。

## 8. 兼容性检查点

- 端口：前端 5173、后端 3000 不变。
- CORS：`ALLOW_ORIGIN` 默认 `http://localhost:5173` 不变。
- `.gitignore`：`server/.env` 已忽略；`_ingest`、`project-text` 迁移不影响忽略规则。
- mobile-uniapp 的 API 地址逻辑不动。
