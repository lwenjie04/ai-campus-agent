# 数智校答 V2 差距分析（计划 vs 仓库现状）

**分析日期**：2026-10-20  
**状态快照**：开工前（39 项：0 ✅ / 18 🟡 / 21 ⬜）；实时进度以 [`v2-execution-board.md`](v2-execution-board.md) 为准  
**对照基准**：[`campus-service-v2-development-plan.md`](campus-service-v2-development-plan.md)（下称“计划”）、[`interaction-flow-v2.md`](interaction-flow-v2.md)  
**代码基线**：分支 `codex/campus-service-platform`，HEAD `237ba72`（2026-08-18 16:45）；工作区有 38 个已跟踪文件改动 + 11 个未跟踪文件，均未提交  
**方法**：逐任务读代码与测试，结论均附 `文件:行`；无法离线验证的外部依赖（Figma、真实模型、MySQL、SMTP、TTS）单独标注，不混入“已实现”  
**配套文件**：[`v2-execution-board.md`](v2-execution-board.md)（双 AI 执行计划表，任务完成情况在那里标注）

---

## 0. 结论速览

- **39 项任务中：0 项完成、18 项部分实现、21 项未开始。** 这与计划第 387 行“39 个任务均保持未完成”的自我声明一致。
- **三个结构性卡点**，其余工作大多被它们阻塞：
  1. **没有路由**（无 `vue-router`，`main.ts` 无 router）→ 卡住 1.3/1.4、5.x 深链、6.x URL 状态、A02。
  2. **API 前缀仍分叉**：后端已同时支持 `/api/*` 与裸路径，前端仍打裸 `/chat`、`/tts`，Vite 仍宽前缀反代 7 个路径 → 卡住 1.1/1.2、2.5、7.3。
  3. **没有多会话模型**：仍是单 key `ai-campus-agent.session.v2` → 卡住 3.x 全部，以及 4.1 的运行身份与 4.5 的媒体归属。
- **后端比计划描述得更成熟**的部分（无需重写，补测试/接线即可）：`/api` 双别名、NDJSON 流且带 `X-Accel-Buffering: no`、游客额度 `reserved/settled/commit/rollback`、IP 窗口限频、TTS 登录会话鉴权与限流、知识草稿生成去重、LightRAG 控制台未配置时禁用。
- **后端比计划描述得更欠缺**的部分：无 `phase` 事件（全仓 0 命中）、无客户端断开取消、无 `chat_request_receipts`/`chat_feedback` 与反馈接口、审核状态转换无校验、来源元数据无日期/适用范围字段。
- **视觉方向存在硬冲突**：工作区实测的 `design-system.css` 是纸质底 + 信号橙 + 青绿体系，计划 §1 要求银白 + 深绿 `#005B46`。这不是“Sprint 2 已完成”，而是**计划之前的一次独立视觉尝试**，需人工拍板（见 §5.1）。

### 状态统计（按 Sprint）

| Sprint | 任务数 | ✅ 完成 | 🟡 部分 | ⬜ 未开始 |
| --- | --- | --- | --- | --- |
| S0 基线/设计/契约 | 4 | 0 | 1 | 3 |
| S1 API 与路由 | 5 | 0 | 2 | 3 |
| S2 视觉与问答页 | 5 | 0 | 5 | 0 |
| S3 多会话与登录恢复 | 5 | 0 | 1 | 4 |
| S4 生成生命周期/来源/语音 | 6 | 0 | 3 | 3 |
| S5 办事指南 | 4 | 0 | 0 | 4 |
| S6 社区与后台 | 5 | 0 | 5 | 0 |
| S7 反馈与发布 | 5 | 0 | 1 | 4 |
| **合计** | **39** | **0** | **18** | **21** |

> “🟡 部分”只表示**仓库里已有可复用的代码或配置**，不代表可用；每项剩余缺口见 §3。
>
> 口径差异：执行计划表把 0.1 记为 🔵（本轮已完成“盘点”部分，待你确认提交策略），所以那张表是 0/18/1/20；本文按仓库事实统计，0.1 仍未完成，故为 0/18/21。两者不矛盾。

---

## 1. 仓库现状是怎么形成的（时间线）

