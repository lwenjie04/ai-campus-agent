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
| S0 | 4 | 4 | 0 | 0 | 0 | 0 | — |
| S1 | 5 | 5 | 0 | 0 | 0 | 0 | — |
| S2 | 5 | 5 | 0 | 0 | 0 | 0 | — |
| S3 | 5 | 5 | 0 | 0 | 0 | 0 | — |
| S4 | 6 | 6 | 0 | 0 | 0 | 0 | — |
| S5 | 4 | 3 | 1 | 0 | 0 | 0 | 5.4 已上线生产（f34b05e / Deploy #35）并公网验证；待 7.4 发布签收与缺失正文收口 |
| S6 | 5 | 5 | 0 | 0 | 0 | 0 | — |
| S7 | 5 | 2 | 3 | 0 | 0 | 0 | 7.4 生产数据库迁移与反馈闭环已验证；测试邮件到达已由用户确认，验证码生命周期、登录态 TTS、社区知识管理 API 与人工签收待验；登录/TTS 当前按用户决定暂缓，真实 Embedding 密钥待用户配置；7.3 等 Top 50；7.5 等 7.4 收口 |
| **合计** | **39** | **35** | **4** | **0** | **0** | **0** | — |

> 已完成：0.1、0.2、0.3、0.4（AI-2）、1.1、1.2（AI-2）、1.3、1.4、1.5、2.1、2.2、2.3、2.4、2.5、3.1、3.2、3.3、3.4、3.5、4.1、4.2、4.3、4.4、4.5、4.6、5.1、5.2、5.3、6.1、6.2、6.3、6.4、6.5、7.1、7.2。**S1/S2/S3/S4/S6 已全部完成**；0.2 的补充画板 9/9 张已导出并归档，`35:134` 的标题间距已调整，0.2 完成；5.1 的 12 项清单已获人工确认，年度通知仅作来源参考、无办理入口；5.2 的列表、分类筛选、详情、空态与无效事项已完成并验证；5.3 的标题/关键词搜索与无结果转问已完成；5.4 已由 Lead 接手完成时间语义、时效规则、2 字领域词与检索排序修复，按用户拍板落地转专业双期望与现行政策提示，12 题诊断 12/12、Top 20/Top 50 金标全绿；上线前确认完成（真实链路 10000/6000/3700 回答与来源正确、数据缺失可静默关闭），政策提示文案已由用户签收（`signed-off`），已于 2026-10-27 合并部署到生产（`f34b05e`，Deploy #35）并完成公网复核，缺失正文/逐题核验未完成，保持 🟡；7.3 的 CI 与生产部署已取得全绿和公网验证证据，仍等 5.4 人工来源复核后接入 Top 50；7.4 已在 MySQL 5.7 生产库安全备份并应用反馈增量迁移，且通过真实流式问答、反馈持久化闭环。用户已确认收到邮箱检测邮件；注册验证码过期/重发、登录会话、登录态 TTS、社区知识管理 API、模型故障注入与人工签收仍待处理。登录/TTS 按用户决定暂缓，真实 Embedding 密钥待用户配置后验证；7.5 等真实用户试用与交接记录。实时状态以本表为准。

---

## 3. 任务板

### Sprint 0：固定基线（1–2 天）

