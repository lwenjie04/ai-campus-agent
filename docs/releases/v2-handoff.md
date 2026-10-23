# V2 发布交接（草案）

| 项目         | 当前值                    |
| ------------ | ------------------------- |
| 文档状态     | 准备稿，尚非发布批准      |
| 准备日期     | 2026-10-23                |
| 目标环境验收 | 部分通过；任务 7.4 未完成 |

## 发布标识

| 字段              | 当前记录                                                                   |
| ----------------- | -------------------------------------------------------------------------- |
| 发布版本          | 待 7.4 验收后确定；当前 `package.json` 是占位版本 `0.0.0`                  |
| 发布分支          | 当前生产来源为 `master`；正式候选仍须记录自身 commit 与 CI 结果            |
| 当前线上 release  | `a6f94f3d9dacae5e5b6630172a6c01cf3b09d18f-39893338172-1`（尚非正式签收）   |
| 发布 commit       | 当前线上 commit `a6f94f3d9dacae5e5b6630172a6c01cf3b09d18f`；正式候选待确定 |
| Git tag           | 未创建                                                                     |
| 发布日期          | 未排期                                                                     |
| 目标域名 / 服务器 | `https://maila.club`；生产主机已配置 SSH 部署                              |

## 构建清单

项目使用 `package-lock.json`（lockfile v3）固定 npm 依赖。`.github/workflows/quality.yml` 与部署工作流用 Node 24 构建；2026-10-23 实测生产运行时为 Node 22.22.2 / npm 10.9.7。目标 MySQL 为 5.7.44。正式发布候选仍需记录自身构建与运行时版本。

```bash
npm ci
npm run build
```

`npm run build` 执行 TypeScript 检查并生成仓库根目录 `dist/`。2026-10-21 本地生产构建通过，Vite 转换 1662 个模块。发布归档应包含 `dist/`、同一 release commit 的服务端代码、`package.json` 与 `package-lock.json`；记录 commit、Node/npm 版本和构建时间。`dist/` 与环境密钥不提交到 Git。

后端从仓库根目录启动：

```bash
node server/index.mjs
```

服务默认监听 `127.0.0.1:3000`；部署时由进程守护程序负责重启与日志收集。当前游客额度和部分限频状态是进程内存，因此在接入共享存储前按单实例部署并纳入重启影响评估。

## 数据库与迁移

开始前先备份数据库，并确认目标库名、MySQL 版本和当前 schema。提交中有两类不同用途的 SQL：

1. **全新、可清空的数据库**：按 `server/sql/auth-users.sql` → `server/sql/community-feature-v1.sql` → `server/sql/migrations/20261020-chat-feedback.sql` 初始化。`community-feature-v1.sql` 是旧初始化脚本，含 `DROP TABLE`，只能对确认无数据的全新库执行。
2. **已有数据的数据库**：不要重跑 `community-feature-v1.sql`、`community-demo-seed.sql` 或任何含删除/清空语句的旧 SQL。`auth-users.sql` 是 `CREATE TABLE IF NOT EXISTS`，核对结构并备份后，可用于补齐缺失的 auth 表；社区表已存在且结构符合当前代码时，再应用增量迁移 `server/sql/migrations/20261020-chat-feedback.sql`。若社区表或字段缺失，先备份并准备独立的增量修复迁移，不要用旧初始化脚本补表。

`20261020-chat-feedback.sql` 新建 `chat_request_receipts` 与 `chat_feedback`，不删除现有表。执行后确认两表、外键和唯一键 `uq_chat_feedback_owner_request` 存在。CI 的 `community-review-ci.sql` 仅用于一次性测试库，不是生产迁移。不要在正式库运行 `community-demo-seed.sql`。

## 环境配置

变量只登记名称和用途；真实值应通过部署平台密钥、受限权限的 `server/.env` 或进程环境注入，不写入仓库、CI 日志或本文件。完整示例见 [`deploy-server-checklist.md`](../deploy-server-checklist.md)。

| 变量                                                                                                                                                             | 用途                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `PORT`, `HOST`                                                                                                                                                   | Node 服务端口和监听地址；Nginx 同机部署时绑定回环地址                                      |
| `CORS_ORIGIN`                                                                                                                                                    | 允许的前端来源；设置为正式 HTTPS 域名                                                      |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`                                                                                     | 目标 MySQL 连接；生产账号仅授予应用所需权限                                                |
| `AUTH_DEFAULT_ADMIN_USERNAME`, `AUTH_DEFAULT_ADMIN_PASSWORD`, `AUTH_DEFAULT_ADMIN_NAME`                                                                          | 初始管理员身份；生产密码至少 10 位且不可使用示例值                                         |
| `AUTH_SESSION_SECRET`, `GUEST_COOKIE_SECRET`, `COOKIE_SECURE`                                                                                                    | 登录会话与游客 Cookie；两个密钥各用至少 32 位随机值，彼此分离；HTTPS 下启用 Secure Cookie  |
| `AUTH_ALLOW_MEMORY_FALLBACK`                                                                                                                                     | 数据库离线时的显式内存回退；生产应保持关闭                                                 |
| `LLM_PROVIDER_MODE`, `LLM_API_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`                                                                                              | 真实模型提供商、端点、服务端密钥与模型名；生产设为真实 provider                            |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`, `AUTH_NOTIFY_EMAIL`                                                              | SMTP 验证码邮件与管理员通知                                                                |
| `LIGHTRAG_PRIMARY`, `LIGHTRAG_API_BASE_URL`, `LIGHTRAG_API_KEY`                                                                                                  | 可选 LightRAG 服务；启用前须验证可达与认证                                                 |
| `RAG_VECTOR_ENABLED`, `VECTOR_EMBEDDING_PROVIDER`, `VECTOR_EMBEDDING_API_BASE_URL`, `VECTOR_EMBEDDING_API_KEY`, `VECTOR_EMBEDDING_MODEL`, `VECTOR_EMBEDDING_DIM` | 向量检索和 embedding 服务；不要把本地 hash 索引质量当作真实语义检索验收                    |
| `TTS_PROVIDER`, `TENCENTCLOUD_SECRET_ID`, `TENCENTCLOUD_SECRET_KEY`                                                                                              | TTS provider 与腾讯云服务端凭据；TTS API 统一依赖登录会话鉴权，不使用共享 `TTS_AUTH_TOKEN` |
| `AUTH_TRUST_PROXY`, `GUEST_TRUST_PROXY`, `TTS_TRUST_PROXY`, `FEEDBACK_TRUST_PROXY`, `TRUSTED_PROXY_IPS`                                                          | 仅在请求只能经受信代理到达 Node 时启用可信代理 IP 解析                                     |
| `RELEASE_LIVE_VALIDATION_CONFIRMED`                                                                                                                              | 仅在 7.4 真实目标环境检查完成后，由人工在发布环境设置；不可由 CI 设置或用来代替检查        |

