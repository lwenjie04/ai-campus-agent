# 2026 比赛版本归档

本目录保存项目从“比赛演示版”切换为“校园智能服务台 + 知识运营后台”之前的历史材料。

- 归档日期：2026-08-12
- 来源分支：`feat/backend-rag`
- 保存提交：`9da3af7`（`feat: preserve competition-ready campus agent`）
- 后续开发分支：`codex/campus-service-platform`

## 最终工程基线

- Top 20 校园问题 RAG 首条命中：20/20
- 后端自动测试：12/12
- 隔离浏览器彩排：10/10
- Web 生产构建：通过
- 已验证链路：游客试问、登录续问、管理员鉴权、社区候选生成、知识审核、问答引用社区来源

## 未完成的比赛现场事项

- 未在比赛电脑使用真实模型、MySQL、TTS 和现场网络完成最终彩排。
- 未配置生产级管理员密码、会话密钥和游客 Cookie 密钥。
- 未执行严格比赛冻结门禁。

这些未完成项不影响当前产品分支继续开发，但不能把隔离 Mock 彩排表述为真实服务验证。

## 文档索引

- [比赛状态](./competition-status.md)
- [比赛冲刺路线](./competition-roadmap-plan.md)
- [7 分钟演示脚本](./competition-demo-script.md)
- [连续彩排记录](./competition-rehearsal-log.md)
- [冻结交接清单](./competition-freeze-handoff.md)
- [比赛期后端 RAG 部署说明](./backend-rag-deployment.md)
- [比赛期产品化评估](./product-optimization-roadmap-plan.md)

归档文档中的 `competition:*` 命令属于历史流程。产品分支请使用根目录 `package.json` 中的 `release:*`、`service:*` 与 `rag:test:service` 命令。
