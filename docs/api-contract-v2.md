# 数智校答 V2 状态与 API 契约（0.4）

**日期**：2026-10-20
**维护者**：AI-2（Codex）
**状态**：已人工签字并冻结（2026-10-20）；作为 4.3、7.1、7.2 的实现基准，不代表相关接口已实现。
**依据**：[`campus-service-v2-development-plan.md`](campus-service-v2-development-plan.md)、[`interaction-flow-v2.md`](interaction-flow-v2.md)、[`development-baseline-v2.md`](development-baseline-v2.md)。

本文冻结目标行为和字段命名。现有实现与目标有差距时，以对应任务验收为准；不得仅凭本文宣称目标环境、MySQL 或真实模型已验证。

## 1. 命名空间与通用约定

- 浏览器端 API 根为 `/api`。新版 Web 只请求 `/api/*`；Vite dev/preview 与生产反向代理将 `/api/` 转发到 Node 服务。页面 URL 使用独立路由命名空间。后端裸路径别名仅作兼容，不作为新版 Web 的调用方式。
- 绝对 API 根只允许明确配置为服务端 API 根（例如 `https://service.example/api`）。统一 URL 构造器负责尾斜杠与 `/api`，调用点不得重复拼接。
- JSON 使用 UTF-8。成功响应沿用各模块既有外层结构；本契约定义新增/关键业务字段。错误响应采用 `{ "error": { "code": string, "message": string, ... }, "requestId": string }`；流式响应每行一个 JSON 对象（NDJSON），不能把 EOF 当作成功终态。
- `requestId` 由服务端生成并贯穿请求日志、流事件、完成凭据与反馈。客户端不得指定或替换其归属。
- Cookie 在同源代理下随请求发送；跨源部署需 `credentials: include`，服务端按凭据策略返回 CORS 头。身份、角色与权限始终由服务端会话验证，客户端 `userId`、角色字段或本地状态不能授权。

## 2. 路由表

| 方法 | API 路径 | 目标行为 / 权限 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务健康状态；不包含密钥或个人数据。 |
| `POST` | `/api/auth/login` | 账号登录；无效凭据 `401 AUTH_INVALID`，限频 `429 AUTH_LOGIN_LOCKED`。 |
| `POST` | `/api/auth/register` | 注册；成功 `201`，按当前产品流程随后登录。 |
| `POST` | `/api/auth/send-register-code` | 请求注册验证码；不得对外暴露账号存在信息。 |
| `POST` | `/api/chat/stream` | NDJSON 问答流；身份可为有效登录会话或未耗尽的游客体验。 |
| `POST` | `/api/chat` | 非流式问答兼容接口；状态、额度和错误语义与流式接口一致。 |
| `GET` | `/api/kb/download?id=…` | 知识库原文件；按现有规则要求管理员会话，未登录 `401`、无权限 `403`。来源附件另按其资源权限校验。 |
| `POST` | `/api/tts` | 语音合成；使用登录会话与既有服务端限频。 |
| `/api/community/*` | 按社区模块既有方法 | 读写权限依具体端点；写入和审核端点由服务端会话/角色校验。 |
| `/api/lightrag/*` | 按管理代理既有方法 | 管理员会话；未配置上游时返回可识别的不可用错误。 |
| `POST` | `/api/feedback` | 本文 §8 定义的回答反馈。仅在凭据持久化可用时启用。 |

健康响应返回 `ok`、`service`、`releaseId`、`providerMode`、`model`、`time`。`releaseId` 由部署环境注入，未部署时为 `local`；响应不包含密钥或个人数据。

API 未命中返回 JSON 404；不得被 SPA 的 `index.html` 回退吞掉。下载未登录与登录无权必须区分 401/403。完整社区、认证、TTS 字段仍以各自端点实现为准，本任务不重定义它们的既有 payload。

## 3. 问答请求、消息和状态

### 请求

```json
{
  "messages": [
    { "role": "user", "content": "如何申请助学金？" }
  ]
}
```

`messages` 为非空数组；`role` 为 `system | user | assistant`，`content` 为非空文本。服务端继续执行消息数量、长度和请求体大小限制。客户端可携带上下文消息，但会话归属、游客额度和反馈主体不从该数组推断。

### 持久化与运行状态