| 时间 | 事件 | 证据 |
| --- | --- | --- |
| 2026-08-13 00:42 | `f17f84d` 产品化改造 | `git log` |
| 2026-08-18 16:45 | `237ba72` 发布就绪加固（新增 `client-ip.mjs`、`tts` 鉴权、4 个测试） | `git log -1 --stat` |
| 2026-08-18 17:24–17:47 | **前端视觉改版（未提交）**：13 个文件 +1624/−1918，新增 `src/styles/design-system.css`，删除 `src/store/chat.ts`、`src/views/ChatView.vue` | 文件 mtime；`git diff --stat` |
| 2026-08-20 10:09 | **服务端低置信度兜底（未提交）**：`filterConfidentRagHits`、`RAG_ANSWER_MIN_SCORE`、低匹配答复、2 个新测试 | `server/index.mjs:642`、`server/rag.mjs:578` |
| 2026-08-20/21 | 数字人方案文档（Live2D / Rive） | `docs/live2d-web-digital-human-plan.md`、`docs/rive-web-ai-avatar-plan.md` |
| 2026-10-20 10:49 | `dist/` 重新构建 | 目录 mtime |
| 2026-10-20 11:40/11:48 | **交互说明 + V2 完整开发计划**（本计划） | `docs/interaction-flow-v2.md`、`docs/campus-service-v2-development-plan.md` |

**结论**：V2 计划写在“一批两个月前的前端视觉 WIP + 一次后端兜底 WIP”之上；计划 §2 第 40 行“Git 有大量未提交改动，实现前保留现状”描述的正是这批内容。计划本身没有代际上的“Sprint 2 产物”。

---

## 2. 当前未提交改动对应哪个 Sprint

四批改动性质不同，**没有一批能完整对应计划的某个 Sprint**：

| 批次 | 内容 | 最接近的计划任务 | 判定 |
| --- | --- | --- | --- |
| A（8-18 前端） | 品牌“校答”、编号导航 01/02/03、纸张网格底、左舞台布局、登录弹窗加宽、社区/后台/问答样式重写 | 0.1（待保留基线）+ 2.1/2.2/2.3 的**尝试** | **不能算 2.x**：配色 token 与计划 §1 的深绿稿冲突；且 2.x 前置 1.1–1.5 尚未做 |
| B（8-20 服务端） | 低置信度直接拒答、`RAG_ANSWER_MIN_SCORE` 独立阈值、候选数日志、2 个测试 | A15 验收 + 4.4 “低匹配明确无法确认”的一部分 | **可保留**，属于 Sprint 4 的前置能力；但不含来源元数据字段 |
| C（8-20/10-20 文档） | 交互说明、V2 计划、Live2D/Rive 方案、提案 PDF/文本迁入 `docs/` | 0.2 的输入、0.4 的输入 | 属计划准备材料，不是任务完成 |
| D（mobile-uniapp） | 目录从根迁到 `mobile-uniapp/src/`（旧文件显示为删除、新文件未跟踪），`tsconfig.json` 改 include | 计划明确“本次不扩展 uni-app” | **范围外**，建议单独提交或 stash，勿混入 V2 |

**因此**：A 批的正确处置是 **0.1 固定基线**——先原样存档（提交到 `codex/` 分支或打 WIP commit），再由 2.1 决定是否整体替换视觉；B 批可作为 4.4/A15 的既有实现保留；C 批是 0.2/0.4 的素材；D 批应隔离。

> **处置结果（2026-10-20）**：A→`61756be`、B→`364b6b8`、C→`46d754d`、D→`4af3c89`；工作区已清空，详见 [`development-baseline-v2.md`](development-baseline-v2.md)。

---

## 3. 逐任务差距

### Sprint 0：固定基线、补齐设计与接口约定

| ID | 状态 | 已有实现 / 证据 | 剩余缺口 |
| --- | --- | --- | --- |
| 0.1 固定基线 | ⬜ | 工作区改动还在，未丢失 | 未提交、无 `docs/development-baseline-v2.md`、未记录恢复方式；38+11 个文件归属未盘点 |
| 0.2 补 Figma 状态 | 🟡 | `docs/interaction-flow-v2.md`（206 行）已写明页面/路由/控件与“当前情况” | Figma 节点 10:34 的加载/空/失败/权限状态无法离线核实；需人工补稿 |
| 0.3 固定运行基线 | ⬜ | `package.json` 有 `engines`；实测 Node v23.11.0 / npm 10.9.2 / lockfile v3；`docs/product-status.md` 记录了旧基线（13/13、20/20） | 无 `development-baseline-v2.md`；旧文档数字已过期（现为 12 文件/31 用例）；`vue-router`、`vitest` 均未安装也未进 lock |
| 0.4 状态/API/契约 | ⬜ | 计划 §4 本身已定义大部分约定，可直接抽取 | 无 `docs/api-contract-v2.md`；取消/额度/反馈字段未冻结，导致 4.3、7.1、7.2 无共同依据 |

