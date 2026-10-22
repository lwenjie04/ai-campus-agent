# 数智校答 V2 执行计划表（双 AI 协作）

**版本**：v1.0（2026-10-20 建立）  
**依据**：[`campus-service-v2-development-plan.md`](campus-service-v2-development-plan.md)（39 项任务）、[`v2-gap-analysis.md`](v2-gap-analysis.md)（现状证据）  
**用途**：两个 AI 按表领取任务、并行推进；**完成一项就在本表标注一项**，不再改计划书。

---

## 1. 协作约定（先读这一段）

### 1.1 角色

| 代号 | 职责 | 主要写这些目录 |
| --- | --- | --- |
| **AI-1（前端）** | 路由、页面、状态、交互、样式、前端测试 | `src/**`、`index.html`、`vite.config.ts`（只改 proxy）、前端相关 `docs/**` |
| **AI-2（后端/工程）** | API 合同、服务端行为、迁移、测试、CI、发布脚本 | `server/**`、`.github/**`、`package.json`、根配置 |
| **人工（你）** | Figma 稿、事项数据与来源核对、真实环境凭据、验收签字 | `docs/**` 中数据类文档、环境配置 |

> 跨层任务（4.4、4.5、4.6、6.5、7.4）在表里写“主责 + 配合”，**主责人负责最终验收**，配合方只提交自己那一半。

### 1.2 状态图例

| 符号 | 含义 | 使用规则 |
| --- | --- | --- |
| ⬜ | 未开始 | 默认状态 |
| 🔵 | 进行中 | 领取时改；写明领取人和日期 |
| 🟡 | 部分实现 | 仓库已有可复用代码，但未达验收；**必须写剩余缺口** |
| ✅ | 已完成 | 必须附证据：commit hash + 执行的命令/测试结果，或 `文件:行` |
| ⛔ | 阻塞 | 写明阻塞原因和解除条件；解除后回到 ⬜/🔵 |

### 1.3 领取与标注规则

1. **先领后写**：把该行状态改成 🔵、填上执行者，再动代码；同一行同一时间只允许一个 AI 持有。
2. **一个任务一个提交**：提交信息 `v2(<任务ID>): <一句话>`，例如 `v2(1.1): unify api base url under /api`。
3. **完成即标注**：把状态改 ✅，在“证据”列写 `commit + 验证命令`；**没跑过验证命令不许标 ✅**。
4. **只完成一半**：状态保持 🟡，在“剩余缺口”写清楚还差什么，不要写“基本完成”。
5. **发现新问题**：在 §6 变更日志追加一行，不要私自加任务；确实需要新任务时先和另一个人对齐再加 ID（如 `4.7`）。
6. **共享文件冲突**：`src/App.vue`、`src/main.ts`、`package.json`、`vite.config.ts`、`docs/api-contract-v2.md` 是热点文件，改动前在 §6 记一行“占用”，避免互相覆盖。
7. **门禁**：前端任务完成前跑 `npm run lint` + `npm run type-check`；后端任务跑对应 `node --test <file>`；跨端任务跑 `npm run release:check`（CI 建好后由 CI 兜底）。

### 1.4 当前必须先做的三件事

| 顺序 | 事项 | 谁 | 状态 |
| --- | --- | --- | --- |
| 1 | 确认视觉方向：按 Figma 深绿 `#005B46` 重做 | 人工 | ✅ 2026-10-20 已拍板 |
| 2 | 49 项未提交改动拆批归档，工作区清空 | 人工 + AI-1 | ✅ 已完成，见 `docs/development-baseline-v2.md` |
| 3 | 冻结 `api-contract-v2.md`（路由、取消结算、反馈字段） | AI-2 起草 + 人工签字 | ✅ 2026-10-20 已签字冻结，见任务 0.4 |

---

## 2. 总览

| Sprint | 任务 | ✅ | 🟡 | 🔵 | ⛔ | ⬜ | 当前主攻 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S0 | 4 | 3 | 1 | 0 | 0 | 0 | **0.2 等 Figma 状态稿** |
| S1 | 5 | 5 | 0 | 0 | 0 | 0 | — |
| S2 | 5 | 5 | 0 | 0 | 0 | 0 | — |
| S3 | 5 | 5 | 0 | 0 | 0 | 0 | — |
| S4 | 6 | 6 | 0 | 0 | 0 | 0 | — |
| S5 | 4 | 0 | 0 | 0 | 0 | 4 | 等 5.1 数据 |
| S6 | 5 | 5 | 0 | 0 | 0 | 0 | — |
| S7 | 5 | 2 | 2 | 0 | 0 | 1 | 7.3 等真实 CI run；7.5 等 7.4 收口 |
| **合计** | **39** | **31** | **3** | **0** | **0** | **5** | — |

> 已完成：0.1、0.3、0.4（AI-2）、1.1、1.2（AI-2）、1.3、1.4、1.5、2.1、2.2、2.3、2.4、2.5、3.1、3.2、3.3、3.4、3.5、4.1、4.2、4.3、4.4、4.5、4.6、6.1、6.2、6.3、6.4、6.5、7.1、7.2。**S1/S2/S3/S4/S6 已全部完成**；0.2 等 Figma 状态稿，5.x 等人工数据；7.3 的 CI 骨架与本地检查已交付，等待 push/PR 全绿及 5.4 Top 50 数据；7.5 的 7.4 前置文档准备已完成，真实环境验收与试用记录仍待人工环境。实时状态以本表为准。

---

## 3. 任务板

### Sprint 0：固定基线（1–2 天）

| ID | 任务 | 主责 | 状态 | 依赖 | 完成判定 / 证据 |
| --- | --- | --- | --- | --- | --- |
| 0.1 | 固定当前工作基线 | 人工 + AI-1 | ✅ | 无 | 49 项改动已分 5 批提交（`4af3c89`、`61756be`、`364b6b8`、`46d754d`、`73f4d21`）；`docs/development-baseline-v2.md` 记录归属与恢复方式 |
| 0.2 | 补齐 Figma 页面与状态 | 人工 | 🟡 | 0.1 | 登录/注册、历史、来源、讲解、账号、搜索、事项列表/详情、社区/后台各状态的稿件齐全；交互说明已存在但不可替代稿件 |
| 0.3 | 固定运行与依赖基线 | AI-2 | ✅ | 0.1 | `9898e7b` 更新 `docs/development-baseline-v2.md`；2026-10-21 实测 `npm run test:server` 56/56、`npm run test:unit` 90/90；`npm run service:journey` 10/10（9.6s，isolated mock，证据 `server/evals/latest-service-journey.json`，执行 `5dda2a6`、登记 `8d060c2`）；Node v23.11.0 / npm 10.9.2。目标环境真实服务仍按 7.4 验证。 |
| 0.4 | 定义状态、API 与开放顺序 | AI-2（起草）+ 人工（签字） | ✅ | 0.1 | `api-contract-v2.md` 经人工签字冻结；提交 `de0f47c`。验证：`git diff --cached --check` 通过；`git show --check --stat HEAD` 未发现空白错误。 |

### Sprint 1：API 隔离与路由（2–3 天）

| ID | 任务 | 主责 | 状态 | 依赖 | 完成判定 / 证据 |
| --- | --- | --- | --- | --- | --- |
| 1.1 | 统一前端 API 地址构造 | AI-1 | ✅ | 0.4 | `src/config/app.ts` 新增 `apiUrl()`，默认根 `/api`、origin 自动补 `/api`、绝对根透传；`llm/tts/auth/community`、`MessageItem`、`AdminReviewView` 全部改走它。证据：`npm run type-check` 通过；curl 实测 `/api/health`、`/api/community/posts` 200 |
| 1.2 | 迁移代理与来源路径 | AI-2（主）+ AI-1 | ✅ | 1.1 | 原有代理与页面路由验收保留。提交 `a9548ff`；`node --test server/tests/api-aliases.test.mjs` 1/1 通过；`npm run build` 通过（1609 模块）；`node server/scripts/check-api-preview.mjs` 通过：`/chat/new` HTML、问答 NDJSON、下载 401/403、代理登录 200；`git diff --cached --check` 通过。 |
| 1.3 | 引入 vue-router 并拆页面壳 | AI-1 | ✅ | 1.2 | `src/router/index.ts` + `RouterView` 页面壳；路由 `/`、`/chat`、`/chat/new`、`/community`、`/community/posts/:postId`、`/admin/review`、`/admin/retrieval`、404；懒加载拆分。证据：`777a7c7`；type-check/lint/build 通过；preview 冒烟见 1.2 |
| 1.4 | 权限、初始访问与返回 | AI-1 | ✅ | 1.3 | 未登录 → `/?login=1&redirect=…`（保留登录意图）；已登录非管理员 → `/403?from=…`（不再静默回首页）；`safeInternalPath` 只接受站内绝对路径；403 页无返回历史时回落首页；三视角直接访问矩阵覆盖。证据：`63ae7d2`；`npm run test:unit` 55/55；`npm run lint` 0 error；`npm run type-check` 通过 |
| 1.5 | 建立前端测试入口 | AI-1 | ✅ | 1.3 | `vitest 3.2.7` + `jsdom` + `@vue/test-utils`；`vitest.config.ts` 与 `test:unit`（threads pool）；守卫测试复用生产路由 meta、组件打桩。证据：`8c345de`；`npm run test:unit` 4 文件 / 22 用例通过。**注意**：`release:check` 尚未纳入 `test:unit`（转 7.3） |

### Sprint 2：视觉与问答主页（3–4 天）