| ID | 任务 | 主责 | 状态 | 依赖 | 完成判定 / 证据 |
| --- | --- | --- | --- | --- | --- |
| 0.1 | 固定当前工作基线 | 人工 + AI-1 | ✅ | 无 | 49 项改动已分 5 批提交（`4af3c89`、`61756be`、`364b6b8`、`46d754d`、`73f4d21`）；`docs/development-baseline-v2.md` 记录归属与恢复方式 |
| 0.2 | 补齐 Figma 页面与状态 | 人工 + AI-2（Codex） | ✅ | 0.1 | Figma `10:34` 页的 8 张响应式/控件状态补充画板与 `35:134` 已完成导出并归档到 `docs/design/10-34/`；提交 `42a9bd1` + `5d6b8b7` 归档 `33:176`（390×844），本轮归档 `33:212` 问答与来源侧栏（1024×880）。`docs/design/README.md` 列出全部 9 张；PNG 签名及预期尺寸检查 9/9，`git diff --check` 通过。P1 未绘制的关闭/附件独立 SVG 与组件变体缺项已在设计说明中记录，不阻塞本项。
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
| 5.1 | 事项清单 | AI-2（Codex）+ 人工确认 | ✅ | 0.4、4.4 | `8f0ec93`；`docs/service-catalog-v2.json`、`docs/service-catalog-v2.md`。JSON 检查 12 项、四类各 3、ID 唯一、字段完整、`actionUrl` 全空；`git diff --check` 通过；人工确认年度通知仅作参考、不显示未核实办理入口。5.2/5.3 的页面实现另行登记 |
| 5.2 | 指南列表与详情 | AI-1（Lead） | ✅ | 5.1、2.1 | `f63f865`；新增 `src/views/ServiceDirectoryView.vue`、`src/views/ServiceDetailView.vue`、`src/data/services.ts`（读取 `docs/service-catalog-v2.json`）、`src/services/service-query.ts`、`src/types/service.ts` 与 `/services/:serviceId` 路由。验证：`npm run type-check` 通过；`npm run build` 通过（1667 模块，产出 services chunk）；`npm run test:unit` **111/111**（新增 21 条：目录不变量/URL 解析/路由/列表筛选与非法分类/详情与 actionUrl 隐藏/无效事项/首页四卡与加号落点）；`oxlint .` 0 error、`eslint src` 0 error；`git diff --check` 通过。全量 `npm run lint` 仍被既有未跟踪 `server/scripts/robot-preview-browser.mjs` 的 `WebSocket` no-undef 阻断（非本任务文件）。分类筛选写入 URL，返回保留列表状态；`actionUrl` 为空不渲染办理入口，旧年度通知只作来源参考 |
| 5.3 | 事项搜索与提问桥接 | AI-1（Lead） | ✅ | 5.2、3.4 | `78fdb55`；新增 `src/services/service-search.ts`（只匹配标题与关键词）、`src/services/chat-draft.ts`（`/chat/new` 草稿键与转问预填）；`src/views/ServiceDirectoryView.vue` 增加搜索框（`?q=` 入 URL、跨分类搜索、清除后恢复分类列表、无结果保留搜索词并提供“向校答提问”入口）；`src/views/AgentChat.vue` 改用共享草稿服务，挂载时只恢复草稿并聚焦，不自动发送。验证：`npm run type-check` 通过；`npm run build` 通过（1667 模块）；`npm run test:unit` **129/129**（新增 18 条：搜索匹配/用途不匹配、URL 保留、无结果转问、预填不发送、刷新不重发、清除搜索）；`oxlint .` 0 error、`eslint src` 0 error；`git diff --check` 通过。全量 `npm run lint` 仍被既有未跟踪 `server/scripts/robot-preview-browser.mjs` 阻断（非本任务文件）。搜索词只写在办事指南 URL，转问问题正文只进本地草稿、不进 URL |
| 5.4 | 目录与金标核对 | AI-1（Lead，接手 AI-2 未完成部分；按用户 2026-10-27 A 方案拍板）+ 人工（来源时效复核） | 🟡 | 5.1–5.3 | `e07465d` + `5ecb8c4` + `1b9afbf` + `9f19d6c` + `c78b94f` + `a7109da` + `e9385d1`；接手完成时间语义、时效规则、2 字领域词与检索排序修复（详见 `docs/golden-source-review-2026-10-27.md`）；按用户拍板：① 转专业题接受 2018 手册规定或 2025 通知任一 Top1（`1b9afbf`）；② 新增可审计“现行政策提示”数据 `server/data/policy-updates.json`，金额/标准类问题注入上下文并把政策来源排在来源列表前、按标题去重（`c78b94f`），覆盖国奖/励志 10000/6000 与助学金平均 3700（学校 2500—5000 自主分档，`a7109da`），不改手册原文；**政策文案已由用户签收，状态 `signed-off`**（`e9385d1`，新增签收守卫测试）。**上线前确认完成**：发布包含该数据文件并会同步到 shared/data；文件缺失时静默关闭；真实 DeepSeek 回答“2024 年起 10000/6000、助学金 3700，手册旧标准已过时”且来源正确；非金额问题不注入。12 题目录诊断 **12/12**；回归：Top 20 20/20、Top 50 草案 50/50 + 负例 10/10（关键词/向量）、`test:server` 78/78、`server:check` 83 模块、定向 ESLint/oxlint 0 error。**剩余**：线上是否加载旧手册数据、通知正文缺失与年度限定、逐题核验、独立问题集、7.4 人工发布签收。**生产部署（2026-10-27）**：PR #15 合并 `f34b05e`，master Quality [run 40473264194](https://github.com/lwenjie04/ai-campus-agent/actions/runs/40473264194) 五 job 全绿、Deploy [run 40473427797](https://github.com/lwenjie04/ai-campus-agent/actions/runs/40473427797) 成功；线上 release `f34b05e86ac30d2b69de926bd099e5537c31d749-40473427797-1`，公网 `/api/health` 200、`/services` 与新 JS 资源 200；真实问答“奖学金 10000/6000、助学金 3700、手册旧标准已过时”与来源正确，非金额问题不注入。 |

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
| 7.3 | CI 与可重复门禁 | AI-2（Codex，实机部署） | 🟡 | 1.5、4.6、5.4、6.5、7.2 | `574359c`：新增 browser-journeys（8 条串行旅程、随机隔离凭据、结果/artifact）、独立 10 轮 service journey、Top 20 offline golden、MySQL 8 隔离 service/审核事务测试；更新 `docs/ci-quality-gates-v2.md`。CI 本地与远端验证通过（远端：[run 39713334922](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39713334922)、[run 39714486081](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39714486081)，五个 job 全绿）。run 39741476125 完成发布包上传，但因 `/var/www/ai-campus-agent` 尚不存在而在磁盘预检失败。服务器核验确认旧后端由 root PM2 管理（`/www/ai-campus-agent`，LightRAG 同属 root PM2），宝塔 Nginx 静态目录为 `/www/wwwroot/ai-campus-agent-web`、`/api/` 代理到 3000。已无停机完成首次迁移准备：新 `current` 暂指向旧后端作为回滚点；现有 `.env` 以 `600` 权限复制到共享目录，6 个数据文件和 2 个日志文件已复制并逐项比对；两个 PM2 服务仍在线，后端 `/health`、副本一致性及 Nginx 配置检查通过。部署 workflow 检查根文件系统、以 sudo 调用现有 root PM2，并在回滚旧程序时允许其缺少 releaseId。run 39744028916 的 Quality 五个 job 全通过；deploy run 39744208752 因上传超时未切换。commit 23d81b4 修复 PM2 沿用旧 CWD 的问题：每次从 current 指向的真实 release 目录重建后端进程。该提交的 Quality run 39887012403 五个 job 全绿；Deploy run 39887175711 attempt 1 因原 TrustAsia 证书过期自动回滚，签发新证书后 attempt 2 全绿。首次成功部署 release 为 23d81b41a8306872e3ca1a3b295c45e87766304d-39887175711-2；后续文档登记提交 7115da6 的 Quality run 39890973878 五个 job 全绿、Deploy run 39891110847 成功。该次部署 release 为 7115da6ea3113d51442c5bd005c1baddf0906771-39891110847-1；当前线上 release 已更新为 `a6f94f3d9dacae5e5b6630172a6c01cf3b09d18f-39893338172-1`（[Deploy run 39893338172](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39893338172)）；新证书有效至 2027-01-21，certbot.timer active，certbot renew --dry-run 通过。Nginx 静态根已切到 current/dist，配置检查/reload 通过；公网首页与 dist HTML SHA256 一致、JS 资源 200、/api/health 的 releaseId 匹配。CI 仍不设置 RELEASE_LIVE_VALIDATION_CONFIRMED。剩余：5.4 Top 50 金标完成后接入并复验；7.4 邮件检测已确认到达，验证码生命周期、管理员登录/TTS、社区知识 API、真实 Embedding、模型故障注入与人工签收仍待按 7.4 行推进；登录/TTS 目前按用户决定暂缓；**2026-10-27 新部署**：PR #15 合并 `f34b05e`，master Quality [run 40473264194](https://github.com/lwenjie04/ai-campus-agent/actions/runs/40473264194) 五 job 全绿、Deploy [run 40473427797](https://github.com/lwenjie04/ai-campus-agent/actions/runs/40473427797) 成功，线上 release 更新为 `f34b05e86ac30d2b69de926bd099e5537c31d749-40473427797-1`，公网 health/Services/金额问答已复核；Top 50 仍待 5.4 人工复核后接入。 |
| 7.4 | 目标环境验证与性能 | 共同（AI-2 / Codex 主导本轮） | 🟡 | 7.3 | 2026-10-23 当前线上 release `a6f94f3d9dacae5e5b6630172a6c01cf3b09d18f-39893338172-1`（`https://maila.club`）：真实 DeepSeek 普通问答 TTFT 6.284s/总 6.287s；RAG TTFT 1.254s/总 2.656s、4 条来源；LightRAG health 42ms、奖学金检索 2.214s；`npm run test:server` 56/56。公网实测首段后断开：HTTP 200、Secure 游客 Cookie、retrieval/generation phase、TTFT 2.646s、客户端 reader cancel 2ms；取消传播与结算边界另有 `chat-cancellation.test.mjs` 覆盖。生产 MySQL 5.7.44 先备份再应用 `20261020-chat-feedback.sql`；备份 `/var/backups/ai-campus-agent/ai_campus_agent_pre_chat_feedback_20261023T034120Z.sql.gz`（SHA-256 `b8aaab1b5ee88a80230ac3e19c9e0a36364babe9e0c25d91e055b2a3d1c545ed`，权限 600）；receipt/feedback 表、唯一键/FK、事务写入与 upsert 通过；公网 chat 返回 `feedbackEligible:true`，`/api/feedback` 200 且数据库读回，测试行已清理。备份在随机隔离 schema 恢复验证通过（6 张基础表、6 条社区知识记录），测试 schema 已删除。回滚演练将 current 切到上一版 `7115da6...` 并通过部署脚本本机健康检查，随后恢复当前 release；恢复后公网 `/api/health` 200 且 releaseId 匹配。`service-smoke.mjs` 4/4；TTS 生产合成曾成功（838ms），匿名 `/api/tts` 返回 401 `AUTH_REQUIRED`；生产环境已移除共享 `TTS_AUTH_TOKEN` 并清理重复 TTS 配置。响应式矩阵 `360/390/768/1024/1440` 首页与问答 10/10、无溢出，截图和 JSON 见 `docs/design/verify/production-7.4-responsive-20261023/`、`server/evals/production-7.4-responsive-full-20261023.json`；生产资源 `dist` 17M、`server` 1.2M，运行时 Node 22.22.2/npm 10.9.7/MySQL 5.7.44。用户已确认收到测试邮件，邮件到达检查通过；验证码注册流程的到达/过期/重发尚未实测。登录与登录态 TTS 按用户决定暂记阻塞；管理员社区知识 API 持久化闭环、真实 Embedding 配置已只读核验（2026-10-26）：后端有效 provider=hash/model=hash-256，VECTOR_EMBEDDING_API_BASE_URL/API_KEY/MODEL 均未设置，RAG_VECTOR_ENABLED 默认 true；独立 LightRAG 配置中的 EMBEDDING_BINDING_HOST/API_KEY、EMBEDDING_MODEL、EMBEDDING_DIM 已设置，文件权限 600、最后修改 2026-07-21；LightRAG 进程 online 且内网 health 可达。未发起 Embedding API 请求，密钥有效性与真实向量检索质量仍待验证；线上模型故障注入及真实用户试用仍未完成。MySQL 应用账号全局权限待 DBA 最小权限复核；5.4 Top 50 仍待人工核对。不得设置 `RELEASE_LIVE_VALIDATION_CONFIRMED`。 |
| 7.5 | 交付、回滚与试用记录 | 人工 + AI-2 | 🟡 | 7.4 | 前置准备 `4f8dd90`：新建 `docs/releases/v2-handoff.md`、`docs/releases/v2-trial-record.md`，更新 `docs/product-status.md`、`docs/release-checklist.md` 和基线风险项；Prettier、相对链接检查、`git diff --check` 通过。**剩余**：7.4 邮件/登录/TTS/API 等目标环境缺口与人工签收；7.4 回滚演练已有证据。仍需正式版本/tag、试用日期/人数、用户问题与结论；未验证字段保持空白。 |

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
| D-5 | 将 `src/project-text/exports/` 261 个 JSON 移出前端源码 | 仓库整洁 | ✅ `417a2e8`、`82cfbc2`：保留并移至 `_ingest/project-text/exports/`；专用浏览器导入与通用本地导入目录已分开；262 条现存来源记录已更新 | AI-2 |
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
- `docs/releases/v2-handoff.md` 已列构建、迁移、环境变量、部署、回滚步骤；`docs/release-checklist.md` 已对齐现有发布脚本。7.4 已补生产验证和一次上一版回滚/恢复证据，详见任务行。
- 7.4 目标环境验收仍未完成：邮件到达与验证码生命周期、登录态、TTS 登录流程、社区知识管理 API、模型故障注入、人工签收待做；7.5 不得提前标 ✅。

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