### Sprint 1：API 隔离与页面路由

| ID | 状态 | 已有实现 / 证据 | 剩余缺口 |
| --- | --- | --- | --- |
| 1.1 统一 API 构造 | 🟡 | `src/config/app.ts:22` 集中了 `apiBaseUrl`，并处理了“生产包误配 localhost” | 无 `/api` 根；调用点仍拼 `apiBaseUrl}/chat`（`src/api/llm.ts:102,126`）、`/tts`（`src/api/tts.ts:23`）；无尾斜杠/绝对根归一化 |
| 1.2 代理与来源路径 | 🟡 | 后端已双别名：`server/index.mjs:938`、`auth.mjs:610`、`community.mjs:1336`、`tts.mjs:347`；NDJSON 与 `X-Accel-Buffering: no`（`index.mjs:529-532`）；`/kb/download` 需管理员（`index.mjs:1001-1004`） | `vite.config.ts:7-15` 仍反代 `/api /auth /chat /community /tts /kb /lightrag`；来源 URL 仍产出裸 `/kb/download`（`server/rag.mjs:640`）；无 `/api` 契约测试；Nginx 未核对 |
| 1.3 引入路由 | ⬜ | 无 | 无 `vue-router` 依赖、无 `src/router/`、`src/main.ts` 仅 `createPinia`；`src/App.vue:112-117` 用 `activeSection` 条件切换 |
| 1.4 权限与返回 | ⬜ | `authStore.isAdmin` 条件渲染（`App.vue:69`）；登录弹窗已有 | 无路由守卫、无 404 视图、无 `returnTo` 白名单；当前直接访问任何路径都落到同一 SPA 根 |
| 1.5 Vitest 入口 | ⬜ | 后端 `node:test` 已可用 | 无 `vitest`、无 `vitest.config.ts`、无 `src/**/__tests__`、无 `test:unit` 脚本 |

### Sprint 2：视觉与问答主页

| ID | 状态 | 已有实现 / 证据 | 剩余缺口 |
| --- | --- | --- | --- |
| 2.1 设计 token | 🟡 | `src/styles/design-system.css`（203 行）已有完整 token 与 Element Plus 覆写，`main.ts` 已引入 | 配色与目标不符：`--paper:#f2eee5`、`--signal:#f04f2f`、`--teal:#0e8c88`（`design-system.css:5-14`）；目标为银白 + `#005B46`/`#00664F`/`#E7F1EC`；无图标资产与字体落地 |
| 2.2 首页与导航 | 🟡 | 现有 `App.vue` 已有品牌区、编号导航、登录弹窗 | 无独立 `HomeView.vue`；首页内容并入 `AgentChat.vue`（`left-stage` 区块）；无帮助面板、无“开始提问”独立落点 |
| 2.3 响应式问答布局 | 🟡 | `AgentChat.vue` 已重排阅读区/来源区；`MessageItem` 内嵌来源卡 | 无 `SourcePanel.vue`、无手机底部来源抽屉；来源未绑定“选中回答 ID”；无长回答/多来源的输入区保护 |
| 2.4 输入与推荐问题 | 🟡 | `InputBox.vue:8` 支持 Enter 发送；`AgentChat.vue` 有“常办事项”快捷入口 | 无 IME `composition` 保护（中文选词会误发，A04 不通过）、无草稿、无 Shift+Enter 换行、快捷问题直接发问而非“仅预填” |
| 2.5 连接问答与手机布局 | 🟡 | NDJSON 流已通；`server/scripts/inspect-responsive-layout.mjs` 已支持 `CHROME_PATH` 与截图（8-18 改动） | 五个宽度未在改版后复测；脚本依赖本机 Chrome；无 Figma 同尺寸对照 |

