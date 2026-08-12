# Plan: 校园智能问答平台产品化优化路线

**Generated**: 2026-08-09
**Estimated Complexity**: High
**长期目标**: 用 6 周把当前“可答辩演示版”推进到“可供 30–50 名校内用户小范围试运营的可信问答产品”
**当前交付目标**: 比赛优先，近期执行 `docs/competition-roadmap-plan.md` 的 14 天冲刺路线

## 一、管理层结论

当前项目已经完成“功能闭环”，但还没有完成“产品闭环”。

- **演示完成度：约 80%**。Web 端具备问答、RAG 来源、数字人/TTS、登录注册、社区、管理员审核和知识沉淀链路；生产构建通过。
- **小范围试运营准备度：约 45%**。服务端权限、答案质量基线、用户反馈、运营指标、自动化测试仍然不足。
- **公开上线准备度：约 25%**。管理接口和 LightRAG 代理缺少服务端鉴权，默认管理员凭据仍出现在示例/部署文档中，尚不适合公网开放。
- **移动端准备度：约 20%**。已有页面与 API 骨架，类型检查通过，但 H5 构建失败，暂不能计入交付范围。

产品策略应从“继续增加功能”切换为：

> 聚焦教务、考试、奖助、生活服务四类高频事项，把“回答是否可信、是否解决问题、是否可运营”做实。

未来 6 周不建议投入实时数字人、模型微调、推荐流、私信、更多终端或复杂 Agent 编排。数字人继续作为展示差异点，但研发资源优先投向可信回答与试运营闭环。

## 二、现状证据

### 已具备的产品能力

1. Web 主链路
   - 首页问答与流式输出：`src/views/AgentChat.vue`、`src/store/agent.ts`、`src/api/llm.ts`
   - 来源展示与社区来源标识：`src/components/MessageItem.vue`
   - 数字人/TTS：`src/components/DigitalHumanPlayer.vue`、`server/tts.mjs`
   - 登录注册：`src/views/LoginView.vue`、`server/auth.mjs`
   - 社区发帖、回复、审核、知识沉淀：`src/views/CommunityView.vue`、`src/views/AdminReviewView.vue`、`server/community.mjs`
   - LightRAG + 本地检索回退：`server/lightrag.mjs`、`server/rag.mjs`

2. 数据与交付
   - 本地知识库共有 **396** 条文档，内容与抽样编码检查通过。
   - 已有数据库 SQL、部署清单、邮件/RAG/知识入库脚本。
   - Web 生产构建通过；后端 `.mjs` 文件语法检查通过。
   - 当前分支为 `feat/backend-rag`，跟踪远端同名分支，最近提交日期为 2026-08-04。

### 当前主要缺口

1. 权限与成本风险
   - `server/auth.mjs` 登录成功只返回用户信息，没有服务端会话或访问令牌。
   - 前端角色保存在 `localStorage`；管理员页面只是前端隐藏。
   - `server/community.mjs` 的审核、拒绝、知识生成等写接口没有服务端管理员校验。
   - `/lightrag` 代理会转发任意方法，未看到应用层管理员校验。
   - 默认管理员账号密码仍为 `admin/admin123`，并出现在部署说明中。
   - 问答、邮件验证码、TTS 未形成统一限流和成本保护策略。

2. 答案质量没有形成可发布门槛
   - 396 条知识中 `general` 有 214 条，生活服务仅 11 条、奖学金仅 17 条，覆盖明显失衡。
   - 存在 12 条重复标题记录、6 条缺少 URL；部分 URL 含会话式查询参数，需要验证长期可访问性。
   - `chunked-knowledge-base.json` 和 `vector-index.json` 当前缺失，实际可依赖的仍是关键词回退链路。
   - 5 个高频问法人工快速审查中，3 个首条结果直接相关；“补考怎么报名”“转专业需要什么条件”首条结果偏题。
   - 现有 RAG 脚本打印结果但不做断言，不能阻止质量回退。

