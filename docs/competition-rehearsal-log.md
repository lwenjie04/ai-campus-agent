# 比赛连续彩排记录

**目标**：主演示连续成功 10 次；覆盖 LightRAG、模型网络和 TTS 异常；单点失败不伪造答案。
**脚本**：`docs/competition-demo-script.md`
**机器证据**：`server/evals/latest-browser-rehearsal.json`

## 隔离自动彩排（已完成）

运行命令：`npm run competition:rehearse`

环境采用生产构建 + 无头 Chrome；每轮原子清除 Cookie、LocalStorage 和站点数据。LLM 明确使用 Mock，LightRAG 与 TTS 关闭，MySQL 断开并启用强管理员内存回退。该环境不调用外部模型或语音服务，不能替代比赛电脑的真实服务彩排。

| 轮次 | 日期/环境 | 核心链路 | 用时 | 官方 Top 3 来源 | 异常注入 | 结论 |
|---:|---|---|---:|---|---|---|
| 1 | 2026-08-09 / 隔离 | 游客→登录→续问 + 社区审核闭环 | 5.038s | 正确 | LightRAG/TTS/MySQL 关闭 | 通过 |
| 2 | 2026-08-09 / 隔离 | 游客→登录→续问 | 1.159s | 正确 | LightRAG/TTS/MySQL 关闭 | 通过 |
| 3 | 2026-08-09 / 隔离 | 游客→登录→续问 | 1.087s | 正确 | LightRAG/TTS/MySQL 关闭 | 通过 |
| 4 | 2026-08-09 / 隔离 | 游客→登录→续问 | 1.036s | 正确 | LightRAG/TTS/MySQL 关闭 | 通过 |
| 5 | 2026-08-09 / 隔离 | 游客→登录→续问 | 0.982s | 正确 | LightRAG/TTS/MySQL 关闭 | 通过 |
| 6 | 2026-08-09 / 隔离 | 游客→登录→续问 | 1.078s | 正确 | LightRAG/TTS/MySQL 关闭 | 通过 |
| 7 | 2026-08-09 / 隔离 | 游客→登录→续问 | 1.098s | 正确 | LightRAG/TTS/MySQL 关闭 | 通过 |
| 8 | 2026-08-09 / 隔离 | 游客→登录→续问 | 0.920s | 正确 | LightRAG/TTS/MySQL 关闭 | 通过 |
| 9 | 2026-08-09 / 隔离 | 游客→登录→续问 | 1.116s | 正确 | LightRAG/TTS/MySQL 关闭 | 通过 |
| 10 | 2026-08-09 / 隔离 | 游客→登录→续问 | 1.038s | 正确 | LightRAG/TTS/MySQL 关闭 | 通过 |

结果：**10/10 通过，总计 14.552 秒**。第 1 轮还验证了管理员生成社区知识、审核通过、再次问答出现带“仅供参考”提示的社区 RAG 来源。

## 其他异常证据

- 模型网络断开：`server/tests/chat-fallback.test.mjs` 验证不生成伪答案、保留官方来源、游客额度回滚且可重试。
- MySQL 断开：`server/tests/auth-memory-fallback.test.mjs` 验证仅强管理员可通过显式内存回退登录，注册保持关闭，管理权限仍受保护。
- 向量配置不一致：`server/tests/vector-index.test.mjs` 验证索引按自身 provider/dimension 查询，混合索引直接拒绝，不产生误导分数。

## 比赛电脑真实彩排（冻结前必做）

仍需用真实 DeepSeek、真实 MySQL、真实 TTS 和比赛网络完整执行一次 7 分钟脚本。成功后才可设置：

```powershell
$env:COMPETITION_LIVE_REHEARSAL_CONFIRMED='true'
npm run competition:freeze:check
```

不得为了让冻结检查通过而提前设置该变量。