| ID | 任务 | 主责 | 状态 | 依赖 | 完成判定 / 证据 |
| --- | --- | --- | --- | --- | --- |
| 2.1 | 落地颜色/字体/间距/图标 | AI-1 | ✅ | 0.2、1.3、**视觉决策** | 设计包已入库：`71dcb6b`（`docs/design/`，Figma 导出非截图）。`f511dde`：银白/深绿 token（`#F5F5F7`/`#1D1D1F`/`#005B46`/`#00664F`/`#E7F1EC`/`#D2D2D7`）、Noto Sans SC、去除页面网格/径向光晕/纸张底/黄色渐变/粗重偏移阴影、绿色胶囊按钮与输入框焦点环；SVG 已入 `public/icons` 并去掉导出背景。证据：65 单测/type-check/lint/build 通过；1440 截图 `docs/design/verify/home-1440.png`。**注**：页面布局仍是旧结构，由 2.2/2.3 替换 |
| 2.2 | 首页与公共导航 | AI-1 | ✅ | 2.1 | `HomeView.vue` 独立：Figma hero、静态产品预览、四张常办事项卡、页脚；公共导航含问答/社区/办事指南/关于校答 + 登录；`HelpPanel` 说明面板可开；`/services` 先提供真实空态，不伪造未建数据；开始提问只进 `/chat/new` 并聚焦输入框，不发送、不建空历史。登录/注册弹窗按 `22:35` 重做：账号标题、登录/注册页签、绿色全宽主按钮、内联错误与关闭按钮（`22f176e`，截图 `docs/design/verify/login-1440.png`、`login-390.png`）。证据：`e5ba122`；`npm run home:journey` **6/6**（`server/evals/latest-home-flow.json`）；1440/390 截图 `docs/design/verify/home-new-*.png`；65 单测/type-check/lint/build 通过 |
| 2.3 | 响应式问答布局 | AI-1 | ✅ | 2.1 | `53a6144`：阅读列 720px + 桌面来源栏 276px；页头历史/来源/新建对话；用户右侧气泡、校答阅读式回答、复制/朗读；`SourceCard` 统一来源卡；手机“查看 N 份官方来源”面板；来源绑定最近回答 ID；长回答/多来源不挤掉固定输入区。证据：`npm run chat:layout` **5/5**（`server/evals/latest-chat-layout.json`）；截图 `docs/design/verify/chat-answer-1440.png`、`chat-sources-390.png`；70 单测/type-check/lint/build 通过 |
| 2.4 | 输入与推荐问题 | AI-1 | ✅ | 2.3 | `1c7a306`：`InputBox` 改自动增高 textarea；IME 组合期 Enter 不发送、Enter 发送、Shift+Enter 换行；空值与 800ms 内重复提交拦截、空文本禁用发送；推荐问题按上条回答关键词生成，只预填并聚焦；`/chat/new` 草稿单独落键并在刷新后恢复。证据：`npm run chat:layout` **10/10**（含 IME/Shift+Enter/空值/草稿恢复），`server/evals/latest-chat-layout.json`；截图 `docs/design/verify/chat-suggestions-1440.png`；70 单测/type-check/lint/build 通过 |
| 2.5 | 连接问答并验证手机布局 | AI-1（主）+ AI-2（脚本矩阵） | ✅ | 2.3、2.4 | `e793745`：`inspect-responsive-layout` 支持宽度矩阵、逐宽度截图、溢出与关键控件可见性检查；`responsive:matrix` 覆盖首页与问答页 **360/390/768/1024/1440 共 10 组，0 溢出、CTA/发送按钮可见**；`chat:stream` 打真实后端 NDJSON `/api/chat/stream`（mock provider），桌面 1440 与手机 390 均 status=200 并收到流式回答。证据：`server/evals/latest-responsive-matrix.json`、`latest-chat-stream.json`、`docs/design/verify/responsive/*.png`、`chat-stream-*.png`；70 单测/type-check/lint/build 通过 |

### Sprint 3：多会话与登录恢复（3–4 天）

| ID | 任务 | 主责 | 状态 | 依赖 | 完成判定 / 证据 |
| --- | --- | --- | --- | --- | --- |
| 3.1 | 会话数据模型与存储适配 | AI-1 | ✅ | 1.5、2.5 | `src/types/conversation.ts`、`src/services/conversation-repository.ts`、`src/store/conversations.ts`、`src/utils/id.ts`。证据：`35ae6b8`；13 个会话用例覆盖空对话不入历史、回答+草稿恢复、`generating→interrupted` 落盘、容量/配额/不可用降级；type-check/lint/build 通过。**注**：2.5 属 UI 联调，数据层未依赖；`storageError` 已由 store 暴露，用户可见提示随 3.3 的界面接入 |
| 3.2 | 迁移旧单会话缓存 | AI-1 | ✅ | 3.1 | `src/services/migrate-conversations.ts`：`session.v2` → 一条 `legacy:pending` 历史；原 key 保留；稳定 conversationId 保证幂等；pending → interrupted。证据：`b9b278a`；7 个迁移用例 + store 集成；`npm run test:unit` 30/30；type-check/lint 通过 |
| 3.3 | 新建、历史与路由恢复 | AI-1 | ✅ | 3.1、3.2 | `/chat/:conversationId`、`HistoryDrawer`、消息↔会话映射、首次发送后 `replace`、按 ID 恢复消息与草稿、无效/越权 ID 提示并回落、跨标签页只刷新列表。浏览器回归：`npm run conversation:journey` **8/8 通过**（登录→两轮问答→刷新恢复→历史切换→草稿恢复→无效 ID→后退），证据 `server/evals/latest-conversation-journey.json`。提交：`3c12a46`、`153e61c`；55 个单测 + type-check/lint/build 通过 |
| 3.4 | 统一登录后待执行动作 | AI-1 | ✅ | 1.4、3.3 | `auth-intent` store：`intentId/type/target/createdAt/consumedAt` + 24h TTL；守卫登记 `open-post`/`enter-admin`，问答页登记 `send-question`；登录消费一次，取消保留草稿+意图，刷新只显示确认条。浏览器回归：`npm run auth-intent:journey` **5/5**（游客第二问→取消→登录只补发一次→刷新不重复），并修复 `chat-detail` 路由未绑定 `require-login` 的缺陷。证据：`f3920b8`；65 个单测、lint、type-check、build 通过 |
| 3.5 | 账号隔离与生命周期 | AI-1 | ✅ | 3.3、3.4 | `useSessionLifecycle`：登录只接纳当前这条有内容的游客会话、退出停媒体并清空界面再切回 guest、管理员登录不跳后台；`pending-question` 24h TTL 抽成服务。证据：`91b22cb`；42 个单测（新增 7 个隔离/迁移 + 5 个 TTL）通过；type-check/lint/build 通过 |

### Sprint 4：生命周期、来源与语音（4–6 天）

| ID | 任务 | 主责 | 状态 | 依赖 | 完成判定 / 证据 |
| --- | --- | --- | --- | --- | --- |
| 4.1 | 前端请求身份与取消 | AI-1 | ✅ | 3.5 | `streamChat(..., signal)`（fetch + Mock 均响应取消）；`activeRun` 绑定 `ownerScope/conversationId/assistantMessageId/runId`，迟到回调校验失败即丢弃；停止/切会话/刷新保留文本并标 `interrupted`；重试复用原问题与回答位置。证据：`0c5a877`；`npm run test:unit` 49/49（新增 7）；type-check/lint/build 通过 |
| 4.2 | 取消传递到检索与模型 | AI-2 | ✅ | 4.1（按人工决定可先行） | `ab5455b`；`npm run test:server` 36/36；`npm run server:check` 53 模块通过；定向 ESLint 通过。req/res/socket 断开与超时信号合并；LightRAG、向量检索和模型流接收取消信号；首段前回滚、断开且首段后结算；正常 finish 不报中断；四个边界测试通过 |
| 4.3 | 阶段事件与额度结算 | AI-2 | ✅ | 4.2、0.4 | `4623976`；`npm run test:server` 37/37；`npm run server:check` 55 模块通过；定向 ESLint、`git diff --check` 通过。`start` 在检索前；发出真实 retrieval/generation phase；正常完成与断开竞态只结算一次 |
| 4.4 | 来源元数据统一适配 | AI-2（主）+ AI-1（类型/展示） | ✅ | 1.2；展示依赖 2.3 | 服务端 `6112c0b`（45/45、60 模块）。前端 `53a6144`：`MessageSource` 对齐 `sourceId/type/attachments.mimeType/publishedAt/updatedAt/applicablePeriod/validity` 并删除 `confidence`；`source-display.ts` 统一类型/日期/时效文案，缺失日期显示“日期未提供”；`SourceCard` 展示类型、时效、日期、摘要、附件与原文链接；Mock 来源同步新结构。5 个 source-display 单测；70 单测/type-check/lint/build 通过 |
| 4.5 | 按需语音控制 | AI-1（主）+ AI-2（服务端去密钥） | ✅ | 3.4、4.1 | 服务端 `f620cde`：旧共享密钥不能通过鉴权（45/45）。前端 `7a06d04` 去 `VITE_TTS_AUTH_TOKEN`；`53a6144` 默认不自动 TTS、语音卡显式开关；`5c17697`：单队列 + token 校验丢弃晚到分段/过期请求、ObjectURL 在结束/停止时释放、移动端 `NotAllowedError` 只提示一次并引导再点、游客点语音先登录并在登录后恢复朗读；文本清洗/分段抽到 `narration-text`（4 单测）。证据：`chat:layout` **11/11**（含游客语音先登录）、74 单测/type-check/lint/build 通过。真实 TTS 合成需目标环境凭据，留 7.4 验证 |
| 4.6 | 生成/来源/媒体联测 | 共同（AI-1 主导） | ✅ | 4.3、4.4、4.5 | `regression:journey` **8/8**（真实后端 mock）：管理员登录；生成中刷新→interrupted→重试恢复；跨会话晚到未串入；来源栏绑定当前回答；TTS 失败提示；移动端自动播放拦截提示；过期登录隔离（清 Cookie/本地态后回 `/chat/new` 且无用户消息泄漏）。证据：`server/evals/latest-regression-journey.json`、`docs/design/verify/regression-interrupted-1440.png`；74 单测/type-check/lint 通过 |