会话至少区分 `schemaVersion`、`conversationId`、`ownerScope`、`title`、`createdAt`、`updatedAt`、`draft`、`messages`。消息有稳定 `messageId`、`role`、`content`、`status`、`requestId`、`sources` 和可选重试关联。

| 状态 | 含义 |
| --- | --- |
| `ready` | 可编辑或等待发送。 |
| `generating` | 请求进行中；可带 `phase` 表示真实服务端阶段。 |
| `done` | 收到合法 `done` 终态，回答完成。 |
| `error` | 请求失败；可携带 `errorCode`、恢复来源和是否可重试。 |
| `interrupted` | 客户端停止、连接中断或刷新时请求未完成；保留已生成文本，可由用户明确重试。 |

页面/本地会话的 `conversationId` 与服务端 `requestId` 是不同标识。运行态绑定会话、回答消息和 `runId`；旧请求的迟到回调不得写入新会话。刷新恢复 `generating` 应转成 `interrupted`，不得自动重发或自动播放。

## 4. 流式事件协议

每一行都是独立 JSON 对象，按收到顺序处理。允许客户端忽略不认识的可选事件；新增事件不得改变已有字段含义。

| 事件 | 字段 | 语义 |
| --- | --- | --- |
| `start` | `type`, `requestId` | 请求已被接受并完成额度预留；必须尽早发送，先于知识检索。 |
| `phase` | `type`, `requestId`, `phase` | 可选真实阶段：`retrieval` 或 `generation`。只有后端进入该阶段才发送，不得模拟进度。 |
| `delta` | `type`, `delta` | 一段回答文本；首次非空 delta 是额度取消结算的边界。 |
| `meta` | `type`, `requestId`, `content`, `intent?`, `videoCue?`, `sources`, `feedbackEligible` | 完整答案及来源元数据；`feedbackEligible` 仅当该请求凭据已成功持久化且反馈可用时为 `true`。 |
| `done` | `type`, `requestId` | 正常终态。客户端仅在收到合法 `done` 后标记 `done`。 |
| `error` | `type`, `requestId`, `error` | 流已开始后的失败终态；`error` 结构见 §7。 |

无论网络 EOF、代理断开还是没有终态标记，都不能推断为 `done`。若响应头尚未发送，失败返回普通 JSON 错误；流开始后使用 `error` 事件并结束流。成功或低匹配的明确答复都属于完成；低匹配答复可以有空 `sources`，不得伪造来源。

## 5. 取消、超时与游客额度结算

额度由服务端最终结算，客户端不重置额度。每个请求先预留；同一预留只允许一次终态结算。重复取消、重复关闭通知、完成与取消竞态均不得造成重复扣减或遗留 `reserved`。

| 结果 | 服务端动作 | 对客户端的状态 |
| --- | --- | --- |
| 完成首个非空回答 delta 前取消/断开 | `rollback`，释放本次预留 | `interrupted`；保留已显示内容（通常为空）。 |
| 首个非空 delta 后用户停止或异常断开 | `commit` 一次 | `interrupted`；保留部分回答。 |
| 检索/模型错误，未成功完成回答 | `rollback`（遵循现有失败回退语义） | `error`，按错误 `retryable` 提示。 |
| 正常完成，包括低匹配安全答复 | `commit` 一次 | `done`。 |
| 完成与取消并发 | 首个有效结算胜出；settled 后后续调用无副作用 | 以服务端实际终态为准，不重复退款或扣额度。 |
| 已携带会话凭据但无效/过期 | 不降级游客、不预留游客额度 | `401 AUTH_SESSION_EXPIRED`，前端保存草稿并要求重新登录。 |

客户端中止信号应传入 fetch；服务端需把客户端断开与上游超时合并，辨别正常响应结束和异常断开。此合同定义边界；传递取消及竞态测试由 4.2/4.3 完成。

## 6. 登录恢复意图

登录意图是前端可恢复动作，不是授权凭据。序列化字段：

```ts
type AuthIntent = {
  intentId: string
  type: 'send_message' | 'open_post' | 'play_answer' | 'open_admin'
  target: { conversationId?: string; messageId?: string; postId?: string; returnTo?: string }
  createdAt: string
  consumedAt: string | null
}
```