### 6.1 任务登记（按时间倒序，完成与部分交付均在此登记）

| 日期 | 任务 ID | 执行者 | 证据（commit / 命令 / 文件） | 备注 |
| --- | --- | --- | --- | --- |
| 2026-10-27 | 5.4/7.3 生产发布与公网复核（部分，Lead） | AI-1（Lead） | PR #15 合并 `f34b05e`；master Quality [run 40473264194](https://github.com/lwenjie04/ai-campus-agent/actions/runs/40473264194) 五 job 全绿；Deploy [run 40473427797](https://github.com/lwenjie04/ai-campus-agent/actions/runs/40473427797) success；线上 release `f34b05e86ac30d2b69de926bd099e5537c31d749-40473427797-1`；公网 `/api/health` 200、`/services` 与新 JS 200；真实问答“奖学金 10000/6000、助学金 3700、手册旧标准过时”与来源正确，非金额问题不注入 | 5.4 政策提示已上线并复核，但 5.4 仍保持 🟡（旧手册数据/缺正文/逐题核验/7.4 人工签收未完成）；7.3 仍等 Top 50 接入 |
| 2026-10-27 | 0.2 响应式与控件状态补充稿（完成） | AI-2（Codex）+ 人工 | `42a9bd1` + `5d6b8b7`；9 张 PNG 签名与预期尺寸检查 9/9；`git diff --check` 通过 | `33:176`（390×844）与 `33:212`（1024×880）均已导出归档；P1 未绘图标等缺项已记录在设计说明，不阻塞本项 |
| 2026-10-27 | 0.2 手动补充画板导出（部分） | 人工 + AI-2（Codex） | `42a9bd1`；`docs/design/10-34/390-home.png`；390×844；PNG 签名有效；`git diff --check` 通过 | `33:176` 已归档，累计 8/9；`回答区背景.png` 是 684×820 纯色背景层，不作为画板；仅剩完整 `33:212` 问答画板待导出，0.2 保持 🟡 |
| 2026-10-27 | 5.4 现行政策提示内容签收（完成，Lead） | AI-1（Lead）+ 人工 | `e9385d1`；`server/data/policy-updates.json` 状态 `signed-off`（`signedAt`/`signedBy`/`signedNote`）；新增签收守卫测试；`policy-updates` 9 条、`test:server` 78/78、`server:check` 83 模块、定向 ESLint/oxlint 0 error、`git diff --check` 通过 | 用户 2026-10-27 确认修改后的政策文案可签收；正式上线仍需正常推送/CI/部署与 7.4 流程，部署后需公网复核金额问答与来源；5.4 整体保持 🟡 |
| 2026-10-27 | 5.4 现行政策提示上线前确认（部分，Lead） | AI-1（Lead） | `c78b94f` + `a7109da`；`policy-updates` 8 条测试；`test:server` 77/77；`server:check` PASS 83 modules；Top 20 20/20、Top 50 50/50 + 负例 10/10；真实 DeepSeek 金额问答回答 10000/6000/3700 并正确标注旧标准过时，来源前置且去重；非金额问题不注入；`git archive HEAD` 含 `server/data/policy-updates.json`；缺失文件时静默关闭；定向 ESLint/oxlint 0 error、`git diff --check` 通过 | 技术层面可上线；`policy-updates.json` 仍待人工签收，且需正常推送/CI/部署与 7.4 流程；5.4 保持 🟡 |
| 2026-10-27 | 5.4 A 方案落地：双期望与现行政策提示（部分，Lead） | AI-1（Lead） | `1b9afbf` + `9f19d6c`；12 题目录诊断 12/12（关键词/向量一致）；Top 20 20/20、Top 50 50/50 + 负例 10/10（关键词/向量）；`test:server` 74/74；`server:check` PASS 83 modules；新增 `policy-updates` 5 条测试；定向 ESLint/oxlint 0 error、`git diff --check` 通过 | 用户 2026-10-27 拍板：转专业接受双 Top1；新增金额类“现行政策提示”数据（2024 国家通知 + 2025 学校通知），注入 RAG/LightRAG 上下文并前置来源，不改手册原文。政策提示待人工签收；缺正文/逐题核验未完成，5.4 保持 🟡 |
| 2026-10-27 | 5.4 检索排序与长句召回（部分，Lead） | AI-1（Lead） | `5ecb8c4`；12 题目录诊断 9/12→11/12（关键词/向量一致）；Top 20 关键词/向量 20/20；Top 50 草案 50/50 + 负例 10/10；`test:server` 69/69；`server:check` PASS 81 modules；新增 `rag-long-query-recall` 2 条；定向 ESLint/oxlint 0 error、`git diff --check` 通过 | 补 2 字领域词与标题加权，修复调宿长句召回和补考通知落后于手册的问题；转专业题期望待人工复核；旧金额/缺正文/人工签收未完成，5.4 保持 🟡 |
| 2026-10-27 | 5.4 时间语义与检索时效（部分，Lead 接手） | AI-1（Lead，接手 AI-2 Codex） | `e07465d`；`docs/golden-source-review-2026-10-27.md` 补充接手记录；`npm run kb:prepare:offline` 通过（660 chunks，33 条手册 `updatedAt` 为空）；`npm run test:server` 67/67；`npm run server:check` PASS 80 modules；Top 20 关键词/向量 20/20；Top 50 草案 50/50 + 负例 10/10；12 题目录诊断关键词/向量各 9/12；定向 ESLint/oxlint 0 error、`git diff --check` 通过 | 修复 DOCX mtime 误作制度更新时间；RAG/LightRAG 上下文补时效/缺正文/冲突规则；新增诊断集与结果（非金标）。旧金额冲突、缺正文、排序/切分和人工签收未完成，5.4 保持 🟡 |
| 2026-10-27 | 0.2 响应式与控件状态补充稿（部分） | AI-2（Codex） | `162f912`；Figma Export 归档 7 张 PNG；PowerShell 检查 PNG 签名和尺寸 7/7；`git diff --cached --check` 通过；控件画板调整后截图检查通过 | `35:134` 次要操作标题 y=222→204，已无重叠；Figma Starter 调用上限挡住 `33:176`、`33:212` 导出，0.2 保持 🟡 |
| 2026-10-27 | 5.4 金标来源核对（部分） | AI-2（Codex）+ 人工待确认 | `bb73414`；`docs/golden-source-review-2026-10-27.md`；关键词和向量离线标题评估各 50/50 正例、10/10 负例；`node server/tests/rag-golden-evaluator.test.mjs` 4/4；学校通知 PDF 第 3 页与国家 2024 文件相互印证；`git diff --cached --check` 通过 | 纠正迟到题备选标题；离线库复现旧金额条目进入 Top 3。已有通知正文缺失、旧制度时效、DOCX 日期误标和回代评估等缺口；逐题核验与人工签收未完成，保持 🟡 |
| 2026-10-26 | 5.4 目录与金标核对（部分） | AI-2（Codex）+ 人工（来源时效复核） | `c8e3979`；`npm run kb:prepare:offline` 通过；Top 50 关键词与向量评估均为 50/50 正例、10/10 负例；`npm run test:server` 64/64；定向 ESLint、`git diff --check` 通过 | 修正手册来源标题/分类/关键词抽取及 RAG 召回/排序；新增四项检索回归测试。部分旧制度、试行制度和年度资助来源仍需人工确认，5.4 保持 🟡；7.3 暂不纳入 Top 50 |
| 2026-10-26 | 5.3 事项搜索与提问桥接（完成） | AI-1（Lead） | `78fdb55`；`npm run type-check` 通过；`npm run build` 通过（1667 模块）；`npm run test:unit` 129/129（新增 18）；`oxlint .` 0 error；`eslint src` 0 error；`git diff --check` 通过 | 搜索只匹配事项标题与关键词并写入 `?q=`；无结果保留搜索词并提供转问；转问只预填 `/chat/new` 草稿并聚焦，不发送、不发请求；卸载后重挂载验证刷新不重发；问题正文不写入 URL；未认领其他任务 |
| 2026-10-26 | 5.2 指南列表与详情（完成） | AI-1（Lead） | `f63f865`；`npm run type-check` 通过；`npm run build` 通过（1667 模块）；`npm run test:unit` 111/111（新增 21）；`oxlint .` 0 error；`eslint src` 0 error；`git diff --check` 通过 | 分类筛选来自 URL，返回保留列表状态；详情按 serviceId 从已确认目录取数；`actionUrl` 为空不渲染办理入口，旧年度通知只作来源参考；首页四卡与加号落点已单测；5.3 未认领 |
| 2026-10-26 | 5.1 事项清单（完成确认） | AI-2（Codex）+ 人工 | `8f0ec93`；12 项/四类各 3/ID 唯一/必需字段完整/`actionUrl` 全空；人工确认记录在本轮 | 年度通知按来源参考展示，不能当作当前办理规则；5.1 验收完成，5.2/5.3 可开始 |
| 2026-10-26 | 5.1 事项清单（部分） | AI-2（Codex，来源草案） | `docs/service-catalog-v2.json`、`docs/service-catalog-v2.md`；结构检查：12 项、四类各 3、ID 唯一、必需字段完整、`actionUrl` 全空；`git diff --check` 通过 | 基于 2025 年学生手册和仓库已导入的学校通知；部分制度旧、年度通知过期，官网实时可访问性与 2026–2027 办理流程未核验。草案不显示办理入口，5.1 保持 🟡 等人工核对 |
| 2026-10-26 | 7.4 Embedding 配置只读核验（部分） | AI-2（Codex） | `https://maila.club/api/health` HTTP 200；只读 SSH（`ubuntu`→sudo）；后端运行配置 provider=`hash` / model=`hash-256`，向量 API 地址/密钥/模型未设置；LightRAG 独立配置的 embedding 字段非空但未读取其值；PM2 两服务 online，LightRAG 内网 health 可达 | 后端真实向量 Embedding 未生效；LightRAG 文件权限 600、修改时间 2026-07-21。未调用 Embedding API，密钥有效性与检索质量仍待验证；7.4 保持 🟡 |
| 2026-10-23 | 0.2 响应式与状态补稿（部分） | 人工确认 + AI-2（Codex） | Figma `10:34` 的节点 `33:92`、`33:135`、`33:176`、`33:212`、`33:259`、`33:300`、`33:332`、`33:355`、`35:134`；预览检查 390 首页、390 来源抽屉、控件状态；设计说明见 `docs/design/` | 1024/768/390 首页与问答、移动登录/办事指南、按钮/输入框/来源面板状态已补；仍需导出 PNG 归档和微调次要按钮区标题间距，保持 🟡 |
| 2026-10-23 | 0.2 补齐 Figma 页面与状态（完成） | 人工确认 + AI-2 归档 | `71dcb6b`；9 个导出画板文件均存在；`docs/design/README.md`、`copy.md`、`tokens.md`、`interaction.md` | P0 页面/状态稿和准确文案齐备；明确记录未提供的移动/响应式画板。P1 组件变体与补充图标缺项保留在设计文档，不影响本项完成 |
| 2026-10-23 | 5.4 目录与金标核对（部分） | AI-2（Codex）+ 人工待核对 | `dcca658`；`npm run kb:prepare:offline`：手册 33 条 + 通知 396 条，生成 660 个 chunk/hash vectors；`npm run test:server` 60/60；Top 20：20/20；草案：50 正例结构配额 15/10/15/10、10 负例；合并来源库与向量评估 31/50（62%）、3/10 负例（30%），未达阈值；改动文件定向 ESLint、`oxlint .`、目标文件 Prettier 与 `git diff --check` 通过 | 新增 Top 50 草案与结构测试；手册 DOCX 可重建，导入分类在目录标题纠正后重新推断。全量 `npm run lint` 被既有未跟踪 `server/scripts/robot-preview-browser.mjs` 的 `WebSocket` no-undef 阻断；该文件未改动。来源有效性与 5.1–5.3 覆盖未人工核对，检索/负例结果不合格，维持 🟡 |
| 2026-10-23 | 7.4 生产邮件到达确认（部分） | AI-2（Codex） | 用户确认已收到生产邮箱检测邮件；本次仅记录人工确认，未读取/记录收件地址或验证码 | 邮件到达检查由用户确认通过；真实注册验证码全流程的到达、过期与重发仍未验证。登录和登录态 TTS 按用户决定暂缓，真实 Embedding 密钥待用户在服务器配置；7.4 继续保持 🟡 |
| 2026-10-23 | 7.4 目标环境验证（部分） | AI-2（Codex） | 生产 release `a6f94f3d9dacae5e5b6630172a6c01cf3b09d18f-39893338172-1`；公网 `/api/health`、匿名 TTS 401、真实 LLM 首段后取消、响应式 10/10；部署脚本回滚到 `7115da6...` 后恢复，健康检查通过；备份恢复检查通过 | 完整证据与未完成项见 §3 的 7.4 行；响应式结果 `server/evals/production-7.4-responsive-full-20261023.json` 和 10 张截图；7.4 继续保持 🟡，尚无用户试用或人工签收 |
| 2026-10-23 | 7.4 生产 MySQL 与反馈闭环（部分） | AI-2（Codex） | `npm run test:server` 56/56；生产 MySQL 5.7.44 增量迁移成功，表/唯一键/FK 检查通过；事务验证写入、幂等 upsert 与 rollback 清理；公网 `/api/chat/stream` 200 且 `feedbackEligible:true`，`/api/feedback` 200，数据库持久化读回后清除测试行；备份 SHA-256 `b8aaab1b5ee88a80230ac3e19c9e0a36364babe9e0c25d91e055b2a3d1c545ed` | 迁移 collation 调整为 MySQL 5.7/8.0 兼容；生产备份路径 `/var/backups/ai-campus-agent/ai_campus_agent_pre_chat_feedback_20261023T034120Z.sql.gz`（600）。7.4 仍待邮件实投、登录/TTS 边界、取消/资源、回滚演练、Embedding 凭据；7.3 等 5.4 Top 50 |
| 2026-10-23 | 7.4 目标环境验证（部分） | AI-2（Codex） | 生产 `service-smoke.mjs` 4/4；真实 DeepSeek、LightRAG、SMTP verify、腾讯 TTS；`npm run responsive:matrix`（`RESPONSIVE_BASE_URL=https://maila.club`、宽度 390/1440）4/4；公网 `/api/chat/stream` POST HTTP 200，事件 `start,phase,phase,delta×2,meta,done`；`server/evals/production-7.4-responsive-20261023.json` 与 4 张首页/问答截图 | Nginx 备份后修复 SPA 回退与 SSE 无缓冲代理，`nginx -t`、reload 和页面路由 HTTP 200 通过。记录当时 MySQL 增量表尚未应用；后续迁移与反馈闭环证据见本节新登记行。真实 Embedding 与 5.4 Top 50 未完成，7.4 保持 🟡 |
| 2026-10-23 | 7.3 最新生产发布核验（部分） | AI-2（Codex） | `7115da6`；Quality [run 39890973878](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39890973878) 5/5 jobs；Deploy [run 39891110847](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39891110847) success；线上 release `7115da6ea3113d51442c5bd005c1baddf0906771-39891110847-1`；公网 `/api/health` releaseId 匹配，首页 HTML SHA256 与 release `dist/index.html` 一致，JS 资源 HTTP 200；Certbot timer active，`certbot renew --dry-run` 通过，证书有效至 2027-01-21 | 最新提交已实际部署并通过公网校验；7.3 保持 🟡，等待 5.4 Top 50 和 7.4 真实目标环境验证 |
| 2026-10-23 | 7.3 自动部署实机与证书续期（部分） | AI-2（Codex） | 23d81b4；Quality run 39887012403 5/5 jobs；Deploy run 39887175711 attempt 2 success；Git Bash bash -n .github/deploy-remote.sh、node --check ecosystem.config.cjs、npx prettier --check docs/cicd-deployment-setup.md、git diff --check；服务器 certbot renew --dry-run、Nginx -t、首页 SHA256、JS 200、API releaseId 检查均通过 | PM2 从新 release 目录启动，Let's Encrypt 证书与自动续期生效，公网已提供该 release。7.3 仍等 5.4 Top 50，7.4 真实环境项未完成 |
| 2026-10-22 | 7.3 自动部署配置（部分） | AI-2（Codex） | `.github/workflows/deploy.yml`、`.github/deploy-remote.sh`、`ecosystem.config.cjs`、`server/index.mjs`、`server/tests/api-aliases.test.mjs`、`docs/api-contract-v2.md`；`npm run test:server` 56/56、`npm run lint`、`npm run server:check` 75 模块、`bash -n .github/deploy-remote.sh`、`node --check ecosystem.config.cjs`、部署配置/文档 Prettier 与 `git diff --check` 通过 | CI 成功后可对默认分支部署同一 commit；run 39733796352 卡在文件上传并于 25 分钟上限取消；run 39737153891 的 SSH 回滚命令成功，但 SCP 上传在 3 分钟后超时，未激活新版本。本次改为通过 SSH 标准输入流式写入发布包，并为传输和远端 SSH 增加连接/运行超时、keepalive 与阶段日志；首次实机部署与 7.4 验收待通过，7.3 Top 50 仍待 5.4 |
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
| 2026-10-27 | 上线 | PR #15（`release/policy-notes-20261027` → master）合并为 `f34b05e`，42 个提交随 Deploy #35 上线；线上 release 与公网金额/助学金问答、来源、非金额问题均已复核。5.4 保持 🟡 等 7.4 人工签收 | AI-1（Lead） |
| 2026-10-27 | 完成 | 0.2：9 张响应式与控件状态补充画板全部导出并归档，包括 390 首页和 1024 问答/来源；PNG 签名和尺寸检查 9/9。S0 为 4/4，整体 35✅/4🟡；P1 未绘独立关闭/附件 SVG 等已在设计说明记录，不影响本任务 | AI-2（Codex）+ 人工 |
| 2026-10-27 | 部分 | 0.2 提交 `42a9bd1`：人工导出并归档 `33:176` 移动首页（390×844，`390-home.png`）；`回答区背景.png` 是 684×820 纯色背景，不计为完整画板。累计 8/9，仍缺 `33:212` 问答与来源整屏，状态保持 🟡 | AI-2（Codex）+ 人工 |
| 2026-10-27 | 完成 | 现行政策提示内容签收（`e9385d1`）：用户确认修改后文案，数据状态改为 `signed-off` 并记录签收信息，新增 CI 守卫测试；政策提示可进入发布流程，5.4 整体仍待发布验证与人工发布签收 | 人工 + AI-1（Lead） |
| 2026-10-27 | 验证 | 现行政策提示补全国助学金标准（`a7109da`）：按财教〔2024〕181 号补入 2024 年秋季起平均 3700 元、学校 2500—5000 元自主分档；真实 DeepSeek 回答正确且说明无法确认具体档次；`test:server` 77/77、`policy-updates` 8 条。技术可上线，内容待签收 | AI-1（Lead） |
| 2026-10-27 | 验证 | 5.4 现行政策提示上线前确认（`c78b94f`）：真实 DeepSeek 金额问答返回 10000/6000 且标注手册旧标准过时，来源前置去重；非金额问题不注入；数据缺失静默关闭；服务端 76/76、金标与诊断无回归。技术可上线，内容待人工签收 | AI-1（Lead） |
| 2026-10-27 | 部分 | 5.4 A 方案落地：`1b9afbf` 转专业题双期望（诊断 12/12）；`9f19d6c` 现行政策提示数据与注入（金额类 10000/6000 覆盖旧手册 8000/5000，政策来源前置）。服务端 74/74、金标与诊断无回归；政策提示与缺失正文、逐题核验、人工签收仍未完成，5.4 保持 🟡 | AI-1（Lead） |
| 2026-10-27 | 决策 | 用户对 5.4 两项拍板：转专业题接受 2018 手册规定与 2025 通知任一 Top1，并注明本学年通知缺失；旧金额冲突采用“现行政策提示”数据方案（基于 2024 国家通知 + 2025 学校评审通知，注入上下文并展示来源，不改手册原文），人工签收时确认。由 Lead 落地 | 人工 + AI-1（Lead） |
| 2026-10-27 | 部分 | 5.4 第二轮检索调整 `5ecb8c4`：新增 2 字领域词与标题加权，12 题诊断 9/12→11/12，Top 20/Top 50 金标无回归；唯一剩余失败为转专业题（期望 2025 年旧通知 vs 2018 年手册规定，待人工复核）。5.4 保持 🟡 | AI-1（Lead） |
| 2026-10-27 | 占用 | 继续领取 5.4（AI-1/Lead）：补中文查询切分与领域词、收紧时效排序，目标是提升 12 题目录诊断且不回归 Top 20/Top 50 金标；完成后按部分交付登记 | AI-1（Lead） |
| 2026-10-27 | 部分 | 接手 5.4 未完成改动并收口：`e07465d` 修复手册时间语义、RAG/LightRAG 时效规则，新增 `rag-currentness` 测试与 12 题目录诊断集；服务端 67/67、Top 20/Top 50 金标无回归；诊断 9/12 暴露旧制度压制、排序与查询切分问题。剩余见 5.4 行，保持 🟡 | AI-1（Lead） |
| 2026-10-27 | 接管 | AI-2 额度中断后由 Lead 接手 5.4：接手其未提交的 DOCX 时间语义修复、RAG/LightRAG 时效规则、`rag-currentness` 测试与 12 题诊断集，负责验证、收口与登记 | AI-1（Lead） |
| 2026-10-27 | 占用 | 重新领取 5.4：继续核验金标题目来源和时效，修复可由仓库语料证明的错误，更新独立问题评估；保留需要人工确认的政策项 | AI-2（Codex） |
| 2026-10-27 | 部分 | 0.2：微调 Figma 控件稿标题间距；7/9 张响应式/状态板已导出并归档，剩余 `33:176`、`33:212` 因 Figma Starter 调用上限未导出；`162f912` | AI-2（Codex） |
| 2026-10-27 | 占用 | 领取 0.2：导出 Figma `10:34` 页面 9 张响应式/状态补充画板并归档；微调 `35:134` 次要操作标题与状态标签间距 | AI-2（Codex） |
| 2026-10-27 | 部分 | 5.4 来源核对提交 `bb73414`：记录学校通知与国家政策、纠正迟到题错误备选标题；确认旧金额冲突及通知正文缺失，离线检索可返回旧金额。标题评估仍为正例 50/50、负例 10/10，但不证明回答正确或制度现行；剩余逐题核实、时效修复和人工签收 | AI-2（Codex） |
| 2026-10-27 | 占用 | 重新领取 5.4：核查金标题目与手册、学校官方通知的来源及制度时效，记录可证实和待人工确认的项目 | AI-2（Codex） |
| 2026-10-26 | 部分 | 5.4 代码提交 `c8e3979`：修正手册导入器误分类/误提关键词与检索泛化误召回；Top 50 关键词、向量评估各 50/50 正例、10/10 负例，`npm run test:server` 64/64。人工来源时效复核未完成，5.4 保持 🟡，Top 50 暂不接入 7.3 | AI-2（Codex） |
| 2026-10-26 | 占用 | 领取 5.4 Top 50 金标核对与检索质量修复；5.1–5.3 已完成，先检查现有 50 正例/10 负例、来源证据和检索流水线，再决定最小修复范围 | AI-2（Codex） |
| 2026-10-26 | 完成 | 5.3 交付：办事指南搜索只匹配事项标题与关键词，搜索词写入 `?q=`；无结果保留搜索词并提供“向校答提问”；转问只预填并聚焦输入框，不自动请求模型，刷新只恢复草稿不重发；补齐搜索/转问/预填/刷新单测。证据见 §6.1；本轮只做 5.3，未认领其他任务 | AI-1（Lead） |
| 2026-10-26 | 占用 | 领取 5.3 事项搜索与提问桥接：在办事指南列表实现标题/关键词搜索并写入 URL，无结果转问只预填草稿并聚焦，不自动请求模型；补单测；本轮不认领其他任务 | AI-1（Lead） |
| 2026-10-26 | 完成 | 5.2 交付：列表按 `teaching`/`exam`/`scholarship`/`life` 四类筛选并写入 URL，返回保留列表与滚动；详情展示事项说明、关键词与来源参考；`actionUrl` 为空隐藏办理入口，不展示旧年度办理时间与步骤；无效事项显示空态。证据见 §6.1；仅改 `src/**`，未认领 5.3 | AI-1（Lead） |
| 2026-10-26 | 占用 | 领取 5.2 指南列表与详情：按已确认的 12 项目录实现分类筛选、列表、详情、空态和无效事项；筛选写入 URL，返回列表保留状态，联调首页四卡与加号落点；只改 `src/**`，本轮不认领 5.3 | AI-1（Lead） |
| 2026-10-26 | 完成 | 用户确认 5.1 的 12 项范围可用，旧年度通知仅作来源参考，未核实的办理入口不展示。事项目录状态改为 `approved-topic-directory` / `publishable: true`，只供主题列表和提问模板使用；动态年度流程仍须回答时查最新学校通知。5.1 ✅，5.2/5.3 可据此开工。 | AI-2（Codex）+ 人工 |
| 2026-10-26 | 部分 | 认领并整理 5.1 来源草案：新增 12 个办事事项，教务/考试/奖助/生活各 3 项；数据含稳定 ID、关键词、用途、问题模板、来源定位和检查日期。年级/学期通知时效、手册中旧版制度及线上办理入口仍需人工核对；未核实的办理链接保留为空，5.1 维持 🟡。 | AI-2（Codex） |
| 2026-10-26 | 部分 | 只读核验生产配置：公网 `/api/health` 200，当前 release 仍为 `a6f94f3…`；SSH 连接到 VM-24-7-ubuntu 后仅查看配置项是否非空、权限/修改时间、PM2 状态和本机 LightRAG health，未输出密钥或改动/重启服务。后端有效向量 provider 仍是 `hash-256`，真实 Embedding API 地址/密钥/模型缺失；独立 LightRAG 配置有 embedding 项且服务健康，但配置文件最后修改于 2026-07-21，未发起真实 Embedding 请求。7.4 继续 🟡 | AI-2（Codex） |
| 2026-10-23 | 占用 | 重新领取 0.2：检查原有 P0 设计包，补齐 1024/768/390 响应式画板、390 来源抽屉及按钮/输入框/来源面板状态 | AI-2（Codex） |
| 2026-10-23 | 校正 | 更正此前将 0.2 标为完成的记录：`71dcb6b` 只归档 9 个 P0 导出画板，未覆盖本任务要求的响应式和控件状态稿；本轮重新打开 0.2，状态按当前明细改为 🟡 | AI-2（Codex） |
| 2026-10-23 | 部分 | 在 Figma `10:34` 页面新增 1024/768/390 首页与问答、390 来源抽屉/登录/办事指南及按钮/输入框/来源面板状态；预览检查 390 首页、390 来源抽屉和控件状态；同步 `docs/design/README.md`、`copy.md`、`tokens.md`、`interaction.md`。Figma Starter MCP 达到调用上限，尚未导出新增画板 PNG，且控件稿一个分组标题间距待微调；0.2 保持 🟡。总览为 31✅/5🟡/0🔵/3⬜ | AI-2（Codex） |
| 2026-10-23 | 完成 | 0.2 视觉交付按 P0 验收完成：归档 9 个 Figma 导出画板及文案、token、交互材料；移动稿缺项明确标注，P1 控件状态和响应式稿缺项保留记录。总览更新为 32✅/4🟡/3⬜ | AI-2（Codex） |
| 2026-10-23 | 校正 | 按任务明细同步总览统计：5.4 已为 🟡，因此 S5 调整为 0✅/1🟡/3⬜，全表调整为 31✅/5🟡/3⬜；其余任务状态未变 | AI-2（Codex） |
| 2026-10-23 | 占用 | 5.4 修改 `package.json` 的离线知识库准备脚本，并调整 `.github/workflows/quality.yml` 继续使用同一可重复入口；保留既有 Top 20 门禁，待 5.1–5.3 目录和人工核对完成后再升级 Top 50 | AI-2（Codex） |
| 2026-10-23 | 部分 | `dcca658`：5.4 从跟踪的学生手册 DOCX 重建来源并纳入离线 chunks/hash index；新增 30 条 Top 50 候选题和 10 条无命中负例，结构满足四类配额。修正 DOCX 导入器在目录标题回填后仍保留旧分类的问题；Golden evaluator 支持额外来源库路径，并分别报告正例 Top1 与负例拒答指标。原 Top 20 仍 20/20；合并来源评估 31/50、3/10，未达门槛。Top 50 不进入 CI，等待 5.1–5.3 事项目录、人工核对与检索质量修复 | AI-2（Codex） |
| 2026-10-23 | 部分 | 用户确认收到生产邮箱检测邮件，记录 SMTP 邮件到达检查通过；不代表注册验证码过期/重发流程已验证。按用户决定，管理员登录与登录态 TTS 实测暂记阻塞；真实 Embedding API 密钥由用户在服务器配置后再验。7.4 维持 🟡，不设置人工发布确认标志 | AI-2（Codex） |
| 2026-10-23 | 部分 | 7.4 生产 MySQL 与反馈闭环通过：先以受限权限创建并校验 gzip 数据库备份，再对 MySQL 5.7.44 应用仅增量迁移；为兼容 5.7 将新表 collation 从 `utf8mb4_0900_ai_ci` 调整为 `utf8mb4_unicode_ci`。唯一键、外键、事务写入、幂等 upsert 及测试数据回滚均通过；公网流式问答返回 `feedbackEligible:true`，反馈接口 HTTP 200 且数据库读回成功，之后清理测试行。`npm run test:server` 56/56。7.4 仍保持 🟡，未完成项与备份校验值登记在 7.4 行及 §6.1 | AI-2（Codex） |
| 2026-10-23 | 部分 | 7.4 已完成生产服务与前端路由部分验收；发现原 Nginx 将 `/chat`、`/community` 整段转发到后端且缺少 SPA fallback，导致问答/社区/审核页面 404。备份 `/www/server/panel/vhost/nginx/html_maila.club.conf` 后改为前端路由回退、保留精确 `/chat/stream` 兼容，并为 `/api/chat/stream` 增加无缓冲代理；回滚备份为同目录 `*.codex-20261023-7.4-pre-spa.bak` 和 `*.codex-20261023-7.4-pre-sse.bak`。`nginx -t`/reload、公网 6 条路由、真实 SSE、390/1440 响应式矩阵均通过。MySQL 的 `chat_request_receipts` 与 `chat_feedback` 仍缺，未在未备份前改生产数据库；真实 Embedding 与 5.4 Top 50 仍待完成 | AI-2（Codex） |
| 2026-10-23 | 占用 | `000135e` 领取 7.4 目标环境验证与性能；先检查生产环境依赖是否配置、只核验变量名和服务健康，再按安全边界验证真实集成与性能；50 条金标等待 5.4 | AI-2（Codex） |
| 2026-10-23 | 部分 | 补记 7.3 最新发布证据：`7115da6` 的 Quality run 39890973878 五个 job 全绿，Deploy run 39891110847 success；线上 current release 为 `7115da6ea3113d51442c5bd005c1baddf0906771-39891110847-1`；公网首页 HTML SHA256 与 release 一致、JS 资源 200、`/api/health` releaseId 匹配。7.3 维持 🟡，仍待 5.4 Top 50 与 7.4 真实目标环境验收 | AI-2（Codex） |
| 2026-10-23 | 阶段验证 | 7.3 实机部署完成：push 23d81b4 后 Quality 5/5 通过；首次 Deploy attempt 1 因 maila.club 原 TrustAsia 证书过期而回滚。安装 Certbot、配置独立 HTTP-01 目录与 Nginx renew hook，签发 Let's Encrypt 证书（至 2027-01-21）；certbot renew --dry-run 通过。重跑 Deploy attempt 2 全绿，公网首页 HTML SHA256 与 current/dist/index.html 一致、JS 资源 200、API releaseId 精确匹配。Nginx 当前静态根为 /var/www/ai-campus-agent/current/dist。剩余仅 5.4 Top 50 与 7.4 目标环境验证 | AI-2（Codex） |
| 2026-10-23 | 部分 | 两次首次部署均已成功上传；run 39745301735 与 39746496435 在本机健康检查失败后自动回滚。服务器只读核验发现 PM2 后端仍以 `/www/ai-campus-agent` 为 cwd，健康请求因此落到旧进程。修正 `.github/deploy-remote.sh`：按 `current` 的真实 release 目录删除并重建后端 PM2 进程，回滚复用同一启动路径；文档注明短暂 API 重启。已跑 Git Bash `bash -n .github/deploy-remote.sh`、`node --check ecosystem.config.cjs`、`npx prettier --check docs/cicd-deployment-setup.md`、`git diff --check`；待新 CI/CD、本机与公网健康验证及 Nginx 静态根切换 | AI-2（Codex） |
| 2026-10-22 | 部分 | `005d964` 的 Quality run `39744028916` 五个 job 全绿；deploy run `39744208752` 在 10 分钟上限前未传完 16,562,258 字节发布包，旧版仍稳定在线。更正前一条日志：看到的 4.65 MB 是未完成的流式文件，不是完整包或 EOF 故障。`a059a93` 改为远端按准确长度读取；新 Quality run `39745108274` 五项全绿；deploy run `39745301735` 上传、解压成功但本机健康检查失败并自动回滚；deploy run `39746496435` 同因 PM2 沿用旧 cwd 而回滚，服务器核验确认请求命中 `/www/ai-campus-agent`。为适应实测带宽，将上传限时调至 20 分钟、部署 job 调至 50 分钟 | AI-2（Codex） |
| 2026-10-22 | 部分 | commit `005d964` 的 Quality run `39744028916` 五个 job 全绿。Deploy run `39744208752` 的发布包 4,653,056 字节已完整到达 `/tmp`，但远端 `cat` 进程仍等待 SSH EOF；核对服务器确认 `current` 仍指向 `/www/ai-campus-agent`、无新 release、root PM2 两个服务在线，线上未切换。将上传改为远端 `head -c <包大小>` 精确读取，并校验写入字节数，避免依赖 EOF；待新 CI/CD 实测 | AI-2（Codex） |
| 2026-10-22 | 部分 | run 39741476125 完成归档上传并进入远程预检，但 `df` 因 `/var/www/ai-campus-agent` 尚不存在而失败。经用户授权核对生产主机：旧后端由 root PM2 运行于 `/www/ai-campus-agent`，宝塔 Nginx 静态根为 `/www/wwwroot/ai-campus-agent-web`，API 代理仍指向 3000。已创建新发布根目录和共享目录，将现有 `.env` 以 `600` 权限复制、保留 6 个数据文件和 2 个日志文件，并将 `current` 链接指向旧程序作为回滚点；未重启应用、未改 Nginx。PM2 两个进程仍在线，健康接口正常，配置/数据副本一致，Nginx `-t` 通过。下一步修正首次部署磁盘预检、用 root PM2 部署新版本，再切换静态根并做公网核验 | AI-2（Codex） |
| 2026-10-22 | 部分 | 用户截图对应 run 39738035106（Deploy production #25）：传统 SCP 上传仍以 exit code 124 超时；同一 job 后续 SSH 回滚命令成功并确认新版本未激活。停止使用 SFTP/SCP，改为将归档通过 SSH stdin 写入服务器临时文件，再执行原子部署脚本；继续用下次 run 确认上传与本地健康检查 | AI-2（Codex） |
| 2026-10-22 | 部分 | run 39739621879：Quality 五个 job 全绿；SSH stdin 发布包上传 3 分钟超时（exit 124），未运行远端部署或公网健康检查，回滚确认新版本未激活。排查发现发布包包含 `public/` 与 `dist/` 两份相同视频，并携带部署不需要的 docs/导入资料；本次改为仅打包 package manifests、ecosystem、server 与 dist，排除服务端测试/evals，上传前显示目标磁盘空间并执行 1 MiB 写入探测，上传超时延至 10 分钟 | AI-2（Codex） |
| 2026-10-22 | 部分 | 7.3 自动部署排查：同一 SHA 上 Dependabot 触发的多条 workflow_run 进入全局部署并发组，造成排队/取消噪声；将触发分支限制为 master、并发锁移到实际 deploy job。run 39733796352 在 25 分钟 job 上限取消；run 39737153891 中 scp 上传在 3 分钟后超时，但同一 job 的 SSH 回滚命令成功，确认密钥、host key 与远程命令通道可用，新版本未激活。推测服务器未兼容 OpenSSH scp 默认的 SFTP 传输，改用传统 SCP 协议继续验证；保留超时、keepalive 和阶段日志 | AI-2（Codex） |
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