### Sprint 5：办事指南（2–3 天）

| ID | 任务 | 主责 | 状态 | 依赖 | 完成判定 / 证据 |
| --- | --- | --- | --- | --- | --- |
| 5.1 | 事项清单 | 人工（数据）+ AI-1（落地） | ⬜ | 0.4、4.4 | ≥12 条、四类各 ≥3；稳定 ID/标题/关键词/用途/提问模板/已核对来源/核对日期；无可靠链接不显示办理入口 |
| 5.2 | 指南列表与详情 | AI-1 | ⬜ | 5.1、2.1 | 分类/关键词/详情/空态/不存在；筛选入 URL；返回保留列表状态；首页四卡与加号到正确分类 |
| 5.3 | 事项搜索与提问桥接 | AI-1 | ⬜ | 5.2、3.4 | 只搜标题与关键词；无结果保留搜索词并可转问；预填后不自动请求模型；刷新不重复发送 |
| 5.4 | 目录与金标核对 | AI-2（评估集）+ 人工（核对） | ⬜ | 5.3 | 金标 20→50（教务15/考试10/奖助15/生活10）+ ≥10 负例；每个事项至少一条可回答问题；缺口如实记录 |

### Sprint 6：社区与知识运营（3–4 天）

| ID | 任务 | 主责 | 状态 | 依赖 | 完成判定 / 证据 |
| --- | --- | --- | --- | --- | --- |
| 6.1 | 社区列表/帖子适配 | AI-1 | ✅ | 2.1、3.4 | `a89af55`：列表按银白/深绿重做，`q/category/sort/page` 全部入 URL，越界页码回落，返回时恢复筛选与滚动；详情先清空上一帖再加载，无效 ID 显示空态，切帖按路由 ID 重新加载；问答原帖入口沿用既有守卫。证据：`community-query` 4 单测；`npm run community:journey` **7/7**（`server/evals/latest-community-journey.json`，截图 `community-list-1440.png`/`community-detail-1440.png`）；86 单测/type-check/lint/build 通过 |
| 6.2 | 投稿/回复/草稿 | AI-1 | ✅ | 6.1、3.5 | `e7b8c1a`：`community-draft` 按 ownerScope 隔离（游客/用户、回复按帖子 ID）；投稿与回复取消/刷新保留，显式“清空草稿”或提交成功才删除；`submitting` + 3 秒同负载去重阻止重复提交；待审核提示与“已提交但刷新失败”独立提示；切帖清空旧回复草稿状态。证据：4 个草稿单测；`community:journey` **13/13**（含草稿恢复/清空、POST 请求数=1 的防重复校验，`server/evals/latest-community-journey.json`）；90 单测/type-check/lint/build 通过 |
| 6.3 | 后台路由与界面 | AI-1 | ✅ | 1.4、2.1 | `d098593`：`/admin/review` 与 `/admin/retrieval` 页签双向同步，刷新保持；审核/检索面板复用现有队列与 LightRAG 状态接口；银白/深绿视觉与响应式统计、队列、状态卡；手机 390 可审核、0 溢出；未登录直达回首页且后台接口返回 401。证据：`npm run admin:journey` **7/7**（`server/evals/latest-admin-journey.json`；截图 `admin-review-1440.png`、`admin-retrieval-1440.png`、`admin-review-390.png`）；90 单测/type-check/lint/build 通过 |
| 6.4 | 审核状态与部分失败 | AI-2 + AI-1 | ✅ | 6.2、6.3 | 后端 `f065ba2`：`test:server` 56/56、定向 12/12；契约 §12。前端 `271e3e1`：结构化社区 API 错误、拒绝二次确认、行级 loading、通过+生成部分失败独立面板与“只重试生成”；`admin:journey` 11/11（approve=1/generate=2）。**隔离 MySQL 实测**：本地 MySQL8 新建 `ai_campus_agent_test_64`，应用建表后执行 9 项真实事务校验（通过/拒绝幂等与相反终态 409、并发 approve/reject 单次、回复状态机、未审核生成拒绝、生成幂等、三次并发生成同一 knowledgeId 且仅一行、`post_id` 唯一键 ER_DUP_ENTRY），全部通过后删除 schema，未写默认库；证据 `server/evals/latest-mysql-review-validation.json`。剩余（不阻塞 6.4）：可复跑 MySQL 测试待 7.3 纳入 CI。90 单测/type-check/lint/build 通过 |
| 6.5 | 后台与社区闭环验证 | 共同 | ✅ | 6.4、4.4 | `5ddd69c`：新增 `closed-loop:journey` **9/9**：注入 generate 失败→部分失败面板→只重试生成（approve=1/generate=2）→审核知识→问答返回**社区经验**来源→来源回链 `/community/posts/:id`；普通账号后台路由 `/403` 且 API 403；LightRAG 未配置时检索页显示“未连接”且问答走关键词降级；后端以 `MYSQL_PORT=1` 内存模式运行，正式数据不被写入。顺带修复 `App.vue` 对 AgentChat camelCase `openCommunityPost` 的 v-on 绑定（此前来源“查看来源帖子”点击无反应）。证据：`server/evals/latest-closed-loop-journey.json`；截图 `closed-loop-source-1440.png`、`closed-loop-partial-failure-1440.png`、`closed-loop-retrieval-1440.png`、`closed-loop-forbidden-1440.png`；90 单测/type-check/lint/build 通过 |

### Sprint 7：反馈与发布（3–4 天）

| ID | 任务 | 主责 | 状态 | 依赖 | 完成判定 / 证据 |
| --- | --- | --- | --- | --- | --- |
| 7.1 | 请求凭据与反馈增量表 | AI-2 | ✅ | 4.3、0.4 | `4bd44ac`；`npm run test:server` 41/41；`npm run server:check` 58 模块；定向 ESLint、`git diff --check` 通过；MySQL 8.0.39 隔离测试库实测迁移、凭据读回、反馈 upsert/更新、主体隔离与唯一行数=1 |
| 7.2 | 反馈接口与操作 | AI-2（接口）+ AI-1（组件） | ✅ | 7.1、3.4 | 服务端 `8840b43`（47/47）。前端 `9335cee`：消费 `meta.feedbackEligible` 并随消息持久化；`MessageActions.vue` 仅在 eligible 时显示，提交 `requestId + helpful/none`；409 不可反馈、401 需登录、429 带 `Retry-After` 秒数可重试、503 可重试；成功后写回 `feedback` 并持久化。证据：新增 8 单测（`feedback.test.ts` + `MessageActions.test.ts`），82 单测/type-check/lint/build 通过；`regression:journey` **9/9** 含真实反馈提交，`server/evals/latest-regression-journey.json`、`docs/design/verify/regression-feedback-1440.png` |
| 7.3 | CI 与可重复门禁 | AI-2 | 🟡 | 1.5、4.6、5.4、6.5、7.2 | `574359c`：新增 browser-journeys（8 条串行旅程、随机隔离凭据、结果/artifact）、独立 10 轮 service journey、Top 20 offline golden、MySQL 8 隔离 service/审核事务测试；更新 `docs/ci-quality-gates-v2.md`。CI 本地与远端验证通过（远端：[run 39713334922](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39713334922)、[run 39714486081](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39714486081)，五个 job 全绿）。新增默认关闭的 production CD workflow、SSH 原子发布/回滚脚本和带 releaseId 的健康检查；说明见 `docs/cicd-deployment-setup.md`。**剩余**：5.4 Top 50 金标完成后接入并复验；提供并配置 production 主机、密钥、共享 `server.env`、Nginx 与公网 health URL，完成 7.4 目标环境验收后才启用 CD。CI 不设置 `RELEASE_LIVE_VALIDATION_CONFIRMED`。 |
| 7.4 | 目标环境验证与性能 | 共同 | ⬜ | 7.3 | 真模型/MySQL/SMTP/TTS/HTTPS/反代实测并留证；50 条金标；首字/总耗时/取消耗时/资源体积；`RELEASE_LIVE_VALIDATION_CONFIRMED` 不得伪造 |
| 7.5 | 交付、回滚与试用记录 | 人工 + AI-2 | 🟡 | 7.4 | 前置准备 `4f8dd90`：新建 `docs/releases/v2-handoff.md`、`docs/releases/v2-trial-record.md`，更新 `docs/product-status.md`、`docs/release-checklist.md` 和基线风险项；Prettier、相对链接检查、`git diff --check` 通过。**剩余**：7.4 目标环境验收后补真实版本/tag/commit、部署与回滚演练证据，人工试用后填记录与结论；未验证字段保持空白。 |

---

## 4. 并行泳道建议

```text
第 1 周   AI-1: 0.1 盘点 → 1.1 → 1.3 骨架
          AI-2: 0.4 契约 → 1.2（后端别名测试 + 来源 URL）→ 4.3 phase 设计
          人工: 视觉决策 + Figma 补稿（0.2）

第 2 周   AI-1: 3.1 → 3.3 → 3.4 → 3.5
          AI-2: 4.3 phase 实现 → 4.2 取消（等 4.1 接口）→ 7.1 表结构

第 3 周   AI-1: 2.1 → 2.2 → 2.3 → 2.4（视觉决策后一次性重写）
          AI-2: 4.4 适配器 → 6.4 状态校验 → 4.2 测试

第 4 周   AI-1: 4.1 → 4.5 → 5.2/5.3
          AI-2: 7.2 → 7.3 CI

第 5 周   AI-1: 6.1/6.2/6.3；AI-2: 5.4 金标 + 4.6 联测；7.4/7.5 收尾
```

> 泳道是默认建议，不是排期承诺；实际以 §1.3 的领取为准。

---

## 5. 决策与阻塞登记

