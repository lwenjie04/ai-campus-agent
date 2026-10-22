# V2 CI 与可重复验证约定

`.github/workflows/quality.yml` 在 `push`、`pull_request` 和 `workflow_dispatch` 时运行。各 job 使用独立 runner，不共享数据库、端口或临时索引；所有 job 超时均不超过 30 分钟。

## 核心质量 job

`quality` 检查发布资产与服务端语法，然后依次运行 lint、type-check、前端单测、普通服务端测试和生产构建。服务端集成测试 `test:mysql:review` 不属于内存测试入口，单独由 MySQL job 执行。

该 job 不需要真实密钥。工作流只在发布资产检查步骤设置 `LLM_PROVIDER_MODE=mock`，因此该检查会输出 mock 配置警告而不会要求 `LLM_API_KEY`，同时避免改变服务端测试的 provider 行为；缺少仓库必须文件或检测到错误配置仍会失败。

## 浏览器旅程 job

`browser-journeys` 安装 Chrome stable，并显式设置 `CHROME_PATH`。`npm run build` 只执行一次，之后 `ci:browser-journeys` 启动 `node server/index.mjs` 和 Vite preview（`127.0.0.1:3000`、`127.0.0.1:4176`），等待 `/health` 和 preview 可访问，再串行运行以下旅程：

- `admin:journey`
- `community:journey`
- `regression:journey`
- `closed-loop:journey`
- `home:journey`
- `chat:layout`
- `chat:stream`
- `responsive:matrix`

每个脚本必须成功退出，结果 JSON 必须满足 `ok === true` 且所有步骤成功。runner 还核对管理员“只重试生成”请求数、普通投稿 `POST=1`、社区来源回链和越权 `403` 等关键断言；知识审核完成状态以指定条目从 pending 队列移除并进入 approved 队列作为依据。服务关闭由 runner 的 `finally` 清理。

旅程环境固定使用 `MYSQL_PORT=1`、`AUTH_ALLOW_MEMORY_FALLBACK=true`、`LLM_PROVIDER_MODE=mock`、`LIGHTRAG_PRIMARY=false`、`RAG_VECTOR_ENABLED=false`、`TTS_PROVIDER=disabled`、`FEEDBACK_TEST_MEMORY=true`。每个旅程运行前会创建该旅程声明的截图目录。管理员账号与密码、`AUTH_SESSION_SECRET`、`GUEST_COOKIE_SECRET` 在 runner 内随机生成；管理员环境变量与各旅程变量一致。`CORS_ORIGIN` 为 preview 源，不读取开发者 `.env` 或连接真实服务。

本轮 JSON 写到 `server/evals/ci/`，截图写到 `docs/design/verify/ci/`。旅程失败时上传这些结果与截图，避免把仓库内上次成功的 `latest-*.json` 误当成当前 run 证据。

## 独立服务旅程 job

`service-journey` 单独安装 Chrome 并运行 `npm run service:journey`。这个脚本自己 build，独占 `127.0.0.1:3000` 后端与 `127.0.0.1:4173` preview，默认执行 10 轮。随后 `ci:service-journey:assert` 必须确认 `passedRounds >= 10`、`communityClosureVerified === true`、`pendingQuestionRecoveryVerified === true`。结果写入 `server/evals/ci/latest-service-journey.json`。

## Golden job

`golden-top20` 在独立 runner 上按顺序执行 `npm run kb:prepare:offline` 和 `npm run rag:test:service -- --limit 20 --vector --json --output server/evals/ci/latest-rag-golden-ci.json`，再断言实际条目数为 20 且达到数据集阈值。失败不允许 `continue-on-error` 或跳过，报告始终作为 artifact 上传。

CI 目前只锁定仓库已有 **Top 20**；Top 50 需要 5.4 的人工核对数据，准备好之前不补造样本，也不阻止 Top 20 job 运行。

## MySQL 审核事务 job

`mysql-review` 启动一次性的 `mysql:8.0` service，只使用 `ai_campus_agent_ci` 数据库。`npm run test:mysql:review` 的安全守卫要求 `MYSQL_REVIEW_TEST=1`、`CI=true` 和准确的测试库名；该入口不会被普通 `npm run test:server` 调用。

测试通过 `server/sql/community-review-ci.sql` 创建所需表。该文件只包含 `CREATE TABLE IF NOT EXISTS`，不建库、不删除表、不执行旧的 `community-feature-v1.sql`。测试覆盖 MySQL 8 连接、pending-only 状态转换、同状态幂等、相反状态 409、并发审核单次提交、回复审核、未审核生成拒绝、生成失败后的仅生成重试、三次并发生成一条知识记录以及 `post_id` 唯一键。报告写到 `server/evals/ci/latest-mysql-review-ci.json` 并上传；job 结束后 GitHub 丢弃 MySQL service。

## 发布验证边界

workflow 不设置 `RELEASE_LIVE_VALIDATION_CONFIRMED`，也不连接真实模型、部署数据库、SMTP、TTS 或 HTTPS 环境。这个变量只由人工在 7.4 目标环境验收通过后设置。

CI 将 `release:check` 拆成单独可诊断的门禁，并用离线 hash 索引跑完整 Top 20；不直接运行 monolithic `release:check`，因为它复用发布环境的向量就绪配置和默认 Golden 参数，既会与显式 Node/测试/构建 job 重复，也不能替代 Top 20 离线向量检查。发布前仍按 [release-checklist.md](release-checklist.md) 执行目标环境验证与 `release:gate`。

## 自动部署（CD）

`.github/workflows/deploy.yml` 监听 `Quality` workflow 完成事件，仅接受默认分支 push 且完整 CI 成功的 commit；PR 和其他分支不会发布。它重新构建同一 commit，再通过 SSH 更新前端、Node 服务和 PM2 进程，检查本机 `/health` 与公网 HTTPS 健康地址，检查失败时回滚上一 release。

CD 默认关闭。启用步骤、GitHub Environment secrets/variables、服务器目录结构、Nginx 根目录与首次迁移要求见 [cicd-deployment-setup.md](cicd-deployment-setup.md)。CI 不读取部署密钥，也不执行数据库迁移；部署目标须先完成 7.4 的环境核对。

7.3 质量 workflow 已在 2026-10-22 的 [run 39714486081](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39714486081) 全绿。该结果证明 CI 门禁执行通过，不代表目标生产环境已完成 7.4 验收。
