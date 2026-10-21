# 产品状态

| 项目     | 当前值                                                    |
| -------- | --------------------------------------------------------- |
| 更新日期 | 2026-10-21                                                |
| 分支     | `codex/campus-service-platform`                           |
| 版本     | 仓库 `package.json` 仍为 `0.0.0`；发布版本与 tag 尚未确定 |
| 阶段     | V2 功能回归与发布准备；尚未完成目标环境验收               |

## 当前结论

主要页面、问答流、社区投稿与审核、反馈操作和服务端状态契约已完成本地自动化验证。模拟服务和隔离数据库中的结果不能代表校内目标环境已可发布。7.3 CI workflow 已实现，但尚未取得 push/PR 全绿的 GitHub Actions 记录；7.4 的真实服务验证与 7.5 的试用记录仍待完成。

## 已有验证证据

| 范围               | 结果                                                     | 证据与边界                                                                                                                                              |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 前端单测           | 90/90；18 个测试文件                                     | `npm run test:unit`，2026-10-21                                                                                                                         |
| 服务端测试         | 56/56                                                    | `npm run test:server`，使用隔离 Mock/内存配置                                                                                                           |
| 生产构建与静态检查 | 构建通过，1662 个模块；lint 通过；后端语法检查 75 个模块 | `npm run build`、`npm run lint`、`npm run server:check`，2026-10-21                                                                                     |
| RAG 金标           | Top 20：20/20，Top 1 命中率 100%，目标阈值 90%           | `docs/development-baseline-v2.md` §3 记录的 `npm run rag:test:service` 结果；使用本地 hash 向量索引。7.3 新增的离线 Golden CI job 尚未取得远端 run 证据 |
| 隔离服务旅程       | 10/10                                                    | `server/evals/latest-service-journey.json`；含待恢复问题确认和社区知识来源闭环，使用 isolated mock                                                      |
| 管理后台旅程       | 11/11                                                    | `server/evals/latest-admin-journey.json`；隔离内存后端                                                                                                  |
| 社区旅程           | 13/13                                                    | `server/evals/latest-community-journey.json`；隔离内存后端                                                                                              |
| 社区审核闭环       | 9/9                                                      | `server/evals/latest-closed-loop-journey.json`；失败重试、来源回链、越权拒绝与降级                                                                      |
| 回归旅程           | 9/9                                                      | `server/evals/latest-regression-journey.json`；隔离 Mock 后端                                                                                           |
| 响应式检查         | 10/10                                                    | `server/evals/latest-responsive-matrix.json`；首页与问答五个宽度                                                                                        |
| MySQL 审核事务     | 9/9                                                      | `server/evals/latest-mysql-review-validation.json`；本地 MySQL 8 独立 schema，测试后已清理。它不代表目标环境数据库已验收                                |

## 发布前仍需完成

- **7.3 CI**：提交后由 push/PR workflow 实际运行并全绿；保存 workflow run URL、job 耗时与失败 artifacts。Top 50 数据仍等 5.4 人工核对。
- **7.4 目标环境**：验证真实 LLM、部署 MySQL、SMTP、腾讯云 TTS、HTTPS/Nginx 代理、SSE 首字与取消时延，并记录构建体积和主要问答来源。当前没有这些目标环境的验证证据。
- **RAG**：当前离线验证使用 hash 向量；真实 embedding 配置与索引质量尚未在目标环境验证。Top 50 金标尚未准备。
- **运营与试用**：发布版本、tag、试用时间窗、参与人数、问题记录和回滚阈值尚未确认。
- **容量边界**：游客额度与按 IP 限频状态保存在单 Node 进程内存中；多实例部署或进程重启后不能保证连续计数。若试用需要多实例，需先接共享存储并验证。

只有在 7.4 的目标环境检查实际通过后，人工才能设置 `RELEASE_LIVE_VALIDATION_CONFIRMED=true` 并运行 `npm run release:gate`。CI 不设置此变量；变量本身不替代验证记录。

## 下一步

完成 7.3 远端 CI 记录和 5.4 Top 50 数据核对；随后由人工提供 7.4 目标环境与真实服务凭据，按 [`release-checklist.md`](release-checklist.md) 验收。7.5 的版本交接与试用结论在验收后填写，当前模板见 [`releases/v2-handoff.md`](releases/v2-handoff.md) 和 [`releases/v2-trial-record.md`](releases/v2-trial-record.md)。