### Sprint 3：多会话、历史、草稿与登录恢复

| ID | 状态 | 已有实现 / 证据 | 剩余缺口 |
| --- | --- | --- | --- |
| 3.1 会话模型 | ⬜ | 现有单会话持久化：`src/store/agent.ts:5` `ai-campus-agent.session.v2` | 无 `conversationId/ownerScope/schemaVersion/draft`；无容量上限、无节流写入、无 `localStorage` 失败提示（当前静默 catch） |
| 3.2 迁移旧缓存 | ⬜ | 无 | 无迁移模块、无幂等与 legacy 归属确认 |
| 3.3 新建/历史/路由恢复 | ⬜ | `agent.ts` 有 `resetSession` | 无历史抽屉、无 `/chat/:id`；刷新只能恢复唯一会话 |
| 3.4 登录恢复意图 | 🟡 | 已有登录弹窗与“登录后由 AgentChat 自动补发”的注释逻辑（`App.vue:186`）；游客第二问触发登录 | 无 `intentId/type/target/createdAt/consumedAt`；动作散落在组件回调，刷新/重挂载会重复或丢失 |
| 3.5 账号隔离 | ⬜ | 认证态按账号存 `ai-campus-agent.auth.v4`（`store/auth.ts:19`） | 会话全局共享，A 退出后 B 仍可见；退出未停媒体；游客历史无 scope |

### Sprint 4：生成生命周期、来源与按需语音

| ID | 状态 | 已有实现 / 证据 | 剩余缺口 |
| --- | --- | --- | --- |
| 4.1 请求身份与取消 | ⬜ | 流式渲染已可用 | `fetch` 未传 `AbortSignal`（`api/llm.ts:126`）；无 `runId`；无 `interrupted` 状态；刷新遗留 `pending` 不会转中断 |
| 4.2 取消传递 | ⬜ | 服务端 `AbortController` 只用于超时（`index.mjs:289,360`） | 无 `req/res` close 监听；断开后仍写响应并结算；上游 `queryLightRag`/模型流不接收 signal |
| 4.3 阶段事件与额度结算 | 🟡 | `guest-quota.mjs:136-163` 已有 `reserved/settled/commit/rollback`；`index.mjs:704/722/878/892` 已接线；`session-guest-quota.test.mjs`、`chat-fallback.test.mjs` 覆盖单次结算 | 全仓无 `phase` 事件；`start` 在检索之后才发（`index.mjs:673`）；断开即 commit，无 settled 竞态测试 |
| 4.4 来源元数据 | 🟡 | `rag.mjs:625-644` 产出 `type/title/url/attachments`；低置信度已清空来源（8-20 改动） | 缺 `sourceId/publishedAt/updatedAt/applicablePeriod/validity`；三支来源结构各异无统一适配器；前端仍显示“可信度 xx%”（`MessageItem.vue:65-66`），与计划“不把分数当正确率”冲突 |
| 4.5 按需语音 | 🟡 | 服务端已要求登录会话 + 用户/IP 限流（`tts.mjs:362-383`），`tts-auth.test.mjs` 覆盖 401/429/超长 | 前端仍默认按句自动讲解（`agent.ts` 的 `splitSpeakableChunks` 自动链路）；仍保留 `VITE_TTS_AUTH_TOKEN` 共享密钥旁路（`tts.mjs:351-361`、`tts.ts:18-20`）；无播放 token/队列取消/ObjectURL 释放 |
| 4.6 联测 | ⬜ | 无 | 无 `chat-cancellation.test.mjs`；浏览器旅程未覆盖取消、切换、TTS 失败 |

### Sprint 5：办事指南

| ID | 状态 | 已有实现 / 证据 | 剩余缺口 |
| --- | --- | --- | --- |
| 5.1 事项清单 | ⬜ | 仅 `AgentChat.vue` 内 4 个快捷入口（`serviceShortcuts`） | 无 `src/data/services.ts`、无 `service-catalog-v2.md`；无稳定 ID/分类/来源/核对日期 |
| 5.2 列表与详情 | ⬜ | 无 | 无 `ServiceDirectoryView/ServiceDetailView`；分类卡目前直接发问，不是列表落点 |
| 5.3 搜索与提问桥接 | ⬜ | 无 | 无 `ServiceSearchDialog`、无 `drafts` store；无“仅预填不发送” |
| 5.4 目录与金标核对 | ⬜ | 金标仍为 20 条（`server/evals/campus-service-golden-questions.json`，`items=20`，`targetTop1Accuracy=0.9`） | 计划要求扩到 50 条 + ≥10 条未覆盖/歧义；无目录与知识命中对照 |

