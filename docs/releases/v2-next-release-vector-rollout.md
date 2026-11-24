# 下批发布：真实 Embedding 上线计划（2026-11-24）

**分支**：`feat/rag-vector-cosine-gate`（含 `RAG_VECTOR_MIN_COSINE` 代码门槛、测试与 env 示例）
**前置验收**：见 [`v2-7.4-acceptance-20261124.md`](v2-7.4-acceptance-20261124.md) §2.6、§2.9、§3.3
**原则**：先合并发布代码 → 再在目标环境构建真实索引并切换配置；失败可回滚到 hash 索引与旧权重。

## 1. 发布代码

1. 分支合并到 `master`（走 PR 或本地合并），等待 Quality 五 job 全绿；CD 默认会在 CI 通过后部署。
2. 如果只想先发布代码、暂不启用真实向量：保持 `RAG_VECTOR_ENABLED` 现状与 `RAG_VECTOR_MIN_COSINE=0`，本次代码对现有 hash 行为无影响（门槛关闭时不改变检索）。

## 2. 目标环境准备（服务器，需 sudo/负责人操作）

- [ ] 备份现有数据与配置：

```sh
cd /var/www/ai-campus-agent
sudo cp -p shared/data/vector-index.json shared/data/vector-index.hash.bak-$(date +%Y%m%d).json
sudo cp -p shared/server.env shared/server.env.bak-$(date +%Y%m%d%H%M%S)
```

- [ ] 在 `shared/server.env` 增加（权限保持 `600`，密钥不写入仓库/日志）：

```ini
VECTOR_EMBEDDING_PROVIDER=openai_compatible
VECTOR_EMBEDDING_API_BASE_URL=https://api.siliconflow.cn/v1
VECTOR_EMBEDDING_API_KEY=<负责人写入>
VECTOR_EMBEDDING_MODEL=BAAI/bge-m3
VECTOR_EMBEDDING_DIM=1024
VECTOR_EMBEDDING_TIMEOUT_MS=60000
RAG_VECTOR_ENABLED=true
RAG_VECTOR_TOPK=8
# 语义命中准入门槛：低于该余弦相似度的向量命中不参与合并
RAG_VECTOR_MIN_COSINE=0.60
# 调优值：权重 14 + 答案门槛 9（见 7.4 §2.9）
RAG_WEIGHT_VECTOR_SCORE=14
RAG_ANSWER_MIN_SCORE=9
```

- [ ] 用发布代码重建切片与真实索引（`current/server/data` 是 `shared/data` 的符号链接，产物落共享目录）：

```sh
cd /var/www/ai-campus-agent/current
set -a; . /var/www/ai-campus-agent/shared/server.env; set +a
node server/scripts/build-chunked-kb.mjs --official-only
node server/scripts/build-vector-index.mjs \
  --input server/data/chunked-knowledge-base.json \
  --output server/data/vector-index.json
node server/scripts/check-vector-readiness.mjs \
  --expect-provider openai_compatible --expect-model BAAI/bge-m3 --expect-dimension 1024
```

- [ ] 重启后端并复核本机健康：

```sh
sudo pm2 restart ai-campus-agent-backend
curl -s http://127.0.0.1:3000/health
```

## 3. 验收标准（发布后 24h 内）

- [ ] `/api/health` 200 且 releaseId 与本次部署一致。
- [ ] 服务器内 Top20 金标：`node server/scripts/evaluate-rag-golden.mjs --limit 20 --vector --json`，通过数 ≥ 19/20（隔离环境实测 19/20；原 hash 基线 18/20）。
- [ ] 公网真实问答：首 delta 正常、来源 ≥ 1；金额/标准类问题仍前置官方来源。
- [ ] 负例问题（如“今天广州天气怎么样”“帮我算一下个税”“推荐一部电影”）不返回伪确定性答案，走低置信/无法确认路径。
- [ ] 观察 `server/logs/rag-search.log.ndjson` 中 `vectorHits` 与命中分布；观察未命中率与「无法确认」比例是否明显上升。

## 4. 回滚

任一步异常时：

```sh
cd /var/www/ai-campus-agent
sudo cp -p shared/data/vector-index.hash.bak-YYYYMMDD.json shared/data/vector-index.json
# 方案 A：整体恢复配置
sudo cp -p shared/server.env.bak-YYYYMMDDHHMMSS shared/server.env
# 方案 B：只关掉真实向量（保留代码）
#   把 RAG_VECTOR_ENABLED 改为 false 或删除 RAG_VECTOR_MIN_COSINE/RAG_WEIGHT_VECTOR_SCORE 覆盖行
sudo pm2 restart ai-campus-agent-backend
curl -s http://127.0.0.1:3000/health
```

## 5. 风险与注意

- `RAG_ANSWER_MIN_SCORE=9` 比默认 3 更保守，可能让部分原本能作答的低分命中改为「无法确认」；若观察期该比例明显上升，可降到 7 并重跑金标，再决定是否保留。
- 真实索引约 20.7MB（660 切片的 1024 维向量），构建需 4–7 分钟与相应 embedding 调用费用；建议低峰执行。
- 生产 embedding 密钥、配额与计费需负责人确认；服务器需能访问 embedding 网关（生产已实测可达 `api.siliconflow.cn`）。
- 发布包不会覆盖 `shared/data` 与 `shared/server.env` 中的生成数据/密钥；切换与回滚都以共享目录为准。
- `server/logs/rag-search.log.ndjson` 会记录 query 原文，上线前确认日志轮转与脱敏策略（已知缺口，可随本批观察）。