| 编号 | 事项 | 影响任务 | 状态 | 需要谁 |
| --- | --- | --- | --- | --- |
| D-1 | 视觉方向：Figma 深绿 vs 现有纸质/橙绿 | 2.1–2.3、6.1、6.3 | ✅ 已决定：按 Figma 深绿 `#005B46` 重做 | 人工 |
| D-2 | 8-18 前端 WIP 是提交存档还是丢弃 | 0.1、全部后续 diff | ✅ 已决定：提交存档（`61756be`），2.1 时再替换 | 人工 |
| D-3 | `TTS_AUTH_TOKEN` 共享密钥是否删除 | 4.5、7.4 | ✅ 已决定：移除共享密钥，TTS 统一使用登录会话鉴权 | 人工 |
| D-4 | `mobile-uniapp/src` 迁移是否单独提交 | 0.1、仓库整洁 | ✅ 已单独提交 `4af3c89` | 人工 |
| D-5 | `src/project-text/exports/` 261 个 JSON（0.26 MB）是否移出 | 仓库整洁 | ⬜ 未处理 | 人工 |
| D-6 | **4.1 依赖已解除**：3.1/3.2/3.5 ✅，3.3 代码就绪（仅差浏览器回归）；4.1 可开工，回归与 4.1 浏览器验证合并做 | 4.1、4.2、4.5 | ✅ 已解除 | AI-1 做 4.1 |
| D-7 | **4.2 启动条件**：4.1 已 ✅（`0c5a877`），服务端断开取消可开始 | 4.2、4.3 | ✅ 已解除 | AI-2 开始 4.2 |
| D-8 | **6.4 事务实测环境**：6.4 已用本地 MySQL8 的独立 schema `ai_campus_agent_test_64` 完成真实事务验证并删除，未写默认库 | 6.4、6.5、7.3、7.4 | ✅ 已验证并清理；可复跑测试留 7.3 | AI-1 代跑，Codex 纳入 CI |

### 5.1 4.1 → 4.2 交接条件（AI-1 → AI-2）

4.1 只有在以下条件全部满足时才允许标 ✅，AI-2 据此开始 4.2：

1. `streamChat()` 接受 `AbortSignal` 并传给 `/api/chat/stream` 的 fetch；Mock 模式同样可中断。
2. 每次运行绑定 `ownerScope + conversationId + assistantMessageId + runId`；迟到回调校验失败必须丢弃。
3. 停止、切会话、刷新：保留已生成文本并标 `interrupted`；刷新不自动重发。
4. 重试复用原问题与回答位置，不重复追加 user 消息。
5. `npm run test:unit` 覆盖第 1–4 条；`type-check` / `lint` 通过。

交接产物：4.1 的 commit hash + 计划表中该行证据。4.2 的验收仍以服务端为准：断开后取消上游、只结算一次、正常结束不误报中断。

**状态：已于 2026-10-20 满足（`0c5a877`，49 个单测），AI-2 可开始 4.2。**

### 5.2 6.4 审核状态与部分失败交接条件（AI-1 前端 → AI-2 后端）

6.3（`d098593`）与 6.2（`e7b8c1a`）已完成，6.4 依赖解除，AI-2 可认领。交接时以本节为验收清单。

**现状盘点（已存在的部分）**

1. 审核/检索双路由、队列与状态接口复用、手机可审核、非管理员 401/403 边界已由 6.3 验证。
2. 审核接口已存在：`POST /api/community/review/posts/:id/approve|reject`、`.../replies/:id/approve|reject`；知识生成 `POST /api/community/knowledge/generate`。
3. 知识生成已按 `post_id` 查找并更新已有条目，但并发下仍可能插入多行。

**当前缺口（交接重点）**

1. `updatePostStatusInMySql` / `updateReplyStatusInMySql` 先按 id 查询、再无条件 `UPDATE`，没有 `WHERE status='pending'`，已审核项可被再次改写（`server/community.mjs:855-984`）。
2. 内存兜底 `updatePostStatus` / `updateReplyStatus` 同样不校验当前状态（`server/community.mjs:895-919`）。
3. 前端 `approveAndBuild` 串行调用“通过→生成”，生成失败时只弹一条泛化错误，没有“帖子已通过、只重试生成”的状态（`AdminReviewView.vue`）。
4. 拒绝目前无二次确认。
5. 重复点击“通过并生成”可能在并发下产生多个知识草稿。

**AI-2 后端清单**

1. 状态机：只允许 `pending → approved` / `pending → rejected`；SQL 改为原子 `UPDATE ... WHERE id = ? AND status = 'pending'`，`affectedRows = 0` 时按“当前状态”返回：
   - 已处于目标状态 → `200` 幂等成功，不重复写 review log；
   - 已处于相反状态 → `409 REVIEW_STATE_CONFLICT`（错误码需补进 `docs/api-contract-v2.md` §7）。
2. 内存兜底实现同样的状态校验与错误码，保证测试与 MySQL 行为一致。
3. 并发/重复点击：同一帖子只允许一次真实状态变更；review log 只在真实转换时写一次；approve+reject 竞态只能一个成功。
4. 通过 + 生成分步语义：
   - `approve` 与 `generate` 保持两个接口；
   - `generate` 失败时返回结构化错误，至少带 `code`、`retryable`、`postStatus`（已通过）与 `knowledgeId?`，让前端能显示“帖子已通过，知识生成失败”并只重试生成；
   - 重复 `generate` 必须返回同一 `knowledgeId`，不得新增第二行（`community_knowledge` 对 `post_id` 的唯一约束/事务）。
5. 测试（`server/tests/` 新增或扩展，内存路径 + 可用时 MySQL）：
   - 通过/拒绝 pending；已通过再通过幂等；已通过再拒绝 409；
   - approve+reject 并发只一次生效、日志一条；
   - generate 成功 / 失败重试 / 连续点击三次只一行；
   - 未审核帖子 generate 被拒绝；
   - 非管理员接口 401/403。
6. 契约与交付：如需新错误码/字段，先改 `docs/api-contract-v2.md` 并由 AI-2 负责；提交信息 `v2(6.4): ...`；计划表 6.4 行写 `test:server` 数量、定向测试名与 commit。

**AI-1 前端清单（AI-2 契约冻结后接续）**

1. 拒绝加二次确认（`ElMessageBox.confirm`，取消不发请求）。
2. 部分失败 UI：帖子已通过但知识生成失败时显示独立状态与“只重试生成”按钮，不重复调用 approve。
3. 按钮按行级 loading，避免全局 `submitting` 导致误判与其他行不可操作。
4. `admin:journey` 扩展：拒绝确认取消/确认、生成失败一次后只重试成功、重复点击只产生一次 POST。

**6.5 联测入口（6.4 完成后）**

覆盖失败重试、来源返回、普通账号越权、LightRAG 未配置、正式数据不被 Mock 旅程写入；由 AI-1 主导脚本，AI-2 配合服务端断言。

**交接产物**：AI-2 的 6.4 commit + 计划表证据 + 契约 diff；AI-1 在收到契约定稿后再改 `AdminReviewView.vue`。

### 5.3 7.3 CI 与可重复门禁交接（AI-2 主责，可在 5.4 前先做）

**当前现状**

- `.github/workflows/quality.yml` 已跑 `lint`、`type-check`、`test:unit`、`test:server`、`build`；`release:check` 已含单测。
- 4.6/6.5/7.2 均已完成，6.5 新增 `closed-loop:journey`；5.4（Top 50 金标）仍等人工数据。
- 现有浏览器旅程都是“单脚本 + 外部已启动后端/preview”，只有 `service:journey` 自带编排。
- 6.4 的真实 MySQL 校验目前是临时脚本，未入库；7.3 需要把它变成可复跑测试。

**AI-2 清单（建议按顺序）**

1. **新增 `browser-journeys` job**（ubuntu-latest，超时 ≤30 分钟）：
   - 安装 Chrome/Chromium 并显式设置 `CHROME_PATH`，不依赖 runner 预装；
   - 只构建一次 `npm run build`；启动后端 `node server/index.mjs` 与 `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4176 --strictPort`，等待 `/health` 与 preview 就绪；
   - 结束后关闭两个子进程；失败时上传 `server/evals/*.json` 与 `docs/design/verify/**` 作为 artifacts。
2. **统一测试环境变量**（全部 mock、内存、无真实密钥）：
   - `MYSQL_PORT=1`、`AUTH_ALLOW_MEMORY_FALLBACK=true`、`LLM_PROVIDER_MODE=mock`、`LIGHTRAG_PRIMARY=false`、`RAG_VECTOR_ENABLED=false`、`TTS_PROVIDER=disabled`、`FEEDBACK_TEST_MEMORY=true`；
   - `CORS_ORIGIN=http://127.0.0.1:4176`；随机 `AUTH_SESSION_SECRET` / `GUEST_COOKIE_SECRET`；`AUTH_DEFAULT_ADMIN_USERNAME/PASSWORD` 与 `JOURNEY_ADMIN_ACCOUNT/PASSWORD` 一致且每次随机。
3. **串行运行并断言结果 JSON**：
   | 命令 | 目标 env | 证据 |
   | --- | --- | --- |
   | `npm run admin:journey` | `ADMIN_TARGET_URL=http://127.0.0.1:4176` | `latest-admin-journey.json` |
   | `npm run community:journey` | `COMMUNITY_TARGET_URL=...4176` | `latest-community-journey.json` |
   | `npm run regression:journey` | `REGRESSION_TARGET_URL=...4176` | `latest-regression-journey.json` |
   | `npm run closed-loop:journey` | `CLOSED_LOOP_TARGET_URL=...4176`、同 secret | `latest-closed-loop-journey.json` |
   | `npm run home:journey` / `chat:layout` / `chat:stream` / `responsive:matrix` | 各自 `*_TARGET_URL` / `RESPONSIVE_BASE_URL=...4176` | 对应 JSON |
   - 每个脚本检查退出码，并校验 `ok === true` 与关键断言字段（如社区来源、POST=1、status=403）。