3. 缺少产品运营闭环
   - 没有“有帮助/没帮助”、问题是否解决、来源点击、重新提问、失败原因等数据。
   - 没有未命中问题池和知识补齐看板，无法决定下一批知识建设内容。
   - 社区已有完整功能，但尚未证明它能提升问答覆盖率；当前投入规模大于可验证价值。

4. 工程交付仍偏原型
   - 根项目没有 `test` 脚本，也没有 GitHub Actions 质量门禁；`.github` 当前只有 Dependabot 配置。
   - 核心文件偏大：`server/community.mjs` 约 1494 行、`server/index.mjs` 约 1004 行、`AdminReviewView.vue` 约 1095 行、`AgentChat.vue` 约 928 行。
   - Web 主 JS 产物约 1.09 MB（gzip 约 358 KB），构建出现大包告警。
   - 移动端 H5 构建失败：`uni-app 2.x` 与 `vite-plugin-uni 3.x alpha` 依赖组合不一致。

## 三、产品定位与范围收敛

### 核心用户

- 首要用户：需要快速确认校园办事规则、时间、材料和入口的在校学生。
- 次要用户：负责答疑、审核与知识维护的学生工作/教务运营人员。
- 暂不优先：校外访客、教师科研服务、泛社交社区用户。

### 核心价值主张

“在 3 分钟内给出有正式来源、可执行、知道下一步去哪里的校园事项答案。”

### 试运营核心场景

1. 教务：选课、补退选、转专业、学业预警。
2. 考试：补考、重修、四六级、考试安排。
3. 奖助：国家奖学金、励志奖学金、助学金、材料要求。
4. 生活服务：宿舍、报修、校车、假期安排。

### 明确非目标

- 不做通用聊天机器人。
- 6 周内不做模型微调、实时数字人、情感识别、复杂推荐算法、私信或多级评论。
- Web 试运营未达到质量门槛前，不并行扩大小程序/移动端范围。

## 四、北极星指标与发布门槛

### 北极星指标

**可信问题解决率**：用户提交问题后，回答有有效来源，且用户反馈“已解决/有帮助”的会话占比。

### 6 周试运营门槛

- Top 50 高频问题首条检索准确率 ≥ 85%。
- 有正式来源的回答占比 ≥ 90%。
- “有帮助/已解决”反馈率 ≥ 70%。
- 无结果或低置信回答 100% 进入待补齐问题池。
- 首字响应 P95 ≤ 2.5 秒；完整回答 P95 ≤ 12 秒。
- 管理端未授权写操作成功数 = 0。
- 试运营时段服务可用性 ≥ 99%。
- 社区审核 SLA ≤ 24 小时；社区知识进入问答后的负面反馈率不高于官方知识回答。

### 最小事件集

- `question_submitted`
- `answer_started`
- `answer_completed`
- `source_clicked`
- `answer_feedback_submitted`
- `answer_retry_clicked`
- `community_post_created`
- `review_completed`
- `knowledge_gap_created`

所有事件至少包含匿名用户/会话标识、问题分类、requestId、RAG 命中情况、耗时和错误码；禁止记录密码、验证码和不必要的个人信息。

## 五、优先级

### P0：试运营前必须完成

1. 服务端认证、管理员授权、用户身份绑定。
2. 默认凭据治理、验证码/登录/问答/TTS 限流、LightRAG 管理入口保护。
3. Top 50 高频问题金标集与自动化评测门禁。
4. 知识去重、失效链接检查、切片与向量索引可重复构建。
5. 回答反馈、未命中问题池、基础运营数据。
6. API 冒烟测试、关键前端流程测试、CI 构建门禁。

### P1：试运营体验优化

1. 低置信度时先追问澄清，不直接生成确定性答案。
2. 来源有效期、更新时间和官方/社区可信等级展示。
3. 常见事项快捷入口、可复制步骤、办事材料清单。
4. 正式路由与可分享深链；降低超大单文件和首屏包体积。
5. 社区收敛为“问题补充与经验沉淀”，不追求泛论坛活跃度。

