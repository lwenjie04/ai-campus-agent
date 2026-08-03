# 合并 codex/raycast-lightrag-redesign 到 feat/workspaces-split

## Goal

将 codex 分支 `a4c2611`（codex/raycast-lightrag-redesign tip，10 个提交）的功能改动完整搬移到 `feat/workspaces-split`（`d5726e1`）并合并。codex 分支的改动基于旧的单包布局（前端在根目录 `src/`），而 wssplit 已完成 npm workspaces 拆分（前端在 `web/src/`），因此前端改动需手动搬移到新布局，后端 `server/` 下的改动按内容整合。

## 背景（分叉情况）

- 合并基线：`a664b7b`（两端共同祖先）
- codex：`a4c2611`，相对基线 10 个提交（首页重构 / LightRAG 主用 / 数字人稳定化 / Vue Trellis 引导）
- wssplit：`d5726e1`，相对基线 41 个提交（workspaces 拆分 + P0 安全加固 + 多项清理）
- 合并目标：`feat/workspaces-split`（当前分支）

## Requirements

### R1 前端新增文件（codex 独有）→ 复制到 `web/src/` 对应位置

- `src/assets/motion.css`、`src/assets/tokens.css` → `web/src/assets/`
- `src/components/RobotAvatar.vue`、`src/components/SourcePanel.vue` → `web/src/components/`
- `src/utils/text.ts` → `web/src/utils/`
- `src/views/AdminLightRagView.vue`、`src/views/DigitalHumanPanel.vue`、`src/views/PortfolioHome.vue` → `web/src/views/`

### R2 前端修改文件（两侧均有改动）→ 三方整合到 `web/src/` 对应文件

17 个文件，需合并 codex 版本（`a4c2611:src/<f>`）与 wssplit 版本（`d5726e1:web/src/<f>`）两套改动：

`App.vue`、`main.ts`、`config/app.ts`、`api/auth.ts`、`api/llm.ts`、`store/agent.ts`、`store/auth.ts`、`types/agent.ts`、`components/ChatWindow.vue`、`components/DigitalHumanPlayer.vue`、`components/InputBox.vue`、`components/MessageItem.vue`、`views/AgentChat.vue`、`views/AdminReviewView.vue`、`views/CommunityView.vue`、`views/LoginView.vue`、`views/PostDetailView.vue`

### R3 前端删除

- `store/chat.ts`、`views/ChatView.vue`：两侧均已删除 → 无操作
- `components/VoiceOrb.vue`：codex 已删除，wssplit 仍保留 `web/src/components/VoiceOrb.vue` → 确认无引用后删除

### R4 后端新增（codex 独有）→ 复制到 `server/`

- `env-loader.mjs`、`lightrag.mjs`、`vector-index.mjs`
- `scripts/build-chunked-kb.mjs`、`scripts/build-vector-index.mjs`、`scripts/check-lightrag.mjs`、`scripts/check-vector-readiness.mjs`、`scripts/extract-docx-paragraphs.ps1`、`scripts/import-kb-to-lightrag.mjs`、`scripts/import-student-handbook-docx.mjs`、`scripts/query-lightrag.mjs`、`scripts/start-lightrag.mjs`、`scripts/test-rag-retrieval.mjs`
- `tools/generate_digital_human_case_doc.py`

### R5 后端修改（两侧均有改动）→ 内容整合

`server/index.mjs`、`server/auth.mjs`、`server/rag.mjs`、`server/mysql.mjs`、`server/.env.example`

- codex 侧注入 LightRAG 主用 + 健康检查逻辑；wssplit 侧含 JWT 鉴权 / 限流 / 强制改密。两套逻辑须共存。

### R6 后端删除

- `server/scripts/browser-export-notice.console.js`（codex 已删，wssplit 仍有）→ 删除

### R7 根配置

- `vite.config.ts` 的 codex 改动 → 应用到 `web/vite.config.ts`

### R8 生成数据文件不入库（用户已确认）

- `server/data/vector-index.json`（12.5MB）、`chunked-knowledge-base.json`、`student-handbook-lightrag.json`、`student-handbook.json` **不提交**，加入 `.gitignore`；由 `server/scripts/build-*.mjs` 重新生成。

## Constraints

- **以 feat/workspaces-split 结构为准**：合并全部基于 wssplit 的目录结构进行，保持前后端分离（前端 `web/`、后端 `server/`）。codex 的旧布局改动一律搬移到新布局，绝不把前端文件放回根目录 `src/`。
- 保留 codex 的功能语义：LightRAG 优先 + 关键词 RAG 回退、健康检查缓存、数字人面板、PortfolioHome 首页、社区/RAG 改动。
- 保留 wssplit 的安全加固：JWT 鉴权、管理员接口防护、登录/验证码限流、强制改密。
- codex 未改动的 wssplit 结构（.claude/、.trellis/、GitHub Actions、部署清单、pm2 配置）保持原样。
- 只合并功能改动，不搬移 codex 分支的 Trellis 引导提交内容。

## Acceptance Criteria

- [ ] AC1：`web/src/` 下完成 R1（8 个新文件）、R2（17 个文件整合）、R3（删除 VoiceOrb.vue）；`server/` 下完成 R4–R7。
- [ ] AC2：`server/data/*.json` 均未被 git 跟踪（已 gitignore），`.gitignore` 已更新。
- [ ] AC3：前端 `web/` 下 `tsc` / vite build 编译通过，无类型错误。
- [ ] AC4：后端所有 `.mjs` 通过 `node --check`；服务器启动无异常，健康检查 / 路由正常。
- [ ] AC5：LightRAG 主用逻辑（`LIGHTRAG_PRIMARY` 开关 + 健康检查回退）与 wssplit 的 JWT 鉴权、限流逻辑共存且均生效。
- [ ] AC6：git 工作区无意外删除的 wssplit 独有文件；未跟踪文件仅为预期的 `server/data/` 生成物。
- [ ] AC7：合并提交信息清晰（说明 codex 来源、搬移方式、验证结果）。

## Notes

- 本任务为单一复杂任务，不拆分父子任务：前后端改动相互耦合（前端调用新的 `/api/llm`、`/api/lightrag` 等），须一次性整合并整体验证。
- 关键整合难度集中在 R2 的 `views/AgentChat.vue`（codex vs wssplit 差异约 657/223 行）、`components/DigitalHumanPlayer.vue`（457/237）、`components/MessageItem.vue`（285/43）。
