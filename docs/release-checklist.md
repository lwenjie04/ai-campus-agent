# 产品发布检查清单

## 1. 发布候选与数据库

- [ ] 记录候选版本、commit、tag（若已创建）、Node/npm 版本与构建日期。
- [ ] 确认目标环境、域名、备份负责人和回滚阈值；发布前做数据库备份并核实可读。
- [ ] 对照 [`releases/v2-handoff.md`](releases/v2-handoff.md) 判定数据库类型：全新空库才可按初始化顺序执行 `community-feature-v1.sql`；已有数据只跑经确认的增量迁移。
- [ ] 不在现有数据上运行含 `DROP TABLE` 的 `server/sql/community-feature-v1.sql`，不在正式库运行 `community-demo-seed.sql`。
- [ ] 生产密钥由部署平台或受限环境文件提供；检查 Git、CI 日志和 artifacts 不含密钥值。

## 2. 本地代码门禁

从候选 commit 的干净副本执行：

```bash
npm ci
npm run lint
npm run type-check
npm run test:unit
npm run test:server
npm run server:check
npm run build
```

随后运行完整预检：

```bash
npm run release:check
```

`release:check` 会运行产品资产/配置、后端语法、前端单测、服务端测试、向量就绪、RAG Golden 和构建。它可能以 `READY WITH WARNINGS` 结束；逐条审阅并解决或记录每个 `WARN`，不可只看退出码。RAG Golden 使用仓库当前的 Top 20 集，不代表 Top 50 已人工核对。

如需重新准备离线 hash 索引并单独留存 Top 20 结果：

```bash
npm run kb:prepare:offline
npm run rag:test:service -- --limit 20 --vector --json --output server/evals/latest-rag-golden-release.json
```

## 3. CI 与隔离旅程

- [x] `.github/workflows/quality.yml` 的 push run 全绿；2026-10-22 workflow run [39714486081](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39714486081) 五个 job 全通过。后续发布候选仍须记录自身 commit 对应的 workflow run、耗时与 artifacts。
- [ ] 生产 CD 的部署目标、GitHub Environment secrets/variables、`server.env`、Nginx `current/dist` 根目录和 health URL 已按 [自动部署配置文档](cicd-deployment-setup.md) 完成核对；仅在 7.4 目标环境验收后启用 `CD_ENABLED`。
- [ ] 确认 Browser journeys、service journey、Top 20 Golden、MySQL 8 review service 都实际运行；不得把本地单测或旧 JSON 当成本次 CI 证据。
- [ ] 使用隔离 Mock 旅程检查 10 轮服务闭环：`npm run service:journey`。该脚本会自建 build、后端与 preview，不代替真实服务验证。
- [ ] 在目标后端启动后运行 `npm run service:smoke`；确认 `/health`、`/api/health`、CORS 与真实部署代理。
- [ ] `RELEASE_LIVE_VALIDATION_CONFIRMED` 不应在 CI 设置，也不能用来跳过任何测试。

CI workflow 的一次真实 push run 已全绿。该结果不代表真实模型、目标数据库、SMTP、TTS、HTTPS/Nginx 或回滚演练通过；这些仍由 7.4 目标环境验收确认。

## 4. 7.4 目标环境验收

在真实目标环境记录测试时间、环境标识、工具版本与证据，不在文档写入密钥值：

- [ ] 真实 LLM 问答、流式首字/总耗时、异常处理和断开取消。
- [ ] 目标 MySQL 连接、迁移、反馈与社区知识持久化；确认数据库备份及恢复流程。
- [ ] SMTP 验证码邮件发出、到达与过期/重发行为。
- [ ] 登录会话和游客 Cookie 在 HTTPS 下工作；代理 IP 配置仅信任受控代理。
- [ ] TTS 登录鉴权、腾讯云凭据、限频、失败提示与播放；不配置或使用共享 `TTS_AUTH_TOKEN`。
- [ ] Nginx HTTPS、`/api/` 原样转发、SSE 关闭缓冲、健康检查及移动端主要宽度。
- [ ] 记录服务资源体积、问答首字/总耗时、取消耗时和试用问题；测试并记录上一版回滚步骤。

所有目标环境检查通过并由人工确认后，才可在发布环境设置 `RELEASE_LIVE_VALIDATION_CONFIRMED=true`。

## 5. 严格发布门槛与交接

确认目标进程环境中已安全设置人工验收标志，并完成所有文档提交后，保证工作区干净，再运行：

```bash
npm run release:gate
```

该门禁会运行严格配置预检，并要求有效的 10 轮隔离服务旅程证据、人工目标环境确认和干净 Git 工作区。门禁通过后再创建正式 tag；不得伪造环境变量、复用过期证据或绕过失败步骤。

发布后填写 [`releases/v2-handoff.md`](releases/v2-handoff.md) 的实际版本、迁移、构建、回滚和验证信息，并用 [`releases/v2-trial-record.md`](releases/v2-trial-record.md) 记录真实试用、问题、回滚触发与结论。未试用的字段保持“未填写”。