### Sprint 6：社区与知识运营

| ID | 状态 | 已有实现 / 证据 | 剩余缺口 |
| --- | --- | --- | --- |
| 6.1 社区列表/详情 | 🟡 | `CommunityView.vue`、`PostDetailView.vue` 已存在并已改版；`store/community.ts` 有分页（`page/pageSize`） | 无 URL 路由/筛选入 URL；无滚动恢复；详情未监听路由 ID 变化；问答原帖返回链路依赖组件事件 |
| 6.2 投稿/回复/草稿 | 🟡 | 发布弹窗（`CommunityView.vue:11,110-161`）、回复区（`PostDetailView.vue:70+`）已可用 | 无按身份草稿、无重复提交保护、无“成功但刷新失败”独立提示；未审核内容提示不完整 |
| 6.3 后台路由与界面 | 🟡 | `AdminReviewView.vue` 已有 `review`/`lightrag` 双 tab（`:28-44`） | 未拆成 `/admin/review`、`/admin/retrieval` 路由；手机端表格未验证；详情关闭不返回队列 |
| 6.4 审核状态与部分失败 | 🟡 | 通过/生成接口与草稿去重已存在（`community.mjs:1428-1448`、`1166-1204`） | 状态更新无合法转换校验（`community.mjs:872-879` 无 `WHERE status='pending'`）；通过不生成，无分步重试；仅鉴权测试 |
| 6.5 闭环验证 | 🟡 | `community-auth.test.mjs` 覆盖越权；LightRAG 外链未配置时禁用（`AdminReviewView.vue:427-431`，`app.ts:27`） | 未覆盖失败重试、来源返回、普通账号越权全链路；未在正式数据上跑 |

### Sprint 7：反馈与发布

| ID | 状态 | 已有实现 / 证据 | 剩余缺口 |
| --- | --- | --- | --- |
| 7.1 请求凭据与反馈表 | ⬜ | 无 | 无 `server/sql/migrations/`、无 `request-receipts.mjs`、无 `feedback.mjs`；旧 `community-feature-v1.sql:16-19` 仍含 `DROP TABLE`，不能重跑 |
| 7.2 反馈接口 | ⬜ | 无 | 无 `POST /api/feedback`、无 `feedbackEligible`、无唯一约束/限频；前端无 `MessageActions.vue` |
| 7.3 CI 门禁 | ⬜ | `release-check.mjs:5-46` 已串 6 步（assets/syntax/server-tests/vector/golden/build）；`service:journey` 会起 mock 后端 + preview 跑 10 轮 | 无 `.github/workflows/quality.yml`（仅 `dependabot.yml`）；`release:check` 不含 lint、`test:unit`、journey；旅程与响应式脚本依赖本机 Chrome/固定 Windows 路径 |
| 7.4 目标环境验证 | ⬜ | `docs/release-checklist.md`、`deploy-server-checklist.md` 存在 | 无真模型/MySQL/SMTP/TTS/反代实测记录；无 50 条金标与耗时数据 |
| 7.5 交付/回滚 | 🟡 | `docs/product-status.md`（内容日期 8-12）、`README.md`、发布清单存在 | 无 `docs/releases/v2-handoff.md`；product-status 数字过期；无 V2 回滚步骤与版本清单 |

---

## 4. 与计划不一致的文件位置

计划里点名、但仓库中**不存在**或**职责不同**的位置（按落地顺序）：