## 部署步骤

1. 在发布目录检出并固定已验收的 commit；按目标环境固定 Node/npm 版本，安装锁定依赖并构建 `dist/`。
2. 完成数据库备份与适用的迁移；将密钥放入受限配置，不将 `server/.env` 放入版本库。
3. 以受守护的单个 Node 进程运行 `node server/index.mjs`，仅监听 Nginx 可访问的内网地址；配置失败自动重启和日志轮转。
4. Nginx 通过 HTTPS 提供 `dist/`，未知页面路由回退到 `index.html`；`/api/` 原样代理到 Node，不剥除 `/api` 前缀。对 `/api/chat/stream` 开启 HTTP/1.1、关闭 `proxy_buffering` 与缓存，并设置合适的 `proxy_read_timeout`，保持 NDJSON/SSE 实时输出。参考 [`deploy-server-checklist.md`](../deploy-server-checklist.md) 的 Nginx 示例。
5. 配置 TLS 证书、HTTP 到 HTTPS 跳转和正确的 `CORS_ORIGIN`；Node 端口不得绕过 Nginx 暴露公网。
6. 检查本机 `GET /health` 与外部 HTTPS `GET /api/health`；随后按 [`release-checklist.md`](../release-checklist.md) 验证登录、邮件、问答流、来源、反馈、社区审核、TTS 和手机布局。

## 回滚步骤

1. 发布前记录当前线上版本、release commit、`dist/` 归档和 Nginx/进程配置；对数据库做可恢复备份并确认备份可读。
2. 满足回滚触发条件时，停止当前进程，将部署目录切回上一版已验证 commit 与 `dist/`，恢复上一版配置并重启服务。不要在回滚时自动重跑旧初始化 SQL。
3. 新增的 `chat_request_receipts` / `chat_feedback` 表先保留，不执行反向 `DROP`；旧应用是否兼容须以 7.4 回滚演练结果为准。只有经确认数据和 schema 必须恢复时，才按批准的备份恢复方案操作。
4. 验证首页、`/api/health`、登录、`/api/chat/stream`、来源展示、社区帖子/审核与 HTTPS；记录触发原因、恢复版本、耗时和数据处理结果。

2026-10-23 已做一次回滚演练：部署脚本将 current 从 `a6f94f3...` 切到上一版 `7115da6...`，上一版本机健康检查通过，随后将 current 恢复到 `a6f94f3...`；恢复后公网 `/api/health` 为 HTTP 200 且 releaseId 匹配。演练不包含真实故障触发，也没有记录用户可见的回滚窗口。试用前仍需由负责人确认告警阈值与回滚批准人。

## 尚未完成与后续签收

- 0.2 视觉状态稿确认、5.x 办事指南人工数据、5.4 Top 50 金标仍待处理。
- 7.3 GitHub Actions workflow 已于 2026-10-22 在 [run 39714486081](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39714486081) 全绿；Top 20、browser 和 MySQL job 均有远端证据。后续发布候选仍须记录对应 commit 的 run。
- CD workflow 已在默认分支成功部署当前线上 release（[Deploy run 39893338172](https://github.com/lwenjie04/ai-campus-agent/actions/runs/39893338172)）；这只证明自动部署链路可用，不代表 7.4 完成或发布已签收。
- 7.4 已有生产验证：真实 LLM/RAG 样本、MySQL 增量迁移与反馈持久化、备份恢复、HTTPS/Nginx/SSE、五档响应式检查、首段后取消、资源体积与回滚演练。详细结果和未完成项见 [`release-checklist.md`](../release-checklist.md) 及 [`product-status.md`](../product-status.md)。
- 7.4 仍待登录会话与社区知识管理 API 验证、验证码邮件到达/过期/重发、登录态 TTS 播放/限频、真实模型异常处理和人工确认。真实 embedding 未配置，MySQL 应用账号最小权限需 DBA 复核。
- 发布版本与 tag、试用日期/人数、实际用户问题与结论尚未提供；不在此草案中预填。

**收口动作**：7.4 通过后，补齐上方发布标识、验证链接/附件、回滚演练和审批人，并填写 [`v2-trial-record.md`](v2-trial-record.md)。
