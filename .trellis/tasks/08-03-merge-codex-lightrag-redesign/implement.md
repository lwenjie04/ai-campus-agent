# Implement — 合并 codex/raycast-lightrag-redesign 到 feat/workspaces-split

执行顺序按依赖编排：**先生成物规则与后端新增（无冲突）→ 后端整合 → 前端新增 → 前端整合 → 删除/配置 → 验证 → 提交**。

## 批 0 · 前置检查

- [ ] 当前分支为 `feat/workspaces-split`，工作区干净（`git status`）
- [ ] 确认三份来源可取：`a664b7b`、`a4c2611`、`d5726e1`
- [ ] `server/data/knowledge-base.json` 当前已被 git 跟踪（后续保持）

## 批 1 · R8 数据文件规则 + R4 后端新增

- [ ] 追加 `.gitignore`：`server/data/vector-index.json`、`server/data/chunked-knowledge-base.json`、`server/data/student-handbook-lightrag.json`、`server/data/student-handbook.json`
- [ ] 复制 R4 后端新增文件（`git show a4c2611:<path> > <path>`）：`env-loader.mjs`、`lightrag.mjs`、`vector-index.mjs`、`scripts/` 下 9 个脚本、`tools/generate_digital_human_case_doc.py`
- [ ] 本地运行验证用：将 4 个 `server/data/*.json` 复制到工作区（不 `git add`），供后续 smoke 使用
- [ ] 验证：`node --check` 新增的每个 `.mjs`；`git status` 确认 data/*.json 处于 untracked

## 批 2 · R5 后端整合（5 文件）

- [ ] `server/.env.example`：合并 wssplit 的 JWT/限流 与 codex 的 LIGHTRAG_* 变量
- [ ] `server/index.mjs`：保留 wssplit 的 JWT 鉴权中间件 / 限流 / CORS 语义（取 wssplit 的 `ALLOW_ORIGIN`），搬入 codex 的 `LIGHTRAG_PRIMARY` 开关 + 健康检查缓存 + `handleChatStream` 中 LightRAG 优先检索
- [ ] `server/rag.mjs`：保留 wssplit 关键词检索，搬入 codex 的 LightRAG 辅助函数（若无则确认在 `lightrag.mjs`）
- [ ] `server/auth.mjs`、`server/mysql.mjs`：以 wssplit 为准，仅搬入 codex 必要改动（若无，跳过）
- [ ] 验证：`node --check` 5 个文件

## 批 3 · R6 后端删除

- [ ] 删除 `server/scripts/browser-export-notice.console.js`
- [ ] 验证：`git status` 无异常删除；`server/scripts/` 下无引用该文件的 import

## 批 4 · R1 前端新增（8 文件）

- [ ] 复制 `src/assets/motion.css`、`src/assets/tokens.css` → `web/src/assets/`
- [ ] 复制 `src/components/RobotAvatar.vue`、`src/components/SourcePanel.vue` → `web/src/components/`
- [ ] 复制 `src/utils/text.ts` → `web/src/utils/`
- [ ] 复制 `src/views/AdminLightRagView.vue`、`src/views/DigitalHumanPanel.vue`、`src/views/PortfolioHome.vue` → `web/src/views/`

## 批 5 · R2 前端整合（17 文件，按依赖小组）

### 组 A · 基础/接口/store（低难度）
- [ ] `types/agent.ts`、`config/app.ts`、`main.ts`、`api/llm.ts`、`api/auth.ts`、`store/agent.ts`、`store/auth.ts`
- [ ] 验证：`cd web && npx tsc --noEmit` 通过

### 组 B · 组件（中-高难度）
- [ ] `components/InputBox.vue`、`components/ChatWindow.vue`、`components/MessageItem.vue`、`components/DigitalHumanPlayer.vue`
- [ ] 验证：`cd web && npx tsc --noEmit` 通过

### 组 C · 视图（最高难度）
- [ ] `views/AdminReviewView.vue`、`views/CommunityView.vue`、`views/PostDetailView.vue`、`views/LoginView.vue`、`views/AgentChat.vue`、`App.vue`
- [ ] 验证：`cd web && npx tsc --noEmit` 通过

> 整合原则：以 `d5726e1:web/src/<f>` 为底，逐段应用 `git diff a664b7b..a4c2611 -- src/<f>` 的 codex 改动；接口契约以 wssplit 为准。

## 批 6 · R3 前端删除 + R7 根配置

- [ ] 确认 `web/src/components/VoiceOrb.vue` 无引用后删除（`web/src` 内 grep）
- [ ] 应用 `vite.config.ts` 的 codex 改动到 `web/vite.config.ts`（比对 wssplit 现有 `web/vite.config.ts`，取兼容并集）
- [ ] 验证：`cd web && npm run build` 通过

## 批 7 · 验证（AC3–AC6）

- [ ] AC3：`cd web && npx tsc --noEmit` && `npm run build` 通过，无类型错误
- [ ] AC4：`server/` 全部 `.mjs` 过 `node --check`；`cd server && timeout 15 node index.mjs` 启动无异常（超时终止属预期）
- [ ] AC5：启动日志确认无崩溃；`LIGHTRAG_PRIMARY` 默认 false 时走关键词 RAG
- [ ] AC6：`git status` 未跟踪文件仅为 `server/data/*.json`；无意外删除的 wssplit 独有文件

## 批 8 · 提交

- [ ] `git add` 明确文件清单（前端 + 后端 + .gitignore），**排除 server/data/\*.json**
- [ ] 提交信息：`merge: 合并 codex/raycast-lightrag-redesign (a4c2611) 到 feat/workspaces-split 结构`，正文说明搬移方式、LightRAG/数字人/首页改动、验证结果

## Review Gates

- 批 2 / 批 5 完成后：人工 review 整合结果（codex 语义完整、wssplit 结构未破坏）
- 批 7 完成后：AC 全绿方可进入提交
- 提交前：`git diff --stat` 与 `git status` 双确认文件范围

## Rollback 点

- 每批开始前工作区应尽量干净；若中途失败，`git checkout -- <file>` 回退单文件
- 批 8 提交前发现问题：`git reset --mixed` 取消暂存即可
- 提交后发现严重问题：`git revert <merge>`（单次提交，可干净回退）
- 全程不推送远程，本地可随时重置
