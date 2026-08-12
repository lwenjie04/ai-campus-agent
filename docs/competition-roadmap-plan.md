# Plan: 校园智能问答平台比赛冲刺路线

**Generated**: 2026-08-09
**周期假设**: 14 天；若比赛不足 14 天，优先完成 D1–D7 和 D12–D14
**负责人模式**: AI 比赛负责人主责，人工仅承担校园事实确认、账号/密钥和最终发布决策

## 一、比赛目标

比赛版本不追求功能最多，而要在 6–8 分钟内稳定证明三件事：

1. **有用**：学生提出校园问题后，系统给出具体步骤。
2. **可信**：答案带官方来源，社区经验与官方知识明确分层。
3. **可持续**：未解决问题和优质社区内容可以反哺知识库。

当前核心卖点统一为：

> 数智校答不是通用聊天机器人，而是一个能提供可信来源、持续学习校园经验的数字人校园服务助手。

## 二、AI 比赛负责人

### 角色名称

**AI Competition Owner / AI 比赛负责人**

### AI 主责范围

- 维护比赛唯一 backlog，按 P0/P1/P2 控制范围。
- 每次改动后运行 Web 构建、后端语法、RAG 评测和比赛演示预检。
- 每日汇总阻塞项、质量变化、知识缺口与第二天任务。
- 对知识库执行重复项、缺失链接、时间敏感信息和分类检查。
- 对失败问法提出候选知识、标签或检索规则修正。
- 维护比赛演示脚本、备用问题、异常恢复步骤和版本状态。

### AI 不得自主决定的事项

- 不得把未经确认的校园规则当成正式答案发布。
- 不得自行替换生产密钥、发外部消息或开放公网权限。
- 不得为了演示效果伪造真实用户数据、命中率或来源。

### 人工最小责任

- 对 Top 20 比赛问题的正确答案和正式来源做一次确认。
- 提供可用的比赛账号、模型密钥和网络环境。
- 在比赛前确认最终版本和演示话术。

### AI 负责人固定产物

- `docs/competition-status.md`：每日状态、风险、下一步。
- `server/evals/competition-golden-questions.json`：比赛金标问题。
- `npm run competition:check`：一键比赛预检命令。
- `docs/competition-demo-script.md`：主演示与备用演示脚本。

## 三、比赛版范围

### P0：必须稳定

1. 游客完成 1 次问答，第二次提问弹出登录。
2. 流式回答、来源卡片、数字人视频和 TTS 正常协同。
3. Top 20 比赛问题检索与回答稳定。
4. 管理员审核社区内容并生成社区知识的链路可演示。
5. 模型、TTS 或 LightRAG 不可用时有可控回退。
6. 比赛前可一键检查当前版本是否适合演示。

### P1：有时间再优化

- 首屏视觉、回答排版、来源更新时间、快捷问题。
- 登录弹窗文案和“已使用 1 次体验机会”的状态提示。
- 大包拆分和后台页面懒加载。
- 管理台信息密度与演示数据整理。

### P2：比赛后再做

- 移动端正式交付。
- 实时数字人、ASR、模型微调。
- 泛社区功能、推荐流、私信。
- 完整商业化运营后台。

## 四、游客一次询问规则

### 产品规则

- 游客进入首页可直接输入问题，不先打断体验。
- 第 1 次得到完整有效回答后，体验额度记为已使用。
- 第 2 次点击发送时弹出登录窗口，并保留用户已输入的问题；登录成功后自动继续发送。
- 请求失败、网络中断、服务端 5xx 不消耗体验额度。
- 浏览首页、查看第一条回答来源不消耗额外额度。
- 社区发帖、回复、管理后台与知识审核始终要求登录。

### 实现原则

- 前端负责交互提示，服务端负责最终额度判断。
- 比赛版可使用匿名会话 Cookie + IP 轻量限流；不能只依赖可随意修改的 `localStorage`。
- 登录用户按用户 ID 限流，不再受游客 1 次额度限制。
- 比赛演示账号不使用 `admin/admin123` 默认凭据。

### 验收场景

