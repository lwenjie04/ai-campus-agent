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
- [x] 生产 CD 的部署目标、GitHub Environment secrets/variables、`server.env`、Nginx `current/dist` 根目录和 health URL 已按 [自动部署配置文档](cicd-deployment-setup.md) 完成核对；当前线上 release 部署 run [39893338172](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39893338172) 成功。自动部署链路成功不代表 7.4 签收完成。
- [x] Browser journeys、service journey、Top 20 Golden、MySQL 8 review service 都有真实 CI run 证据；详见 [Quality run 39890973878](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39890973878)。
- [x] 隔离 Mock 旅程检查 10 轮服务闭环：`npm run service:journey` 10/10；脚本自建 build、后端与 preview，不代替真实服务验证。
- [x] 目标后端 `npm run service:smoke` 4/4；检查 `/health`、社区审核和 LightRAG 匿名拒绝、CORS 与真实部署代理。
- [ ] `RELEASE_LIVE_VALIDATION_CONFIRMED` 不应在 CI 设置，也不能用来跳过任何测试。

CI workflow 的一次真实 push run 已全绿。该结果不代表真实模型、目标数据库、SMTP、TTS、HTTPS/Nginx 或回滚演练通过；这些仍由 7.4 目标环境验收确认。

## 4. 7.4 目标环境验收

在真实目标环境记录测试时间、环境标识、工具版本与证据，不在文档写入密钥值：

- [x] 真实 LLM 普通问答和 RAG 均成功；样本 TTFT/总耗时分别为普通问答 6.284/6.287s、RAG 1.254/2.656s（4 条来源）。公网 `/api/chat/stream` 在首段后断开，TTFT 2.646s、客户端 reader cancel 2ms；代码级上游取消与额度竞态由服务端测试覆盖。
- [ ] 配置并验证真实 Embedding 服务端凭据与语义检索结果；用户计划在服务器配置密钥，当前尚未确认完成。
- [ ] 在真实目标环境注入模型异常并确认用户可见错误与资源清理；目前只验证了成功与断开取消。
- [x] 目标 MySQL 5.7.44 连接、增量迁移、反馈写入与幂等读回通过；备份已在隔离 schema 恢复验证（6 张基础表、6 条社区知识记录），临时 schema 已删除。
- [ ] 通过管理员社区知识 API 在目标 MySQL 完成生成/读取持久化闭环；生产登录凭据未能验证，当前只确认已有记录与备份恢复。
- [x] SMTP transporter 验证通过；用户确认收到生产邮箱检测邮件。该确认只覆盖测试邮件到达，不代表注册验证码生命周期已通过。
- [ ] 验证注册验证码在可访问测试收件箱中的到达、过期与重发；本轮不读取或记录邮箱地址、验证码。
- [x] HTTPS 游客 Cookie 已核对 `Secure`、`HttpOnly`、`SameSite=Lax`；可信代理列表仅为本机回环地址，Nginx 代理边界与服务端 IP 解析测试已核对。
- [ ] 完成真实登录会话验证；曾有一次生产管理员登录返回 `AUTH_INVALID`，之后未继续尝试；用户要求登录/TTS 实测暂记阻塞，待准备临时管理员后再验证。
- [x] 生产已移除共享 `TTS_AUTH_TOKEN`；真实腾讯云合成曾成功（838ms），匿名 `/api/tts` 返回 401 `AUTH_REQUIRED`，服务端单测覆盖登录和限频。
- [ ] 用登录会话完成生产 TTS 路由播放，并验证线上限频和可见失败提示；按用户决定暂记阻塞。
- [x] Nginx HTTPS、`/api/` 代理、SSE 无缓冲及健康检查通过；生产首页与问答在 360/390/768/1024/1440 共 10/10，无横向溢出。证据：`server/evals/production-7.4-responsive-full-20261023.json`。
- [x] 生产 `dist` 17M、`server` 1.2M；记录了问答时延和取消样本。部署脚本已从当前 release 回滚到上一版并通过本机健康检查，随后恢复当前 release，公网 `/api/health` 返回 200 且 releaseId 匹配。
- [ ] 完成真实用户试用并登记问题与结论；当前没有试用记录，模板见 [`releases/v2-trial-record.md`](releases/v2-trial-record.md)。

所有目标环境检查通过并由人工确认后，才可在发布环境设置 `RELEASE_LIVE_VALIDATION_CONFIRMED=true`。

## 5. 严格发布门槛与交接

确认目标进程环境中已安全设置人工验收标志，并完成所有文档提交后，保证工作区干净，再运行：

```bash
npm run release:gate
```

该门禁会运行严格配置预检，并要求有效的 10 轮隔离服务旅程证据、人工目标环境确认和干净 Git 工作区。门禁通过后再创建正式 tag；不得伪造环境变量、复用过期证据或绕过失败步骤。

发布后填写 [`releases/v2-handoff.md`](releases/v2-handoff.md) 的实际版本、迁移、构建、回滚和验证信息，并用 [`releases/v2-trial-record.md`](releases/v2-trial-record.md) 记录真实试用、问题、回滚触发与结论。未试用的字段保持“未填写”。