- 只在用户明确触发受限操作时创建；同页登录完成后至多消费一次并写入 `consumedAt`。
- 刷新后恢复先询问“继续 / 放弃”；取消不执行动作并保留草稿。待执行发送有 24 小时有效期，超过后要求重新输入/确认。
- `returnTo` 仅允许站内路径，拒绝协议相对 URL、外部 origin、控制字符和 `javascript:` 等不安全值。服务端仍独立鉴权，`open_admin` 不能凭意图获得管理员权限。
- 登录、注册成功不自动跳首页或后台。无效/过期的已有凭据需显式重新登录，不能静默改游客。
- 游客回答登录后关联反馈主体，只能由服务端通过已验证的游客签名 Cookie 建立；前端意图和请求体不得携带 owner/userId 作为授权依据。

## 7. 错误结构与稳定错误码

```json
{
  "error": {
    "code": "LLM_TIMEOUT",
    "message": "模型响应超时，请稍后重试",
    "retryable": true,
    "quotaConsumed": false,
    "sources": []
  },
  "requestId": "server-generated-id"
}
```

`retryable`、`quotaConsumed`、`sources` 为适用时返回的扩展字段；客户端以 HTTP 状态及机器码分支，不解析中文文案。稳定码如下：

| HTTP | 错误码 | 含义 / 行为 |
| --- | --- | --- |
| 400 | `INVALID_JSON`、`INVALID_MESSAGES`、`BODY_TOO_LARGE` | 请求修正前不自动重试。 |
| 401 | `GUEST_LOGIN_REQUIRED` | 游客额度已用或需登录；保留待问内容。 |
| 401 | `AUTH_SESSION_EXPIRED` | 提供的登录会话失效；要求重新登录，不切游客。 |
| 401 | `AUTH_INVALID` | 登录信息无效。 |
| 403 | `FORBIDDEN` | 已登录但无权限；不通过客户端角色状态绕过。 |
| 404 | `NOT_FOUND` | 请求资源/API 不存在；保持 JSON，不返回 SPA HTML。 |
| 409 | `FEEDBACK_NOT_ELIGIBLE` | 请求凭据不存在、未完成或不属于当前主体。 |
| 409 | `FEEDBACK_CONFLICT` | 唯一键竞争/不可接受的反馈状态；重复相同提交应幂等成功。 |
| 409 | `REVIEW_STATE_CONFLICT` | 帖子或回复已经进入相反终态；错误包含当前 `currentStatus`，服务端不改写状态、不写重复审核日志。 |
| 409 | `POST_NOT_APPROVED` | 社区知识生成目标帖子尚未审核通过；错误包含当前 `postStatus`，不可重试生成。 |
| 413 | `BODY_TOO_LARGE` | 请求体超过限制。 |
| 429 | `RATE_LIMITED`、`AUTH_LOGIN_LOCKED` | 限频；可使用 `Retry-After`，等待后由用户重试。 |
| 502/503 | `LLM_*`、`RETRIEVAL_UNAVAILABLE`、`FEEDBACK_STORAGE_UNAVAILABLE`、`KNOWLEDGE_GENERATION_FAILED` | 上游或持久化不可用；知识生成错误带 `retryable`、`postStatus`，并可带已知 `knowledgeId`。 |
| 500 | `INTERNAL_ERROR` | 通用服务错误；响应不泄漏内部堆栈、配置或凭据。 |

具体模块可保留现有机器码（例如 `GUEST_RATE_LIMITED`），但前端映射需在同一语义组内兼容。日志可关联 `requestId`，不得记录完整问答、登录票据、Cookie、验证码或 API 密钥。

## 8. 回答凭据与反馈协议（供 7.1/7.2 实施）

### 回答凭据

每次成功回答产生最小服务端凭据：`requestId`、不可由客户端伪造的主体引用、完成状态、来源 ID 列表、创建/完成时间。默认不保存完整对话正文。只有回答正常完成且凭据持久化成功，`meta.feedbackEligible` 才为 `true`。凭据写入失败不得把已经完成的回答改判失败；返回答案，标记 `feedbackEligible: false` 并记录可定位错误。历史消息没有凭据时不可反馈。

### 提交反馈

```http
POST /api/feedback
Content-Type: application/json
```

```json
{ "requestId": "4f9da5c8-3078-40bb-bd7c-869125aafe63", "value": "helpful" }
```