4. **`service:journey` 单独 job 或最后串行执行**（它自建 3000/4173 并 `build`）；断言 `passedRounds>=10`、`communityClosureVerified`、`pendingQuestionRecoveryVerified`。
5. **Golden job**：`npm run kb:prepare:offline` 后跑 `npm run rag:test:service`，先锁 **Top 20**；Top 50 在 5.4 数据到位后再扩，不要用假数据凑 50。若离线向量索引生成不稳定，把该 job 标为 `continue-on-error: false` 并先修可重复性，禁止跳过。
6. **MySQL 模式测试**：把 6.4 的临时校验固化为仓库内测试/脚本（可新建 `server/tests/community-review-mysql.test.mjs` 或 `verify-community-mysql.mjs`）；CI 用 `mysql:8.0` service、在一次性的 `ai_campus_agent_ci` 库建表后运行；校验状态机 409、并发单次、生成幂等/唯一键；结束后删库或丢弃容器。禁止跑旧含 `DROP TABLE` 的 SQL 到共享库。
7. **文档**：更新 `docs/ci-quality-gates-v2.md`（新 job、Chrome、环境变量、artifacts、Top 20/50 边界、耗时）；说明 CI 仍不直接跑 `release:check` 的原因或已改为分步；写明 `RELEASE_LIVE_VALIDATION_CONFIRMED` 只属于 7.4，CI 不设置。
8. **验收**：push/PR 上 workflow 全绿；任一旅程失败会 fail job；无密钥/真实数据依赖；单 job ≤30 分钟；计划表 7.3 证据含 workflow run URL、命令、artifacts 名单与仍受 5.4 限制的说明。
9. **禁止**：把失败步骤改成 `continue-on-error`、伪造 evidence、在 CI 连接开发者 MySQL/真实模型。

**阻塞**：Top 50 金标与 5.4 数据；浏览器旅程本身不阻塞。5.4 未完成前 7.3 可保持 🟡，但 CI 骨架与已可用旅程必须全绿。

### 5.4 7.5 交付、回滚与试用记录交接（人工 + AI-2，7.4 后收口）

**当前现状**

- 2026-10-21 已完成 7.4 前准备，提交 `4f8dd90`：新增 handoff 草案和试用模板，更新产品状态、release checklist 与基线风险。版本/tag 与目标服务器保持待定，未填造试用数据。
- `docs/releases/v2-handoff.md` 已列构建、迁移、环境变量、部署、回滚步骤；`docs/release-checklist.md` 已对齐现有发布脚本。真实环境与回滚演练证据仍缺。
- 7.4 的目标环境（真模型/MySQL/SMTP/TTS/HTTPS/反代）未完成，7.5 不得提前标 ✅。

**7.4 前置准备已完成（AI-2）**

1. 新建 `docs/releases/v2-handoff.md`，至少包含：
   - 发布标识：分支、commit、tag（建议 `v2.0.0`）、日期、运行环境；
   - 构建清单：`npm ci`、`npm run build`、`dist/` 产物；Node/依赖版本；不提交 `dist` 到仓库时给出生成命令与校验和；
   - 迁移清单与顺序：`auth-users.sql` → `community-feature-v1.sql`（只允许在全新/可清空库执行其 DROP）→ `migrations/20261020-chat-feedback.sql`；已有数据环境只跑增量，禁止重跑删表 SQL；
   - 环境变量表：模型/MySQL/SMTP/TTS/会话/CORS/功能开关，只写变量名与用途，不写密钥值；
   - 部署步骤：后端进程守护、preview/静态、Nginx `/api` 与 SSE 代理、HTTPS、健康检查；
   - 回滚步骤：保留上一版 git commit/构建产物；应用回滚不动新增表（兼容旧版本），数据库先备份；给出回滚命令、验证 `/health`、首页、问答与审核路径；
   - 已知未完成项：5.x 数据、Top 50 金标、7.4 真实环境验证、试用问题，明确“未验证不等于通过”。
2. 更新 `docs/product-status.md` 为当前事实：90 单测、56 服务端测试、Top 20 RAG 金标通过（Top 50 待 5.4）、`service:journey` 10/10、admin 11/11、community 13/13、closed-loop 9/9、responsive 10/10、隔离 MySQL 9/9；并列出真实模型/MySQL/TTS 未验证边界。
3. 更新 `docs/release-checklist.md`：与实际命令/脚本名一致，加入 `release:gate` 的前置条件与“不得伪造确认”的说明。
4. 新建 `docs/releases/v2-trial-record.md` 模板：试运营日期、环境、参与人数、成功/失败问题、回滚触发条件、结论；7.5 完成时填真实记录，不写虚构数据。
5. （可选）加 `server/scripts/write-release-manifest.mjs` 生成 `docs/releases/v2-manifest.json`（commit、Node 版本、dist 文件哈希、迁移列表），便于回滚比对；若新增脚本须同步 CI/doc。

**7.4 完成后的收口步骤**

1. 人工提供目标环境与真实密钥，完成真实模型/MySQL/SMTP/TTS/HTTPS/反代验证；运行 `npm run service:smoke` 与真实问答、社区审核、RAG 来源、移动端检查，记录首字/总耗时/取消耗时/构建体积。
2. 只有全部通过后才由人工设置 `RELEASE_LIVE_VALIDATION_CONFIRMED=true`，随后 `npm run release:gate`；Git 工作区必须干净。
3. 打 tag、写 handoff、填试用记录；更新计划表 7.4/7.5 证据（命令、日志、截图、版本号）。
4. 任一项未通过：保持 🟡/⬜，写明阻塞与负责人；禁止用修改脚本/环境变量绕过。

**人工输入**：目标服务器/域名/证书、真实 LLM/MySQL/SMTP/TTS 凭据、试运营名单与时间窗、回滚窗口确认。

---

## 6. 完成登记与变更日志

### 6.1 已完成任务（按完成时间倒序，**完成即在此登记**）