### P2：指标达标后再投入

1. 修复并统一移动端依赖，完成 H5/小程序构建。
2. 会话云端历史、多端同步、消息通知。
3. 更自然的数字人口播、ASR、动作联动。
4. 更复杂的 Agent 工作流或模型微调。

## 六、6 周实施路线

## Sprint 0（第 1–3 天）：冻结基线与明确责任边界

**Goal**: 形成可重复验证的当前版本，停止无指标扩功能。
**Demo/Validation**:

- Web 构建、后端语法检查、5 条 RAG 冒烟结果可在一条命令中复现。
- 确认 50 条高频问题清单、试运营用户范围和知识维护负责人。
- 建立“必须修复/试运营后/不做”三段式 backlog。

### Task 0.1：建立发布基线脚本

- **Location**: `package.json`、`server/scripts/`
- **Description**: 新增只读验证命令，串联 Web 构建、后端语法、RAG 冒烟和配置检查。
- **Dependencies**: 无。
- **Acceptance Criteria**:
  - 本地与 CI 使用同一命令。
  - 任一必需检查失败时返回非零退出码。
- **Validation**: 干净环境运行一次并保存结果。

### Task 0.2：冻结试运营范围

- **Location**: `docs/` 新增试运营范围文档。
- **Description**: 明确四类核心场景、30–50 名用户、2 周试运营周期和不做项。
- **Dependencies**: 无。
- **Acceptance Criteria**: 每个功能请求都能映射到核心指标或被延后。
- **Validation**: 产品、开发、知识运营三方评审。

## Sprint 1（第 1 周）：先修“不能上线”的问题

**Goal**: 所有高成本、管理和写操作都有真实的服务端身份与权限保护。
**Demo/Validation**:

- 普通用户直接调用审核接口返回 403。
- 未登录用户不能伪造作者、审核内容或访问 LightRAG 管理入口。
- 默认管理员密码未配置时生产环境拒绝启动。

### Task 1.1：增加服务端会话/访问令牌

- **Location**: `server/auth.mjs`、`src/api/auth.ts`、`src/store/auth.ts`
- **Description**: 登录后发放可过期凭证；前端持久化最小必要信息并在请求中携带凭证。
- **Dependencies**: Task 0.1。
- **Acceptance Criteria**:
  - 服务端可从凭证解析用户 ID 与角色。
  - 退出或过期后凭证不可继续使用。
  - 日志不输出密码、验证码或完整凭证。
- **Validation**: 登录、过期、篡改、退出四类接口测试。

### Task 1.2：保护管理与写接口

- **Location**: `server/index.mjs`、`server/community.mjs`、`server/tts.mjs`
- **Description**: 为审核、知识生成、LightRAG 代理、知识库下载与高成本接口增加角色/权限中间件。
- **Dependencies**: Task 1.1。
- **Acceptance Criteria**:
  - 管理接口仅管理员可用。
  - 发帖/回复作者来自服务端身份，不接受客户端伪造。
  - 权限失败统一返回 401/403 和稳定错误码。
- **Validation**: 用户/管理员/匿名三角色权限矩阵测试。

### Task 1.3：增加限流与成本护栏

- **Location**: `server/index.mjs`、`server/auth.mjs`、`server/tts.mjs`、`server/.env.example`
- **Description**: 按用户/IP 对验证码、登录、问答、TTS 设置不同额度；限制单次输入长度与 TTS 文本长度。
- **Dependencies**: Task 1.1。
- **Acceptance Criteria**: 超限请求返回 429；日志可统计被限流请求；生产默认值安全。
- **Validation**: 连续请求与并发冒烟测试。

### Task 1.4：清理默认凭据与部署文档