| 计划位置 | 现状 | 说明 |
| --- | --- | --- |
| `src/router/index.ts`、`src/router/guards.ts` | 不存在 | 无 vue-router 依赖 |
| `src/layouts/AppLayout.vue`、`src/layouts/AdminLayout.vue` | 不存在 | 布局仍在 `App.vue` |
| `src/views/HomeView.vue` | 不存在 | 首页内容在 `AgentChat.vue` |
| `src/views/ServiceDirectoryView.vue`、`ServiceDetailView.vue`、`NotFoundView.vue`、`AdminRetrievalView.vue` | 不存在 | 后台检索是 tab，不是路由 |
| `src/components/SourcePanel.vue`、`HistoryDrawer.vue`、`AppHeader.vue`、`HelpPanel.vue`、`MessageActions.vue`、`VoiceGuidePanel.vue`、`PostEditorDialog.vue`、`ServiceSearchDialog.vue` | 不存在 | 来源/投稿/登录均为内嵌实现 |
| `src/components/base/` | 不存在 | 无基础组件层 |
| `src/store/conversations.ts`、`auth-intent.ts`、`drafts.ts`、`narration.ts`、`community-drafts.ts` | 不存在 | 只有 `agent/auth/community` 三个 store |
| `src/services/conversation-repository.ts`、`migrate-conversations.ts` | 不存在 | 无持久化适配层 |
| `src/composables/useNarration.ts`、`useSessionLifecycle.ts`、`useOverlayNavigation.ts` | 不存在 | 媒体/生命周期逻辑在 store 与组件里 |
| `src/data/services.ts`、`src/types/service.ts`、`src/types/conversation.ts` | 不存在 | 无事项数据与目标类型 |
| `src/api/feedback.ts`、`src/utils/source-url.ts` | 不存在 | URL 处理散在 `MessageItem.vue:161-166` |
| `src/config/app.ts` | **存在** | 但只做 base URL 兜底，不含 `/api` 根 |
| `src/styles/design-system.css` | **存在** | token 体系与目标配色不同（见 §5.1） |
| `vitest.config.ts`、`src/**/__tests__` | 不存在 | 无前端单测 |
| `server/feedback.mjs`、`server/request-receipts.mjs`、`server/sql/migrations/20261020-chat-feedback.sql` | 不存在 | 无反馈后端 |
| `server/sources-rules.mjs` | **存在** | 只是规则兜底来源生成器，不是 4.4 的统一适配器 |
| `docs/development-baseline-v2.md`、`api-contract-v2.md`、`service-catalog-v2.md`、`releases/v2-handoff.md` | 不存在 | 0.1/0.4/5.1/7.5 的产物 |
| `docs/product-status.md` | **存在** | 内容日期 2026-08-12，数字已过期 |
| `.github/workflows/quality.yml` | 不存在 | `.github/` 仅 `dependabot.yml` |

**计划未覆盖、但仓库存在的额外内容**：

- `src/components/VoiceOrb.vue`（旧语音球），与 4.5 目标组件不一致，需决定复用或删除。
- `src/project-text/exports/` 下 261 个校园通知 JSON（合计约 0.26 MB），**无任何代码引用**（全仓 grep 无 import），属于历史数据残留，建议移出 `src/` 或忽略。
- `mobile-uniapp/src/` 重构（见 §2 D 批）。

---

## 5. 冲突与需要人工决策的点

### 5.1 视觉方向（最高优先级，阻塞 2.1–2.3、6.1）

- 现状：`design-system.css:5-14` 定义 `--paper:#f2eee5`、`--signal:#f04f2f`、`--teal:#0e8c88`，配衬线标题与网格底，是“纸质/编辑部”风格。
- 计划 §1（第 13 行）：以 Figma 深绿版为准，银白背景、主绿 `#005B46`、链接 `#00664F`、浅绿 `#E7F1EC`，“移除原纸张、网格和粗重阴影”（2.1 验收原话）。
- 两者不可兼容：2.1 一旦按计划执行，8-18 的 13 个文件样式会被大面积重写。
- 建议：**按计划执行**（Figma 是已确认需求），但先把 A 批原样提交存档（0.1），不要边改边丢；若想保留纸质风格，则需把计划 §1/2.1 改写并重画 Figma，这会推翻 2.1–2.3 的验收标准。

### 5.2 TTS 共享密钥与“必须登录”

计划 4.5 要求“使用登录会话，不依赖前端共享密钥绕过登录”。现状 `server/tts.mjs:351-361` 仍保留 `TTS_AUTH_TOKEN` bearer 旁路，`src/api/tts.ts:18-20` 仍会下发 `VITE_TTS_AUTH_TOKEN`。二者同时存在时，4.5 的验收无法通过，需要明确：移除旁路（推荐）或限定为仅测试环境。

### 5.3 `mobile-uniapp` 重构

