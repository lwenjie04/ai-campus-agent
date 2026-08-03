# Design — 合并 codex/raycast-lightrag-redesign 到 feat/workspaces-split

## 1. 合并策略

**以 wssplit 结构为准，codex 改动作为内容来源搬入**（用户已确认「全部以 feat/workspaces-split 为主，依旧前后端分离」）。

- 前端：codex 的 `src/` 改动 → 落到 `web/src/` 对应文件。
- 后端：codex 的 `server/` 改动 → 落到 `server/` 对应文件（目录未变，直接按内容整合）。
- 不产生传统意义上的 `git merge` 冲突树；采用「内容搬移 + 手工三方整合」，最终形成普通提交。

## 2. 操作分类

| 分类 | 操作 | 文件数 | 处理方式 |
|---|---|---|---|
| R1 前端新增 | 复制 | 8 | `git show a4c2611:src/<f> > web/src/<f>` |
| R2 前端修改 | 三方整合 | 17 | 逐文件合并 codex 版 + wssplit 版 |
| R3 前端删除 | 删除 | 1 | 删除 `web/src/components/VoiceOrb.vue`（chat.ts / ChatView 两侧已删，无操作） |
| R4 后端新增 | 复制 | 14 | `git show a4c2611:server/<f> > server/<f>` |
| R5 后端修改 | 三方整合 | 5 | `index.mjs`、`auth.mjs`、`rag.mjs`、`mysql.mjs`、`.env.example` |
| R6 后端删除 | 删除 | 1 | `server/scripts/browser-export-notice.console.js` |
| R7 根配置 | 复制到 web | 1 | `vite.config.ts` 改动 → `web/vite.config.ts` |
| R8 数据文件 | gitignore | 4 | `server/data/*.json` 不入库，追加 `.gitignore` |

## 3. 三方整合方法论

对每个 R2/R5 文件，取三份来源：

1. **基线** `a664b7b:src/<f>`（或 `server/<f>`）——合并起点
2. **codex 改动** `git diff a664b7b..a4c2611 -- <path>`——要搬入的功能
3. **wssplit 现状** `d5726e1:web/src/<f>`（或 `server/<f>`）——必须保留的结构与安全逻辑

操作顺序：**先用 `git merge-file` 以基线为共同祖先做三方合并**，若自动冲突无法满足功能语义（codex 与 wssplit 改动同一区域时），改为**手工**以 wssplit 版本为底、逐段应用 codex 改动。

**依赖约束**：R1/R4 新增文件必须先落地，因为 R2/R5 整合后的代码会 import 它们（如 `PortfolioHome.vue`、`SourcePanel.vue`、`lightrag.mjs`、`env-loader.mjs`、`vector-index.mjs`）。

## 4. 关键整合点

### 4.1 前端 R2（17 个文件，整合难度排序）

| 文件 | codex 改动要点 | wssplit 保留要点 | 难度 |
|---|---|---|---|
| `views/AgentChat.vue` | 重写聊天流，接 SourcePanel / 新消息类型 | 布局与 store 结构 | 高（657/223 差异） |
| `components/DigitalHumanPlayer.vue` | 大幅重构数字人播放 | 原播放逻辑 | 高（457/237） |
| `components/MessageItem.vue` | 消息渲染增强（引用/来源面板） | 原有消息渲染 | 高（285/43） |
| `components/ChatWindow.vue` | 窗口交互改动 | 原有结构 | 中（55/120） |
| `App.vue` | 路由/布局改动（引入 PortfolioHome） | wssplit 现有布局 | 中（196/167） |
| `views/LoginView.vue` | 登录页样式/交互 | JWT 登录流程 | 中（163/109） |
| `views/AdminReviewView.vue` | 审核页增强 | wssplit 现有审核流程 | 中（93/143） |
| `views/CommunityView.vue` | 社区改动 | wssplit 现有社区 | 中（64/267） |
| `views/PostDetailView.vue` | 详情页改动 | 现有详情 | 中（28/167） |
| `api/auth.ts`、`api/llm.ts` | 接口调整 | JWT 携带逻辑 | 中 |
| `store/auth.ts`、`store/agent.ts` | store 改动 | wssplit 现有 store | 低-中 |
| `main.ts`、`config/app.ts`、`types/agent.ts` | 小改 | wssplit 配置 | 低 |