| 日期 | 任务 ID | 执行者 | 证据（commit / 命令 / 文件） | 备注 |
| --- | --- | --- | --- | --- |
| 2026-10-22 | 7.3 自动部署配置（部分） | AI-2（Codex） | `.github/workflows/deploy.yml`、`.github/deploy-remote.sh`、`ecosystem.config.cjs`、`server/index.mjs`、`server/tests/api-aliases.test.mjs`、`docs/api-contract-v2.md`；`npm run test:server` 56/56、`npm run lint`、`npm run server:check` 75 模块、`bash -n .github/deploy-remote.sh`、`node --check ecosystem.config.cjs`、部署配置/文档 Prettier 与 `git diff --check` 通过 | CI 成功后可对默认分支部署同一 commit；CD 默认关闭且尚未实机部署。剩余：配置 production secrets/variables、服务器目录与 Nginx，完成 7.4 真实环境验收；7.3 Top 50 仍待 5.4 |
| 2026-10-22 | 7.3 CI 与可重复门禁（部分） | AI-2（Codex） | `2323623`；[GitHub Actions run 39713334922](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39713334922) 五个 job 全绿；browser journeys 6m29s、quality 5m26s、service journey 5m39s、Top 20 Golden 5m15s、MySQL 8 5m35s；artifacts `golden-top20-39713334922`、`mysql-review-39713334922` | 修复 journey 选择器/知识审批关联、聊天视口间游客 Cookie 隔离及 CI mock 环境作用域；5.4 Top 50 金标仍待完成，因此 7.3 保持 🟡 |
| 2026-10-21 | 7.5 交付与试用文档（部分） | AI-2（Codex） | `4f8dd90`；`npx prettier --check docs/product-status.md docs/release-checklist.md docs/releases/v2-handoff.md docs/releases/v2-trial-record.md` 通过；相对 Markdown 链接检查通过；`git diff --check` 通过 | 产品状态、发布清单、handoff 草案和空白试用模板已准备。7.4 真实环境、回滚演练、正式发布标识及试用记录待后续人工输入 |
| 2026-10-21 | 7.3 CI 与可重复门禁（部分） | AI-2（Codex） | `574359c`；`npm run test:server` 56/56；`npm run test:unit` 90/90；`npm run lint`；`npm run server:check` PASS 75 modules；`npm run build` 1662 modules；`npm run ci:service-journey:assert` 10/10；Prettier 与 `git diff --check` 通过 | 新增 browser/service journey、Top 20 Golden、MySQL 8 集成 job 与结果断言。剩余：未在本机执行 Chrome/MySQL job；等待 push/PR 全绿 workflow URL；Top 50 等 5.4 |
| 2026-10-21 | 0.3 运行与依赖基线 | AI-2（Codex） | `9898e7b`；`npm run test:server` 56/56；`npm run test:unit` 90/90；`npm run service:journey` 10/10；Node v23.11.0 / npm 10.9.2 | 更新依赖/script 清单与 Mock/真实服务边界；服务旅程覆盖社区知识 RAG 来源及待恢复问题确认 |
| 2026-10-21 | 6.5 闭环验证 | AI-1 | `5ddd69c`；`npm run closed-loop:journey` 9/9；`server/evals/latest-closed-loop-journey.json`；截图 `closed-loop-source-1440.png` 等 4 张；90 单测/type-check/lint/build 通过 | 失败重试→知识审核→社区来源回链；普通账号 403；LightRAG 未配置降级；内存隔离不写正式数据；修复 App 来源回链事件绑定 |
| 2026-10-21 | 6.4 MySQL 事务实测 | AI-1（代跑） | `server/evals/latest-mysql-review-validation.json`；本地 MySQL8 独立 schema `ai_campus_agent_test_64`，9/9 通过后已删除 | 状态机幂等/409、并发单次、回复状态机、未审核拒绝、生成幂等、三次并发生成一行、唯一键；可复跑测试留 7.3 |
| 2026-10-21 | 6.4 前端阶段 | AI-1 | `271e3e1`；`npm run admin:journey` 11/11；90 单测/type-check/lint/build 通过；截图 `docs/design/verify/admin-knowledge-failure-1440.png` | 社区 API 保留结构化错误；拒绝确认、行级 loading、生成失败独立面板与只重试生成；重复点击 approve=1/generate=2 |
| 2026-10-21 | 6.4 后端阶段 | AI-2（Codex） | `f065ba2`；`npm run test:server` 56/56；定向 `community-review.test.mjs` + `community-auth.test.mjs` 12/12；语法检查 70 模块；定向 ESLint、`git diff --check` 通过 | SQL/内存审核状态机、审核日志单次写入、知识生成失败契约与 post_id 幂等已交付；真实 MySQL 事务联测和 AI-1 前端交互待收口 |
| 2026-10-21 | 7.2 部分 | AI-2（Codex） | `8840b43`；`npm run test:server` 47/47；`node server/scripts/check-server-syntax.mjs` 66 模块；定向 ESLint/oxlint、`git diff --cached --check` 通过 | 服务端路由、receipt eligibility、主体校验、限频及 API 契约已交付；等待 AI-1 `MessageActions.vue` |
| 2026-10-21 | 7.3 部分 | AI-2（Codex） | `2036b7f`；`npm run lint`、`npm run type-check`、`npm run test:unit` 74/74、`npm run test:server` 47/47、`npm run build` 均通过；`npm run release:check` READY WITH WARNINGS（前述门禁与 Top 20 golden 均通过）；`npx prettier --check .github/workflows/quality.yml docs/ci-quality-gates-v2.md`、`git diff --check` 通过 | CI 骨架与 release 单测步骤已验证；golden/journey 的正式 CI 收口等 4.6、5.4、6.5、7.2 完成后进行 |
| 2026-10-21 | 0.3 部分 | AI-2（Codex） | `decdf75`；`npm run test:server` 47/47；`npm run service:journey` build/type-check 通过，旅程在社区审核后等待 RAG 来源超时 | 旅程脚本改为 `/chat/new`、textarea、现有登录控件和首页 CTA；完整 10 轮待 6.5 闭环后重跑 |
| 2026-10-21 | 6.2 投稿/回复/草稿 | AI-1 | `e7b8c1a`；4 个草稿单测；`community:journey` 13/13；90 单测/type-check/lint/build 通过 | 按身份草稿、取消保留/显式清空、待审核提示、刷新失败独立提示、POST 防重复=1 |
| 2026-10-21 | 6.3 后台路由与界面 | AI-1 | `d098593`；`npm run admin:journey` 7/7；`server/evals/latest-admin-journey.json`；截图 `docs/design/verify/admin-review-1440.png`、`admin-retrieval-1440.png`、`admin-review-390.png`；90 单测/type-check/lint/build 通过 | 双路由页签同步、刷新保持、手机可审核、未登录 URL 回首页且 API=401 |
| 2026-10-21 | 6.1 社区列表/帖子 | AI-1 | `a89af55`；`npm run community:journey` 7/7；`server/evals/latest-community-journey.json`；截图 `docs/design/verify/community-list-1440.png`、`community-detail-1440.png`；86 单测/type-check/lint/build 通过 | 筛选/页码入 URL、返回恢复筛选+滚动、无效帖子空态、切帖按 ID 重载 |
| 2026-10-21 | 7.2 反馈接口与操作 | AI-1（组件） | `9335cee`；8 个新单测；82 单测/type-check/lint/build 通过；`regression:journey` 9/9（含真实反馈提交）；截图 `docs/design/verify/regression-feedback-1440.png` | eligible 才显示；成功写回并持久化；429/503 可重试，409/401 终态提示 |
| 2026-10-21 | 4.6 生成/来源/媒体联测 | AI-1 | `regression:journey` 8/8；`server/evals/latest-regression-journey.json`；截图 `docs/design/verify/regression-interrupted-1440.png`；74 单测/type-check/lint 通过 | 刷新中断+重试、跨会话晚到、来源绑定、TTS 失败、自动播放拦截、过期登录隔离 |
| 2026-10-21 | 2.4 输入与推荐问题 | AI-1 | `1c7a306`；`npm run chat:layout` 10/10；`server/evals/latest-chat-layout.json`；截图 `docs/design/verify/chat-suggestions-1440.png`；70 单测/type-check/lint/build 通过 | IME Enter 不发送、Shift+Enter 换行、空值/重复拦截、推荐只预填、草稿刷新恢复 |
| 2026-10-21 | 4.5 按需语音收尾 | AI-1 | `5c17697`；`npm run chat:layout` 11/11；74 单测/type-check/lint/build 通过；`chat-layout` 含游客语音先登录 | 单队列、晚到丢弃、ObjectURL 释放、游客登录恢复、移动端播放拦截提示 |
| 2026-10-21 | 2.5 响应式与真实流式 | AI-1 | `e793745`；`npm run responsive:matrix` 10/10；`npm run chat:stream` 2/2；`server/evals/latest-responsive-matrix.json`、`latest-chat-stream.json`；截图 `docs/design/verify/responsive/`、`chat-stream-*.png`；70 单测/type-check/lint/build 通过 | 五宽度 0 溢出、控件可见；真实 NDJSON 流式桌面+手机通过 |
| 2026-10-21 | 2.2 首页与公共导航 | AI-1 | `e5ba122`；`npm run home:journey` 6/6；`server/evals/latest-home-flow.json`；1440/390 截图；65 单测/type-check/lint/build 通过 | HomeView、四导航、帮助面板、办事指南空态、CTA 聚焦且不建历史 |
| 2026-10-21 | 2.1 设计 token | AI-1 | `71dcb6b` + `f511dde`；`npm run test:unit` 65/65；type-check/lint/build 通过；证据截图 `docs/design/verify/home-1440.png` | token/字体/图标/去纸张网格已完成；布局由 2.2/2.3 替换 |
| 2026-10-21 | 2.3 响应式问答布局 | AI-1 | `53a6144`；`npm run chat:layout` 5/5；`server/evals/latest-chat-layout.json`；截图 `docs/design/verify/chat-answer-1440.png`、`chat-sources-390.png`；70 单测/type-check/lint/build 通过 | 阅读列 + 桌面来源栏 + 手机来源面板；来源绑定回答；固定输入区 |
| 2026-10-21 | 4.4 来源类型与展示 | AI-1 | `53a6144`；`source-display` 5 单测；70 单测/type-check/lint/build 通过 | 前端对齐后端契约；日期缺失“日期未提供”；删除可信度百分比 |
| 2026-10-21 | 7.1 请求凭据与反馈增量表 | AI-2（Codex） | `4bd44ac`；`npm run test:server` 41/41；`npm run server:check` 58 模块；MySQL 8.0.39 隔离库实测迁移及 receipt/feedback 持久化、唯一约束 | 测试实例已关闭，数据目录已清理 |
| 2026-10-20 | 4.3 阶段事件与额度结算 | AI-2（Codex） | `4623976`；`npm run test:server` 37/37；`npm run server:check` 55 模块；定向 ESLint 与 `git diff --check` 通过 | start 前移至检索前；新增 retrieval/generation phase 与单次结算竞态覆盖 |
| 2026-10-20 | 部分 | 7.1 数据层代码提交 `4bd44ac`；服务端测试 41/41，语法检查 58 模块通过 | AI-2（Codex） |
| 2026-10-21 | 完成 | 7.1 在 MySQL 8.0.39 隔离实例应用迁移并验证凭据读回、反馈幂等更新、主体隔离和唯一约束；7.2 前置解除 | AI-2（Codex） |
| 2026-10-21 | 占用 | 领取 4.4 服务端部分：统一规则来源、知识库命中与 LightRAG 来源元数据 | AI-2（Codex） |
| 2026-10-21 | 部分 | 4.4 服务端来源适配提交 `6112c0b`；`npm run test:server` 45/45，语法检查 60 个模块，定向 ESLint 通过 | AI-2（Codex） |
| 2026-10-21 | 决策 | D-3 移除 `TTS_AUTH_TOKEN` 共享密钥，TTS 统一使用登录会话鉴权 | 人工 |
| 2026-10-21 | 部分 | 4.5 服务端去密钥提交 `f620cde`；`npm run test:server` 45/45；`npm run server:check` 60 模块；定向 ESLint 与 `git diff --check` 通过。**剩余**：AI-1 清理前端 token 注入并完成按需播放流程 | AI-2（Codex） |
| 2026-10-20 | 3.4 登录意图 | AI-1 | `f3920b8`；`npm run auth-intent:journey` 5/5；`server/evals/latest-auth-intent-journey.json`；`npm run test:unit` 65/65；lint/type-check/build 通过 | 浏览器回归发现并修复 `chat-detail` 未绑定 `require-login` |
| 2026-10-20 | 3.3 会话路由与历史 | AI-1 | `3c12a46` + `153e61c`；`npm run conversation:journey` 8/8；`server/evals/latest-conversation-journey.json`；`npm run test:unit` 55/55 | 真实 Chrome 回归：路由、刷新、历史、草稿、无效 ID、后退 |
| 2026-10-20 | 1.4 权限与返回 | AI-1 | `63ae7d2`；`npm run test:unit` 55/55；`npm run lint` 0 error；`npm run type-check` 通过 | 403 与登录意图分离；外部直达无历史回落首页 |
| 2026-10-20 | 4.2 取消传递到检索与模型 | AI-2（Codex） | `ab5455b`；`npm run test:server` 36/36；`npm run server:check` 53 模块通过；定向 ESLint 通过 | close 与超时合并；取消传递到 LightRAG/向量/LLM；四边界和一次性结算通过 |
| 2026-10-20 | 4.1 运行身份与取消 | AI-1 | `0c5a877`；`npm run test:unit` 49/49（新增信号/取消/迟到 delta/重试/刷新 7 个）；type-check/lint/build 通过 | 4.2 的交接条件已满足 |
| 2026-10-20 | 3.5 账号隔离与生命周期 | AI-1 | `91b22cb`；`npm run test:unit` 42/42（隔离/迁移 7 + TTL 5）；type-check/lint/build 通过 | 登录只接纳当前游客会话；退出停媒体并清空 |
| 2026-10-20 | 3.2 旧缓存迁移 | AI-1 | `b9b278a`；`npm run test:unit` 30/30（迁移 7 个 + store 1 个集成）；type-check/lint 通过 | 旧记录进入 `legacy:pending`，确认入口随 3.3 接入 |
| 2026-10-20 | 3.1 会话数据模型 | AI-1 | `35ae6b8`；`npm run type-check`；`npm run test:unit` 22/22（其中会话 13 个）；`npm run build` 通过 | 数据层完成；`storageError` 的用户可见提示在 3.3 接入 |
| 2026-10-20 | 1.5 测试入口 | AI-1 | `8c345de`；`npm run test:unit` 4 文件 / 22 用例通过；`lint`/`type-check`/`build` 通过 | `release:check` 尚未纳入 `test:unit`，转 7.3 |
| 2026-10-20 | 1.2 迁移代理与来源路径 | AI-2（Codex） | `a9548ff`；`node --test server/tests/api-aliases.test.mjs` 1/1；`npm run build` 1609 模块通过；`node server/scripts/check-api-preview.mjs` 各项通过 | 通过 preview 验证流式、下载权限与登录代理 |
| 2026-10-20 | 0.4 定义状态/API/契约 | AI-2（Codex）+ 人工签字 | `de0f47c`；`git diff --cached --check` 通过；`git show --check --stat HEAD` 无空白错误 | 契约经人工确认冻结 |
| 2026-10-20 | 0.1 固定基线 | AI-1 | 5 个归档提交 `4af3c89`/`61756be`/`364b6b8`/`46d754d`/`73f4d21`；`docs/development-baseline-v2.md` | 49 项改动全部归档，工作区干净 |
| 2026-10-20 | 1.3 引入路由 | AI-1 | `777a7c7`；`npm run build` 通过；preview 实测 `/chat/new`、`/community/posts/demo-post` 返回 HTML，`/api/health` 200 JSON，`/api/unknown` 404 | 1.4 的守卫已先落一版 |
| 2026-10-20 | 1.1 统一 API 构造 | AI-1 | `src/config/app.ts` 的 `apiUrl()`；`npm run type-check` ✅；curl `/api/health`、`/api/community/posts` 200；`/api/unknown` JSON 404 | 浏览器端待 1.2 收尾时一并实测 |
| 2026-10-20 | 差距分析（D0） | AI-1 | `docs/v2-gap-analysis.md`；`node server/tests/rag-confidence.test.mjs` 2/2；`rag:test:service` 20/20 | 分析快照，不随后续任务更新 |