- **Location**: `server/auth.mjs`、`server/.env.example`、`docs/deploy-server-checklist.md`
- **Description**: 删除生产默认密码；首次部署必须显式设置强密码或走初始化流程。
- **Dependencies**: 无。
- **Acceptance Criteria**: 文档不再建议使用 `admin/admin123`；生产缺少强凭据时 fail fast。
- **Validation**: 无配置启动、弱密码启动、正常配置启动三种测试。

## Sprint 2（第 2–3 周）：把可信问答做成可测能力

**Goal**: 高频问题质量可量化，知识更新可重复，错误答案能被发布门禁拦截。
**Demo/Validation**:

- 50 条金标问题自动生成 Top-K、来源有效性和回答结构报告。
- “补考报名”“转专业条件”等当前失败项达到发布门槛。
- 知识清洗、切片、向量索引可从源数据一键重建。

### Task 2.1：建立 Top 50 金标问题集

- **Location**: `server/evals/`、`server/scripts/`
- **Description**: 每类场景 10–15 条，定义期望标题/来源、关键答案点、不得出现的错误结论。
- **Dependencies**: Task 0.2。
- **Acceptance Criteria**: 问题集覆盖四类场景及同义问法、时间敏感问法、信息不足问法。
- **Validation**: 由至少一名熟悉校园事务的人复核。

### Task 2.2：让评测脚本可断言

- **Location**: `server/scripts/test-rag-retrieval.mjs`
- **Description**: 从“打印结果”升级为计算 Recall@K、Top1 准确率、空命中率、过期来源率，并在低于阈值时失败。
- **Dependencies**: Task 2.1。
- **Acceptance Criteria**: 报告可按分类定位退化；CI 可直接消费退出码。
- **Validation**: 人为移除一个正确来源，确认门禁失败。

### Task 2.3：知识库去重与链接治理

- **Location**: `server/scripts/kb-clean-tag-qc.mjs`、`server/data/knowledge-base.json`
- **Description**: 合并重复标题、补齐 6 条缺失链接、移除会话票据型 URL、标记有效期与权威级别。
- **Dependencies**: Task 2.1。
- **Acceptance Criteria**: 重复标题有明确保留规则；正式来源链接可匿名访问；每条记录有更新时间。
- **Validation**: QC 报告无 P0 数据问题，抽检 20 条来源可打开。

### Task 2.4：恢复切片和向量索引流水线

- **Location**: `server/scripts/build-chunked-kb.mjs`、`server/scripts/build-vector-index.mjs`、`server/vector-index.mjs`
- **Description**: 修正脚本/包命令不一致，生成可部署的切片与索引产物，并记录模型、维度和生成时间。
- **Dependencies**: Task 2.3。
- **Acceptance Criteria**: 新环境可按文档重建；服务启动时校验索引与知识版本一致。
- **Validation**: `check-vector-readiness.mjs` 无缺失产物告警，金标质量达标。

### Task 2.5：低置信回答策略

- **Location**: `server/rag.mjs`、`server/index.mjs`、`src/components/MessageItem.vue`
- **Description**: 信息不足时追问日期/年级/考试类型；低置信时显示“未确认”并指向官方入口，不编造流程。
- **Dependencies**: Task 2.2、Task 2.4。
- **Acceptance Criteria**: 金标中的模糊问题不会输出确定性错误结论。
- **Validation**: 模糊问法与无知识问法专项测试。

## Sprint 3（第 4 周）：补齐产品反馈与运营闭环

**Goal**: 每次失败都能被发现、归因并进入下一轮知识优化。
**Demo/Validation**:

- 用户可对答案反馈“已解决/未解决”并选择原因。
- 管理员能查看高频问题、低置信问题、负反馈问题和来源点击。
- 任一未解决问题可转为知识补齐任务并追踪状态。

### Task 3.1：答案反馈组件