`value` 只允许 `helpful | none`；`none` 是用户主动撤销当前有帮助选择的显式值。主体从已验证登录会话或签名游客 Cookie 得出；不能接受客户端 `userId`、`ownerScope` 或角色作为身份依据。服务端验证该主体拥有已完成且符合反馈条件的 request receipt，再执行 upsert。

成功返回 `200 { "data": { "requestId": string, "value": "helpful" | "none", "updatedAt": string } }`。同一主体对同一 `requestId` 的重复相同提交幂等成功；唯一约束为主体 + requestId，后续合法值更新该行。伪造/未知 requestId、未完成回答或跨主体请求以 `409 FEEDBACK_NOT_ELIGIBLE` 拒绝；格式错误为 `400 INVALID_FEEDBACK`；限频为 `429 RATE_LIMITED`；数据库不可用为 `503 FEEDBACK_STORAGE_UNAVAILABLE`。失败时前端不得显示“已记录”，并保留重试机会。

登录后的游客回答只在本次有效签名 Cookie 能验证并关联原游客主体时可操作；不因登录而把该回答改挂到任意账号。数据库唯一键提供并发幂等保障；不能以“先查再插”替代约束。MySQL 是非测试环境的持久化来源；内存实现必须由显式测试配置启用。

### 7.2 补充冻结条款（2026-10-21）

请求 JSON 必须且只能包含 `requestId`、`value` 两个字段；`requestId` 为问答接口生成的 UUID，`value` 为 `helpful | none`。传入 `ownerType`、`ownerId`、`ownerScope`、`userId`、角色或其他额外字段均以 `400 INVALID_FEEDBACK` 拒绝，服务端绝不采用客户端指定的主体。

身份从当前有效 Bearer 登录会话和/或通过签名校验的 `campus_guest_id` Cookie 得出。请求同时带有两类凭据时，服务端依次用这些已验证主体匹配 receipt；这样用户登录后仍可凭原游客 Cookie 操作原游客回答，但不会把游客回答迁移给当前账号。缺少有效主体为 `401 FEEDBACK_IDENTITY_REQUIRED`；不存在、未完成、未归属当前凭据的 receipt 为 `409 FEEDBACK_NOT_ELIGIBLE`。

限频按主体每分钟 30 次、来源 IP 每分钟 120 次，超限返回 `429 RATE_LIMITED` 并携带 `Retry-After` 秒数；当前计数在单个 Node 进程内维护。请求带 `Origin` 时必须与服务端配置的 `CORS_ORIGIN` 同源，否则返回 `403 ORIGIN_NOT_ALLOWED`。成功返回 `200 { "data": { "requestId": string, "value": "helpful" | "none", "updatedAt": string } }`；持久化不可用返回 `503 FEEDBACK_STORAGE_UNAVAILABLE`。错误响应顶层 `requestId` 是此次反馈操作的服务端追踪 ID；成功响应中的 `data.requestId` 是被反馈回答的 ID。

`/api/chat/stream` 的 `meta.feedbackEligible` 和 `/api/chat` 的 `feedbackEligible` 都是布尔值，仅在成功回答的 receipt 已持久化后为 `true`。服务端在输出完成态前尝试写 receipt；写入失败不改变已经生成的答案，只返回 `false` 并记录不含正文或凭据的错误码。前端只有在该字段为 `true` 时显示或启用反馈操作；历史消息不得自行推导资格。

## 9. 来源字段

```ts
type MessageSource = {
  sourceId: string
  type: 'official' | 'knowledge_base' | 'community' | 'rule' | 'lightrag'
  title: string
  url?: string
  attachments?: Array<{ name: string; url: string; mimeType?: string }>
  publishedAt?: string | null
  updatedAt?: string | null
  applicablePeriod?: string | null
  validity?: 'current' | 'expired' | 'unknown'
  postId?: string
  snippet?: string
  note?: string
}
```

日期使用 ISO 8601；未知值省略或 `null`，`validity` 默认 `unknown`。必须有可核对证据才标 `current/expired`；不得从标题年份、检索分数或文件名推断有效性。下载类链接使用 `/api/kb/download?id=…`。清理临时票据前需验证规范链接仍可用；不得把票据写入文档或日志。检索分数不是正确率，不作为用户可见“可信度百分比”。

