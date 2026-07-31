# PRD: RAG 检索日志分析脚本

## 背景

`server/rag.mjs` 每次检索都会写 `server/logs/rag-search.log.ndjson`（字段：`ts, query, limit, minScore, preferredCategories, routeMode, hits[]`）。目前这些日志没有消费方——命中率、无命中问题、分类分布都看不到，知识库往哪补全凭感觉。

## 目标

新增 `server/scripts/rag-log-analysis.mjs`，读取检索日志并输出分析，指导知识库补充与 RAG 调参。

## 验收标准

1. 脚本可通过 `npm run rag:analyze -w server` 运行（新增 server 脚本）。
2. 默认输出可读文本汇总，包含：
   - 总查询数、**命中率**（至少 1 条命中的占比）、平均命中条数、平均最高分
   - **无命中查询 TOP N**（默认 10，`--top` 可调）——直接指出知识库缺口
   - 查询分类分布（按 `preferredCategories`）
   - 路由模式分布（`global_only` / `category_only` 等）
   - 被引用最多的命中标题 TOP 5
3. `--json` 输出机器可读 JSON；`--log <path>` 可指定日志文件。
4. 日志文件不存在时给出友好提示而非报错堆栈。
5. 提交推送至 `chore/rag-log-analysis` 分支。