- **Location**: `src/components/MessageItem.vue`、`src/api/`、`server/`
- **Description**: 增加有帮助/没帮助、原因、可选文字补充；与 requestId 关联。
- **Dependencies**: Sprint 1。
- **Acceptance Criteria**: 同一用户同一回答可修改但不重复计数；失败可重试。
- **Validation**: 前端交互测试和 API 幂等测试。

### Task 3.2：最小事件与指标存储

- **Location**: `server/sql/`、`server/`、`src/api/llm.ts`
- **Description**: 建立最小事件表/聚合接口；记录分类、耗时、RAG 命中、反馈和错误码。
- **Dependencies**: Task 3.1。
- **Acceptance Criteria**: 不记录敏感正文或可直接识别个人的信息；可按天/分类查看指标。
- **Validation**: 数据字典审查、脱敏检查、10 条完整链路核对。

### Task 3.3：知识缺口工作台

- **Location**: `src/views/AdminReviewView.vue` 或拆分后的运营页面、`server/community.mjs`
- **Description**: 合并低置信、无命中、负反馈问题，支持指派、补知识、复测和关闭。
- **Dependencies**: Task 3.2。
- **Acceptance Criteria**: 每条缺口有状态、负责人、来源与复测结果。
- **Validation**: 从一次负反馈走完“发现—补齐—评测—关闭”。

### Task 3.4：收敛社区价值

- **Location**: `src/views/CommunityView.vue`、`server/community.mjs`
- **Description**: 社区优先承接官方知识缺口和经验补充；社区知识继续低权重、强提示、必须审核。
- **Dependencies**: Task 3.3。
- **Acceptance Criteria**: 可统计“社区内容补齐了多少未解决问题”，而不是只统计发帖量。
- **Validation**: 至少完成 3 条社区经验转知识并进入回归评测。

## Sprint 4（第 5 周）：稳定交付与体验减负

**Goal**: 建立可持续发布能力，提升首屏和核心操作体验。
**Demo/Validation**:

- 每个 PR 自动运行构建、权限测试和 RAG 金标评测。
- Web 首屏包体积下降，无核心流程回归。
- 问答、来源、社区帖子具备可分享深链。

### Task 4.1：CI 与关键自动化测试

- **Location**: `.github/workflows/`、`package.json`、测试目录。
- **Description**: 增加构建、类型检查、接口权限矩阵、RAG 评测和关键页面冒烟。
- **Dependencies**: Sprint 1–3。
- **Acceptance Criteria**: P0 检查未通过不能发布。
- **Validation**: 人为引入权限和检索回归，确认 CI 阻断。

### Task 4.2：拆分大文件和路由

- **Location**: `src/App.vue`、`src/views/AdminReviewView.vue`、`server/index.mjs`、`server/community.mjs`
- **Description**: 引入正式页面路由；按认证、问答、社区、知识运营拆分后端处理器和管理端视图。
- **Dependencies**: 现有接口测试先落地。
- **Acceptance Criteria**: 路由可刷新/分享；拆分前后接口契约不变。
- **Validation**: 深链刷新、浏览器前进后退、权限跳转和 API 回归。

### Task 4.3：首屏包体积治理

- **Location**: `vite.config.ts`、页面导入与 Element Plus 使用方式。
- **Description**: 页面懒加载、按需拆包，避免管理端代码进入普通用户首屏。
- **Dependencies**: Task 4.2。
- **Acceptance Criteria**: 主 JS gzip 体积较当前基线下降至少 30%，首屏功能无回归。
- **Validation**: 构建产物比较和浏览器性能采样。

## Sprint 5（第 6 周）：小范围试运营与去留决策

**Goal**: 用真实用户验证产品是否解决校园问题，并决定下一阶段投入。
**Demo/Validation**:

- 30–50 名用户完成 2 周内首轮试用，累计至少 200 次有效问答。
- 每日查看质量、性能、成本和知识缺口；严重错误当天处理。
- 形成继续扩展、继续打磨或停止某功能的决策报告。