> 原则：**接口契约以 wssplit 为准**。codex 是独立演进的分支，其前端调用的后端接口可能不一致（例如 codex 用 `X-User-Id`，wssplit 用 JWT），合并后以前端实际请求为准，必要时调整后端。

### 4.2 后端 R5（5 个文件）

- **`index.mjs`**：codex 注入 LightRAG 主用（`LIGHTRAG_PRIMARY` 开关、健康检查缓存、`handleChatStream` 中 LightRAG 优先 + 关键词回退）；wssplit 含 JWT 鉴权中间件、登录/验证码限流、强制改密路由、CORS 加固。**两套逻辑共存**：鉴权/限流在请求入口层，LightRAG 在聊天检索层，不冲突。需检查 `ALLOW_ORIGIN`（codex 改为 `*`，wssplit 可能保留具体源）取 wssplit 语义。
- **`auth.mjs`**：codex 可能改动有限；以 wssplit 的 JWT / 验证码 / 改密实现为准，仅搬入 codex 必要改动。
- **`rag.mjs`**：codex 新增 `queryLightRag` / `lightragContextToSources` 等 LightRAG 辅助函数（也可能在 `lightrag.mjs`）；wssplit 的关键词检索保留。
- **`mysql.mjs`**：检查 codex 是否有 schema 相关改动；以 wssplit 为准。
- **`.env.example`**：合并两边的环境变量（wssplit 的 JWT/限流 + codex 的 LIGHTRAG_* 等）。

### 4.3 生成物与仓库卫生

- `server/data/vector-index.json`（12.5MB）、`chunked-knowledge-base.json`、`student-handbook-lightrag.json`、`student-handbook.json` → `.gitignore`，由 `scripts/build-*.mjs` 生成。
- 确认 `server/data/knowledge-base.json`（基线已有，双方未冲突）继续保留跟踪。
- 复制 `server/data/*.json` 用于本地运行验证，但不 `git add`。

## 5. 验证方案（用户已确认：编译 + 启动）

| 层 | 命令 | 覆盖 |
|---|---|---|
| 后端语法 | `node --check <server 全部 .mjs>` | 语法 |
| 前端类型 | `cd web && npx tsc --noEmit` | 类型 |
| 前端构建 | `cd web && npm run build` | 打包 |
| 后端启动 | `cd server && node index.mjs`（超时终止） | 启动、路由注册、LightRAG 健康检查逻辑不崩溃 |
| 冒烟 | 启动后请求 `/api/health` 等公开路由 | 基本可达 |

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| codex 前端接口与 wssplit 后端契约不一致 | 整合时逐接口核对（auth、llm、chat、community、admin、lightrag） |
| `AgentChat.vue` / `DigitalHumanPlayer.vue` 大面积重写导致功能回归 | 保留 wssplit 的 store/路由结构，codex 改动局部应用 |
| 12.5MB 生成物误提交 | 提交前 `git status` 检查，`.gitignore` 先行追加 |
| LightRAG 健康检查在无 LightRAG 实例时刷日志 | 保留 codex 的 `LIGHTRAG_PRIMARY=false` 默认关闭语义 |
| 前端 build 依赖新引入的 assets（motion.css / tokens.css） | R1 先行，build 前确认文件齐全 |

## 7. 提交形态

单次提交（或按「后端 → 前端 → 配置」分 2–3 次），信息注明：合并 codex/raycast-lightrag-redesign（a4c2611）到 wssplit 结构，含 LightRAG 主用 / 数字人 / 首页重构，前后端分离保持。