1. 新游客首次提问成功。
2. 同一游客第二次提问弹登录，输入内容不丢失。
3. 登录后原问题自动发送且只发送一次。
4. 首次请求失败后仍可继续使用一次体验机会。
5. 刷新页面不能无条件重置服务端额度。

## 五、14 天路线

## Sprint 1：D1–D3，锁定比赛基线

**Goal**: 所有人围绕同一套比赛问题、同一套检查命令和同一条演示链路工作。
**Demo/Validation**: 一条命令输出 Web 构建、后端语法、Top 20 问题和依赖状态。

### Task 1.1：建立 Top 20 比赛金标问题

- **Location**: `server/evals/competition-golden-questions.json`
- **Content**: 教务、考试、奖助、生活服务各 5 条，包含期望来源标题与关键答案点。
- **Acceptance Criteria**: 每条问题有人工确认的正式来源；包含“补考报名”“转专业条件”两个当前失败项。
- **Validation**: AI 生成初稿，人工一次性复核。

### Task 1.2：建立一键比赛预检

- **Location**: `package.json`、`server/scripts/competition-check.mjs`
- **Content**: 串联 Web 构建、后端语法、知识库就绪、金标评测、视频资源和必要配置检查。
- **Acceptance Criteria**: P0 失败时返回非零退出码；输出人能看懂的红/黄/绿结果。
- **Validation**: 人为移除一个视频或知识文件，确认检查能发现。

### Task 1.3：建立 AI 每日状态文件

- **Location**: `docs/competition-status.md`
- **Content**: 当前版本、今日完成、金标得分、阻塞、比赛风险、明日唯一重点。
- **Acceptance Criteria**: 状态最多一页，任何人 2 分钟内能知道是否可演示。
- **Validation**: 完成首份基线报告。

## Sprint 2：D4–D7，稳定主链路

**Goal**: 游客一次体验、登录接续、可信回答和异常回退全部可演示。
**Demo/Validation**: 连续跑 5 次完整主链路无阻塞。

### Task 2.1：实现游客一次询问

- **Location**: `src/App.vue`、`src/views/AgentChat.vue`、`src/store/auth.ts`、`server/index.mjs`、`server/auth.mjs`
- **Dependencies**: Task 1.2。
- **Acceptance Criteria**: 完成“五个验收场景”；第二次问题登录后自动补发。
- **Validation**: 浏览器正常、刷新、失败重试和无痕窗口测试。

### Task 2.2：比赛最低权限保护

- **Location**: `server/auth.mjs`、`server/community.mjs`、`server/index.mjs`
- **Content**: 管理审核、知识生成、LightRAG 管理代理必须校验管理员身份；替换默认管理员密码。
- **Dependencies**: Task 2.1 的身份机制。
- **Acceptance Criteria**: 匿名和普通用户调用管理接口均返回 401/403。
- **Validation**: 三角色权限矩阵冒烟。

### Task 2.3：建立三层回退

- **Location**: `server/index.mjs`、`server/rag.mjs`、`server/lightrag.mjs`、`src/api/llm.ts`
- **Content**:
  1. LightRAG 正常：使用 LightRAG。
  2. LightRAG 异常：自动回退本地检索。
  3. 模型/网络异常：展示可说明的错误和备用演示入口，不伪装真实模型回答。
- **Acceptance Criteria**: 任一外部服务失败不会导致页面空白或死锁。
- **Validation**: 分别关闭 LightRAG、模型网络和 TTS 进行演练。

## Sprint 3：D8–D11，提升比赛答案质量

**Goal**: 比赛问题“问得出、找得准、讲得清、有来源”。
**Demo/Validation**: Top 20 首条检索准确率 ≥ 90%，连续评测结果稳定。

### Task 3.1：修复当前失败问法

- **Location**: `server/data/knowledge-base.json`、`server/rag.mjs`、知识入库脚本。
- **Content**: 补齐补考报名与转专业条件正式资料，调整同义词、分类和标题权重。
- **Acceptance Criteria**: 两个问题 Top1 命中对应正式事项，不再被“干部考核”或“转专业后补退选”误导。
- **Validation**: 金标评测与人工答案核对。