### Task 5.1：灰度发布

- **Location**: `docs/deploy-server-checklist.md`、服务器配置。
- **Description**: 只面向受邀用户；准备回滚、日志、预算告警和故障联系人。
- **Dependencies**: Sprint 1–4 全部 P0 门槛。
- **Acceptance Criteria**: 权限、备份、告警、回滚演练通过。
- **Validation**: 发布前验收清单逐项签字。

### Task 5.2：试运营复盘

- **Location**: `docs/` 试运营报告。
- **Description**: 按问题分类分析解决率、负反馈、耗时、来源质量、成本和知识缺口。
- **Dependencies**: Task 5.1。
- **Acceptance Criteria**: 每个结论有数据支持并对应下一步动作。
- **Validation**: 对照本计划的北极星指标和发布门槛。

### Task 5.3：移动端 Go/No-Go

- **Location**: `mobile-uniapp/package.json`、`mobile-uniapp/`
- **Description**: 仅在 Web 可信问题解决率达标后修复依赖并启动移动端正式开发。
- **Dependencies**: Task 5.2。
- **Acceptance Criteria**:
  - Go：统一 `@dcloudio/*` 版本，H5 构建通过，再规划小程序合法域名与登录。
  - No-Go：保留骨架，停止同步维护重复代码。
- **Validation**: `npm --prefix mobile-uniapp run build:h5` 成功才进入下一阶段。

## 七、测试策略

- **每次提交**：TypeScript、Web 构建、后端语法、单元测试。
- **每个 PR**：服务端权限矩阵、关键 API 合约、Top 50 RAG 金标评测、关键页面冒烟。
- **每次知识更新**：重复/缺失/链接/编码 QC，重新切片和构建索引，评测结果与上一版本对比。
- **每次发布**：登录、问答、来源、TTS、社区、审核、知识生成、回滚全链路验证。
- **试运营期间**：每日抽检负反馈和低置信回答；每周复盘分类覆盖与成本。

## 八、风险与应对

1. **知识有时效性**：通知过期会产生“看似有来源但已失效”的答案。
   应对：记录生效/失效时间，时间敏感问法优先最新正式通知，过期来源降权。

2. **社区经验污染官方答案**：社区内容可能主观或过时。
   应对：低权重、强标识、人工审核、独立负反馈监控，不直接覆盖官方结论。

3. **试运营样本过小**：少量熟人试用可能高估真实表现。
   应对：按年级和场景招募用户，保留失败问题而不是只展示成功案例。

4. **研发被移动端和数字人分散**：会延迟可信问答闭环。
   应对：以北极星指标作为新增需求准入条件；未达标不扩终端和表现层。

5. **原生 Node 后端继续膨胀**：权限、限流、日志和测试容易遗漏。
   应对：先用回归测试锁定契约，再按领域拆模块；本阶段不强制更换框架。

## 九、回滚计划

- 所有数据库变更使用向前兼容迁移，新增字段先可空，保留旧读路径一个版本。
- 新 RAG 检索策略保留关键词回退，可通过环境开关切回上一版本。
- 反馈/埋点失败不得阻断主问答链路。
- 灰度发布保留上一版前端产物、后端进程配置和数据库备份。
- 移动端在正式 Go 决策前不与 Web 发布节奏绑定。

## 十、已确认的产品决策（2026-08-09）

1. **近期目标：比赛交付。** 当前先执行 14 天比赛冲刺，长期试运营路线保留但暂不作为主线。
2. **责任模式：AI 主责。** 由 AI 比赛负责人维护任务优先级、运行质量检查、发现知识缺口并生成候选修正；校园正式规则和最终发布仍由人工确认。
3. **登录策略：先体验后登录。** 游客可完成 1 次有效问答；第 2 次提问时要求登录。社区发布、管理后台和知识审核始终要求登录及对应权限。

比赛执行文件：`docs/competition-roadmap-plan.md`。