## 10. 功能开放顺序与开关

开关用于控制尚未验收的入口，不构成服务端权限边界。建议环境配置：

| 开关 | 默认值 | 开放条件 |
| --- | --- | --- |
| `VITE_FEATURE_SERVICES` | `false` | 事项数据与来源完成核对、目录及详情链路通过验收。 |
| `VITE_FEATURE_CONVERSATION_HISTORY` | `false` | 多会话存储、迁移和账号隔离验收完成。 |
| `VITE_FEATURE_NARRATION` | `false` | 按需播放、会话权限与取消清理验收完成；不得依靠前端共享密钥授权。 |
| `VITE_FEATURE_FEEDBACK` | `false` | receipt/feedback MySQL 迁移、唯一约束、权限与限频验收完成。 |
| `VITE_FEATURE_ADMIN_RETRIEVAL` | `false` | 仅显示已配置可访问的管理入口；后端仍对每个请求鉴权。 |

不设置或不能识别的开关值按关闭处理。核心问答不依赖这些可选入口；关闭入口不得删除草稿或历史数据。功能开放顺序：先完成 API/路由隔离，再完成会话/取消状态，再开放对应服务目录、讲解和反馈入口。开关只隐藏/禁用 UI，所有管理与数据权限仍在服务端执行。

## 11. 当前实现差异与验收责任

本节差异记录以 2026-10-20 契约签字时的实现状态为准：当时流事件尚无 `phase`，`start` 在检索后发送；来源缺 `sourceId` 与时效字段；问答 `meta` 尚无 `feedbackEligible`；`/api/feedback` 和 receipt 表尚不存在。后续任务的当前实现与验证状态以 [`v2-execution-board.md`](v2-execution-board.md) 为准。登录接口对无效登录返回 `AUTH_INVALID`，过期会话的统一机器码仍需在认证接线任务补齐。

人工签字后，4.3 按 §4–5 实现阶段事件与单次结算，7.1 按 §8 建立只增量迁移和请求凭据，7.2 按 §8 实现反馈端点。接口测试应覆盖成功、错误、伪造归属、重复提交、取消和竞态；不得重跑包含 `DROP TABLE` 的旧 SQL。

## 12. 社区审核与知识生成（6.4 补充冻结条款，2026-10-21）

### 帖子与回复审核状态

- `POST /api/community/review/posts/:id/approve|reject` 与 `POST /api/community/review/replies/:id/approve|reject` 只允许 `pending → approved` 或 `pending → rejected`。
- 对仍为 `pending` 的记录，服务端以原子 `UPDATE ... WHERE id = ? AND status = 'pending'` 执行转换。仅真实转换写一条 review log；并发 approve/reject 只能有一个转换成功。
- 重放已达成的相同目标状态返回 `200`，与首次成功使用相同成功响应且不再写 review log。已进入相反终态时返回 `409`：`{ "error": { "code": "REVIEW_STATE_CONFLICT", "currentStatus": "approved" | "rejected", "retryable": false } }`。
- 审核端点需要管理员身份；无会话返回 `401`，普通账号返回 `403`。

### 通过与知识生成分步

- 帖子 approve 与 `POST /api/community/knowledge/generate` 保持为两个独立请求。知识生成只接受 `postStatus = "approved"` 的帖子；否则返回 `409 { "error": { "code": "POST_NOT_APPROVED", "retryable": false, "postStatus": "pending" | "rejected" } }`。
- 同一帖子至多对应一条 `community_knowledge`。数据库以 `post_id` 唯一约束作最终保护，并在事务内锁定/读取帖子、检查现有知识条目、插入条目、更新帖子知识状态和写生成日志。对已生成的帖子重复请求返回同一 `knowledgeId` 与现有状态，不新增行、不把已审核的知识重置为待审。
- 生成失败不会回滚帖子已通过的审核状态。返回 JSON 错误 `{ "error": { "code": "KNOWLEDGE_GENERATION_FAILED", "retryable": boolean, "postStatus": "approved", "knowledgeId"?: string } }`；HTTP `503` 表示可重试的暂时故障，HTTP `500` 表示当前不可自动重试。`knowledgeId` 仅在服务端能确认已有持久化条目时返回。客户端据此显示“帖子已通过，知识生成失败”，重试时只再次调用 generate，不重复 approve。