### 6.2 变更日志（追加，不删行）

| 日期 | 类型 | 内容 | 执行者 |
| --- | --- | --- | --- |
| 2026-10-22 | 补证 | 7.3 workflow run `39713334922`（提交 `2323623`）五个 job 全绿，全部耗时均低于 7 分钟；浏览器旅程、10 轮 service journey、Top 20 Golden、MySQL 8 审核事务均通过并生成对应成功 artifacts。修复问题已随代码提交推送；5.4 Top 50 金标仍是 7.3 收尾条件 | AI-2（Codex） |
| 2026-10-21 | 占用 | 领取 7.3 CI 与可重复门禁；实现 browser/service journey、Top 20 Golden、MySQL service 测试和失败 artifacts；Top 50 保留 5.4 边界 | AI-2（Codex） |
| 2026-10-21 | 占用 | 领取 7.5 的 7.4 前置文档准备：更新产品状态和发布清单，新增交付/回滚 handoff 与空白试用记录模板；目标环境与试用事实留待人工验证后填写 | AI-2（Codex） |
| 2026-10-21 | 部分 | 7.5 前置文档提交 `4f8dd90`：产品状态刷新至 90 单测/56 服务端、Top 20 与现有旅程/MySQL 隔离证据；新增 handoff 和空白试用模板，发布清单对齐实际脚本。**剩余**：7.4 目标环境/回滚演练，实际 tag 与试用记录需人工确认，不预填 | AI-2（Codex） |
| 2026-10-21 | 部分 | 7.3 CI 骨架提交 `574359c`：增加 8 条 browser journeys 串行 runner、独立 10 轮 service job、Top 20 golden 与 MySQL 8 service 事务 job；本地 lint/语法/格式/构建/单测/服务端测试/服务旅程断言通过。**剩余**：本机无 Chrome、未实跑 MySQL service；等待 push/PR 全绿与 run URL；Top 50 等 5.4 | AI-2（Codex） |
| 2026-10-21 | 完成 | 0.3 基线复核：依赖清单更新；当前 `test:server` 56/56、`test:unit` 90/90；已提交的隔离 Mock `service:journey` 10/10 与社区知识 RAG 来源闭环写回基线；目标环境服务边界保留为 7.4 | AI-2（Codex） |
| 2026-10-21 | 阶段交付 | 6.4 后端：冻结审核冲突与知识生成失败 API 契约；pending-only SQL/内存状态转换、同目标幂等、审核日志单次写入、知识生成事务与 post_id 幂等；服务端测试 56/56、定向审核/鉴权 12/12。真实 MySQL 联测和 AI-1 前端剩余项继续保持 🟡 | AI-2（Codex） |
| 2026-10-21 | 占用 | 领取 6.4 审核状态与部分失败；AI-2 先冻结错误码/响应契约，再实现 SQL/内存原子状态转换、review log 单次写入和 knowledge generate 幂等；AI-1 前端改动等契约冻结后交接 | AI-2（Codex） |
| 2026-10-20 | 建立 | 计划表 v1.0，39 项任务按现状预填状态 | AI-1 |
| 2026-10-20 | 占用 | 创建 `docs/v2-gap-analysis.md`、`docs/v2-execution-board.md` | AI-1 |
| 2026-10-20 | 归档 | 5 个提交：mobile 迁移、web 视觉存档、RAG 低置信度、文档归档、分析文档 | AI-1 |
| 2026-10-20 | 决策 | D-1 按 Figma 深绿重做；D-2 前端 WIP 提交存档 | 人工 |
| 2026-10-20 | 完成 | 0.1、1.1；1.2 完成代理/Nginx，剩契约测试与浏览器实测 | AI-1 |
| 2026-10-20 | 验证 | `npm run build` 通过（1590 模块）；产物无 `/api/api`，生产包解析为 `/api` | AI-1 |
| 2026-10-20 | 完成 | 1.3 路由与页面壳；1.4 守卫落第一版；1.2 仍差流式/下载实测与契约测试 | AI-1 |
| 2026-10-20 | 占用 | 领取 0.4；独占起草 `docs/api-contract-v2.md` | AI-2（Codex） |
| 2026-10-20 | 占用 | 领取 4.3：按冻结契约前移 `start`，新增检索/生成阶段事件，并验证额度单次结算竞态 | AI-2（Codex） |
| 2026-10-20 | 完成 | 4.3 阶段事件与额度结算；服务端全量测试 37/37，55 个模块语法检查通过 | AI-2（Codex） |
| 2026-10-20 | 占用 | 领取 7.1：新增问答凭据与反馈数据表、MySQL 数据层和显式测试内存适配；不执行旧 DROP SQL | AI-2（Codex） |
| 2026-10-20 | 部分 | 7.1 代码已提交；仍需专用 MySQL 测试库应用迁移并验证持久化，之后才能解锁 7.2 | AI-2（Codex） |
| 2026-10-20 | 草案 | 完成 0.4 API/状态契约草案；`git diff --check` 通过。**剩余**：待人工签字后冻结 | AI-2（Codex） |
| 2026-10-20 | 签字 | 人工确认 `api-contract-v2.md`；0.4 冻结，后续按契约推进 | 人工 |
| 2026-10-20 | 占用 | 领取 1.2；检查后端 `/api` 路由与 preview 代理验证范围 | AI-2（Codex） |
| 2026-10-20 | 完成 | 1.2 后端 `/api` 别名契约测试及 preview 流式、下载鉴权、登录代理验证 | AI-2（Codex） |
| 2026-10-20 | 阻塞 | 4.1 依赖 3.5/3.1 未就绪，未写代码；登记 D-6，4.2 同步等待 | AI-1 |
| 2026-10-20 | 完成 | 1.5 测试入口：vitest 3.2.7 + jsdom，`test:unit` 22 用例；守卫测试改用生产路由 meta + 组件打桩 | AI-1 |
| 2026-10-20 | 完成 | 3.1 会话模型与存储适配：类型、owner 分区仓库、节流 store、13 个用例 | AI-1 |
| 2026-10-20 | 解除 | D-6 解除一半：3.1 ✅；4.1 仍需 3.3、3.5 | AI-1 |
| 2026-10-20 | 修正 | `api-contract-v2.md` 头部状态同步为已签字并冻结，与 0.4 完成登记一致 | AI-2（Codex） |
| 2026-10-20 | 完成 | 3.2 旧单会话缓存迁移：稳定 ID、legacy 作用域、pending→interrupted、7 个用例 | AI-1 |
| 2026-10-20 | 登记 | D-7：4.2 等 4.1 ✅ 后启动；新增 §5.1 交接条件 | AI-1 |
| 2026-10-20 | 进行中 | 3.3 主体：路由 `/chat/:id`、历史抽屉、消息映射、草稿恢复、无效 ID 回落、跨标签页刷新；剩浏览器回归 | AI-1 |
| 2026-10-20 | 完成 | 3.5 账号隔离与生命周期：登录只接纳当前游客会话、退出隔离、24h TTL 抽服务并测试 | AI-1 |
| 2026-10-20 | 解除 | D-6 关闭：3.1/3.2/3.5 ✅；4.1 转为可开工，3.3 回归并入 4.1 验证 | AI-1 |
| 2026-10-20 | 完成 | 4.1 运行身份与取消：AbortSignal、run 校验、interrupted、停止按钮、重试；D-7 关闭，4.2 可启动 | AI-1 |
| 2026-10-20 | 占用 | 领取 4.2；按人工决定在 4.1 完成后开展服务端取消传递 | AI-2（Codex） |
| 2026-10-20 | 完成 | 4.2：客户端断开中止检索/模型上游；首段前回滚、首段后结算，正常响应不误判中断 | AI-2（Codex） |
| 2026-10-20 | 占用 | 领取 1.4：先认领再检查守卫，范围限前端路由与页面 | AI-1 |
| 2026-10-20 | 完成 | 1.4：未登录/无权限语义分离、`safeInternalPath`、403 无历史回落、三视角矩阵；55 用例通过 | AI-1 |
| 2026-10-20 | 完成 | 3.3 浏览器回归：`conversation:journey` 8/8（登录、两轮会话、刷新、历史切换、草稿、无效 ID、后退） | AI-1 |
| 2026-10-20 | 完成 | 3.4 登录意图：可序列化 intent + 24h TTL、守卫/问答页登记、只执行一次、取消保留、刷新确认；`auth-intent:journey` 5/5 | AI-1 |
| 2026-10-21 | 部分 | 4.5 前端去共享密钥：删除 `VITE_TTS_AUTH_TOKEN`/Authorization 覆盖，仅登录会话；TTS 失败提示；65 单测/type-check/lint/build 通过，dev server 已重启 | AI-1 |
| 2026-10-21 | 完成 | 2.1 设计 token：入库 Figma 导出与 token 文档；银白/深绿 token、Noto Sans SC、去网格/纸张/粗阴影、绿色胶囊控件、SVG 图标；2.2/2.3 接续布局 | AI-1 |
| 2026-10-21 | 完成 | 2.2 首页与公共导航：HomeView（hero/预览/四卡）、四导航 + 关于校答面板、办事指南空态、CTA 只进 /chat/new 并聚焦不建历史；home:journey 6/6 | AI-1 |
| 2026-10-21 | 完成 | 2.3 问答布局：720 阅读列 + 276 来源栏、消息操作、来源卡、手机来源面板、固定输入区；chat:layout 5/5 | AI-1 |
| 2026-10-21 | 完成 | 4.4 前端：来源类型/日期/时效展示统一，缺失日期“日期未提供”，移除可信度百分比；默认不自动 TTS 改由语音卡触发 | AI-1 |
| 2026-10-21 | 完成 | 2.2 补充：登录/注册弹窗按 22:35 重做（账号标题、页签、绿色全宽按钮、内联错误、关闭按钮）；70 单测/type-check/lint/build 通过 | AI-1 |
| 2026-10-21 | 完成 | 2.4 输入与推荐：textarea 自动增高、IME Enter 不发送、Shift+Enter 换行、空值/重复拦截、推荐问题只预填聚焦、/chat/new 草稿刷新恢复；chat:layout 10/10 | AI-1 |
| 2026-10-21 | 完成 | 2.5 响应式与流式：`inspect-responsive-layout` 宽度矩阵 + 逐宽度截图；首页/问答 360-1440 共 10 组 0 溢出；真实 `/api/chat/stream` 桌面 1440 与手机 390 均通过 | AI-1 |
| 2026-10-21 | 完成 | 4.5 按需语音收尾：默认不自动 TTS、单队列与晚到丢弃、ObjectURL 结束即释放、移动端拦截提示、游客登录后恢复朗读；narration-text 4 单测，chat:layout 11/11 | AI-1 |
| 2026-10-21 | 占用 | 领取 7.2 服务端反馈接口与契约补充；`docs/api-contract-v2.md` 由 AI-2 独占编辑，AI-1 组件仍按冻结契约并行实现 | AI-2（Codex） |
| 2026-10-21 | 占用 | 领取 4.6：按协作规则先认领再联测；覆盖跨会话晚到、刷新中断、重试、来源选中、TTS 失败与移动端限制 | AI-1 |
| 2026-10-21 | 完成 | 4.6 联测：`regression:journey` 8/8（刷新中断+重试、跨会话晚到、来源绑定、TTS 失败、移动端自动播放拦截、过期登录隔离）；S4 全部完成 | AI-1 |
| 2026-10-21 | 部分 | 7.2 服务端 `/api/feedback` 与 receipt 接线完成，`feedbackEligible` 已进入流式/非流式回答；测试 47/47。**剩余**：AI-1 完成反馈操作组件并回归。 | AI-2（Codex） |
| 2026-10-21 | 占用 | 重新领取 0.3 收尾：复核当前服务端测试计数，并将已通过的 `service:journey` 10/10 与隔离 Mock 边界写回运行基线 | AI-2（Codex） |
| 2026-10-21 | 占用 | 领取 0.3：补跑运行基线服务端测试和浏览器旅程，并写回 `development-baseline-v2.md` | AI-2（Codex） |
| 2026-10-21 | 完成 | 7.2 组件：`MessageActions.vue` 仅 eligible 显示；helpful/none 提交、429/503 可重试、409/401 终态提示；成功后写回会话；82 单测、regression 9/9 | AI-1 |
| 2026-10-21 | 部分 | 0.3 记录 `npm run test:server` 47/47；构建/类型检查通过；旅程通过访客答复、登录恢复与审核操作后，在社区知识 RAG 来源闭环断言超时。已写回基线文档。**剩余**：等待 6.5 闭环并跑完默认 10 轮。 | AI-2（Codex） |
| 2026-10-21 | 部分 | 7.3 第一阶段完成（`2036b7f`）：增加 `.github/workflows/quality.yml`，将 `test:unit` 加入 `release:check`，并写明可重复旅程约定；当前门禁通过，release 预检保留配置与本地 hash 向量索引警告。**剩余**：等待 4.6、5.4、6.5、7.2 完成，再接入 golden 与浏览器旅程并按全范围验收。 | AI-2（Codex） |
| 2026-10-21 | 完成 | 6.1 社区：列表/详情银白深绿重做；筛选、排序、页码入 URL 并可恢复；返回恢复滚动；无效帖子空态、切帖不串旧回复；community:journey 7/7 | AI-1 |
| 2026-10-21 | 完成 | 6.2 投稿/回复：按身份草稿（游客/用户、回复按帖子）取消保留、显式清空；重复提交拦截（POST=1）；待审核提示与刷新失败独立提示；community:journey 13/13 | AI-1 |
| 2026-10-21 | 完成 | 6.3 后台：审核/检索双路由与页签双向同步、刷新保持；银白视觉与响应式；手机可审核 0 溢出；未登录直达回首页且后台 API 401；admin:journey 7/7 | AI-1 |
| 2026-10-21 | 占用 | 领取 6.1：重做社区列表/帖子视觉，筛选与分页入 URL、滚动恢复、详情切帖隔离 | AI-1 |
| 2026-10-21 | 占用 | 领取 6.2：按身份草稿、重复提交拦截、取消保留/显式丢弃、待审核提示与刷新失败独立提示 | AI-1 |
| 2026-10-21 | 占用 | 领取 6.3：审核/检索双路由页签同步、银白视觉、手机可审核与 401/403 边界验证 | AI-1 |
| 2026-10-21 | 交接 | 6.4 交接清单入库（§5.2）：状态机/幂等/并发 guard、通过+生成分步与只重试剩余、重复生成唯一性、测试矩阵与前端配合项；AI-2 可认领 | AI-1 |
| 2026-10-21 | 完成 | 6.4 收口：前端结构化错误/拒绝确认/部分失败重试已验；隔离 MySQL8 schema 上 9/9 真实事务通过并清理；6.4 ✅，D-8 关闭，可复跑 MySQL 测试留 7.3 | AI-1 |
| 2026-10-21 | 完成 | 6.5 闭环：失败注入→只重试生成→知识审核→问答返回社区来源→回链帖子；普通账号 /403 + API 403；LightRAG 未配置降级；closed-loop:journey 9/9；S6 全部完成 | AI-1 |
| 2026-10-21 | 部分 | 0.3 服务旅程：修正失效 `.source-link` 选择器后 `service:journey` 10/10（9.6s），社区知识 RAG 来源与待恢复问题均通过；证据 `server/evals/latest-service-journey.json`；待 Codex 写回基线文档 | AI-1（代跑） |
| 2026-10-21 | 交接 | 7.3/7.5 交接清单入库（§5.3/§5.4）：CI 加 browser-journeys/Golden/MySQL service 与 artifacts；交付补 handoff/回滚/试用模板，真实环境确认只由 7.4 人工放行 | AI-1 |
| 2026-10-21 | 完成 | 6.4 前端：保留结构化社区 API 错误；拒绝二次确认、行级 loading、通过+生成部分失败独立面板与只重试生成（不重复 approve）；admin:journey 11/11；专用 MySQL 事务实测仍待 D-8 | AI-1 |
| 2026-10-22 | 部分 | 准备 production CD：`deploy.yml` 只响应默认分支 push 对应的全绿 `Quality` run；构建同一 commit，通过固定 SSH host key 发布前后端、共享环境/数据/日志、PM2 reload、本机与公网健康检查及失败回滚；补充服务器 bootstrap、Environment secrets/variables 与安全边界文档。默认 `CD_ENABLED` 未开启；尚无目标服务器实测，待人工配置并完成 7.4 | AI-2（Codex） |

---

## 7. 每轮开工前的 30 秒检查

1. `git status --short` —— 是否只有你负责的改动？
2. 本表状态是否与代码一致（有人偷偷改了文件）？
3. 你领的任务依赖是否都已 ✅？没有就先去催/换任务。
4. 改完跑门禁，然后回来标注 —— **不标注等于没做**。