当前 Git 呈现“删除旧路径文件 + 新增 `mobile-uniapp/src/*`（未跟踪）”。计划明确本次不扩展 uni-app。建议单独提交为“chore(mobile): 迁移 uni-app 到 src/”，或 stash，避免与 V2 提交混在一起影响 0.1 的基线可读性。

### 5.4 旧 SQL 与反馈迁移

`server/sql/community-feature-v1.sql:16-19` 含 `DROP TABLE`。7.1 必须新建 `server/sql/migrations/`，且发布流程不得重跑旧初始化；这一点需在 0.4 契约与 7.5 回滚文档里写死。

### 5.5 前端“可信度百分比”

`MessageItem.vue:65-66` 用 `Math.round(source.confidence * 100)%` 展示“可信度”，与计划 4.4“不把检索分数解释为回答正确率”直接冲突。4.4 落地时需同时改文案与字段，不能只加后端字段。

---

## 6. 建议的执行顺序调整

计划 §10 给的顺序（0.1 → 0.3/0.4 → 1.1 → 1.2 → 1.3）方向正确，结合现状建议微调：

1. **先存档，再动工**：0.1 提交 A/B/C 三批改动（分 3 个 commit），D 批单独处理。否则后面每个任务都在一个 38 文件的脏工作区里做，无法审阅 diff。
2. **1.1 + 1.2 合并推进**：前端改 `appConfig` 与 3 个调用点，后端补 `/api` 契约测试与 `/kb/download` 来源改写；Vite 白名单只留 `/api`。这两项加起来不到 1 天，却解锁 2.5、7.3 与整条部署链。
3. **1.3 路由**是第二个瓶颈；做完立刻做 **3.1 → 3.3 → 3.2 → 3.4 → 3.5**。3.5 的“退出即隔离”可先于 3.2 迁移，风险更低。
4. **4.3 的 phase 事件与 start 前移可以与 3.x 并行**（后端独立），因为它是“取消/额度”合同的最后一环，越晚做越会返工前端状态机。
5. **2.x 等 §5.1 决策后再一次性重写**，避免先按纸质改一遍、再按深绿改第二遍。
6. **5.x 的数据（5.1）需要人工核对来源**，可与 2.x 并行起草，不占前端工期。
7. **7.1 的表结构可在 4.3 合同冻结后提前写**（纯 SQL），不用等 Sprint 7。

---

## 7. 本次分析的可信边界

- 已核实：文件是否存在、依赖与脚本、路由注册、测试文件与用例、样式 token、Git 时间线与 diff 规模、RAG 金标实际通过率。
- 未核实（本次未执行）：完整 `lint`/`build`/`type-check`、真实浏览器旅程、真实模型/MySQL/SMTP/TTS、Figma 实际节点、Nginx 配置。
- 后端测试：静态计数为 12 文件 / 31 用例；完整 `npm run test:server` 在本沙箱被阻断（`node --test` 需要 spawn 子进程，报 `EPERM`，属环境限制而非用例失败），因此**不宣称 31/31 通过**；可独立运行的纯单测 `rag-confidence.test.mjs` 已实测 2/2 通过，`rag:test:service` 实测 20/20（top1 100%）。
- 结论只描述“代码里有什么”，不代表功能在目标环境可用；与计划 §0.3 的口径一致。

---

## 8. 本轮验证记录

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm run test:server` | ⛔ 环境阻断（exit 1） | `node --test` 为每个测试文件 spawn 子进程，沙箱返回 `EPERM: spawn`；未得到真实用例结果，**不能当作测试通过或失败** |
| `node server/tests/rag-confidence.test.mjs` | ✅ 2/2 通过 | 该文件不 spawn 子进程，可在进程内直跑；验证 8-20 未提交的 `filterConfidentRagHits` |
| `npm run rag:test:service` | ✅ 20/20，top1 100%，阈值 90% | 金标仍为 20 条，与 §3 的 5.4 结论一致 |

> 说明：要得到完整后端测试结论，需要在**不受沙箱限制的终端**（或 CI）执行 `npm run test:server`；这属于 0.3「固定运行基线」的验收动作。

---

**下一步**：按 [`v2-execution-board.md`](v2-execution-board.md) 领取任务；每个任务完成时在该表的“状态/证据”列标注，不再修改本文。