| 2026-10-23 | 部分 | 7.4 补记生产验收：线上 release `a6f94f3d9dacae5e5b6630172a6c01cf3b09d18f-39893338172-1` 的真实 LLM 首段后客户端取消 2ms；匿名 TTS 401；响应式矩阵 360–1440 共 10/10；17M dist / 1.2M server；上一版回滚到 `7115da6...` 后恢复并通过公网健康检查；备份恢复验证 6 表/6 条社区知识数据。服务端 56/56。管理员登录一次返回 `AUTH_INVALID` 后停止重试；邮件送达/验证码生命周期、登录态 TTS、社区知识 API、embedding、模型故障注入和用户试用仍待完成。共享邮箱、临时管理员和 DBA 最小权限复核需要人工配合。7.4 保持 🟡，不设置人工发布确认标志 | AI-2（Codex） |
| 2026-10-27 | 完成 | D-5：261 个校园通知 JSON 已移至 `_ingest/project-text/exports/` 并保留；`node server/scripts/import-browser-export-json.mjs --dry-run` 扫描 261 份、0 新增/0 更新；两个导入脚本 `node --check` 通过，`git diff --check` 通过；提交 `417a2e8` | AI-2（Codex） |
| 2026-10-27 | 修正 | D-5 导入防重复：通用本地导入默认目录改为 `_ingest/local-text/`，通知 JSON 继续使用专用导入器；`node server/scripts/batch-ingest-local.mjs --dry-run` 为 0 扫描/0 新增，浏览器导入预览扫描 261 份、0 新增/0 更新；提交 `82cfbc2` | AI-2（Codex） |

---

## 7. 每轮开工前的 30 秒检查

1. `git status --short` —— 是否只有你负责的改动？
2. 本表状态是否与代码一致（有人偷偷改了文件）？
3. 你领的任务依赖是否都已 ✅？没有就先去催/换任务。
4. 改完跑门禁，然后回来标注 —— **不标注等于没做**。