### Task 3.2：恢复切片与向量索引

- **Location**: `server/scripts/build-chunked-kb.mjs`、`server/scripts/build-vector-index.mjs`、`package.json`
- **Content**: 补齐可重复执行的构建命令和产物版本检查。
- **Acceptance Criteria**: `check-vector-readiness.mjs` 不再报告缺少切片/索引。
- **Validation**: 从源知识库重新构建并运行 Top 20 评测。

### Task 3.3：比赛回答模板

- **Location**: `src/config/agent.ts`、`server/index.mjs`
- **Content**: 统一为“结论—办理步骤—材料/时间—注意事项—正式来源”；信息不足时先追问。
- **Acceptance Criteria**: 回答不堆长文本，不把社区经验写成官方结论。
- **Validation**: 对 Top 20 输出进行人工快速评审。

### Task 3.4：AI 知识预检

- **Location**: `server/scripts/kb-clean-tag-qc.mjs`、`docs/competition-status.md`
- **Content**: 每次知识更新后自动报告重复标题、缺失链接、过期风险、分类失衡和金标变化。
- **Acceptance Criteria**: AI 只生成候选修正，正式校园事实需要人工确认后入库。
- **Validation**: 选一条重复知识走完发现、建议、确认、复测流程。

## Sprint 4：D12–D14，演示冻结与彩排

**Goal**: 比赛现场 10 次连续演示均成功，主讲人知道每个异常怎么恢复。
**Demo/Validation**: 主演示、备用问题、断网/服务异常三套脚本完成彩排。

### Task 4.1：固定 6–8 分钟演示脚本

- **Location**: `docs/competition-demo-script.md`
- **Main Flow**:
  1. 游客首次询问一个高质量校园问题。
  2. 展示流式回答、数字人、TTS 和官方来源。
  3. 第二次提问触发登录，展示“先体验后登录”。
  4. 管理员审核一条社区内容并生成社区知识。
  5. 再次询问相关问题，展示官方/社区知识分层。
- **Acceptance Criteria**: 每一步都有时长、话术、成功信号和失败替代动作。
- **Validation**: 非开发人员按文档独立演示一次。

### Task 4.2：准备演示数据和备用问题

- **Location**: `server/sql/community-demo-seed.sql`、比赛文档。
- **Content**: 固定 3 个主问题、5 个备用问题、1 条社区知识闭环数据。
- **Acceptance Criteria**: 不依赖临场随机问题证明核心能力；数据明确标识为演示数据。
- **Validation**: 重置演示环境后可一键恢复。

### Task 4.3：冻结版本

- **Location**: Git 分支、发布清单、`docs/competition-status.md`
- **Content**: 比赛前 48 小时停止 P1/P2 变更，只允许修复阻断演示的问题。
- **Acceptance Criteria**: 固定提交、环境变量清单、备份包和回滚版本。
- **Validation**: 在比赛使用的电脑和网络上运行 `npm run competition:check`。

### Task 4.4：十次连续彩排

- **Location**: `docs/competition-status.md`
- **Content**: 记录每次耗时、失败步骤、恢复时间和问题答案一致性。
- **Acceptance Criteria**: 10 次连续主演示成功；单点异常恢复不超过 30 秒。
- **Validation**: 至少一次模拟断网、一次关闭 LightRAG、一次 TTS 失败。

## 六、比赛发布门槛

- `npm run competition:check` 全部 P0 检查通过。
- Top 20 首条检索准确率 ≥ 90%。
- 3 个主问题连续 10 次回答链路成功。
- 游客第一次成功、第二次登录拦截、登录后自动续问均通过。
- 匿名/普通用户不能调用审核和知识生成接口。
- LightRAG、模型、TTS 任一异常都有已验证的恢复方案。
- 比赛电脑已缓存代码、依赖、视频、演示数据和上一版构建产物。

## 七、比赛后的路线

比赛结束后再回到 `docs/product-optimization-roadmap-plan.md`：补完整安全、反馈指标、CI、试运营和移动端。比赛成绩不等于真实用户验证，不能用彩排成功率替代长期可信问题解决率。
