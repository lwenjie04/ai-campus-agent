# LightRAG 接入说明

更新时间：2026-06-08

## 1. 当前接入方式

本项目后端是 Node.js，LightRAG 主体是独立服务。因此当前采用“Node 后端脚本调用 LightRAG API Server”的方式接入。

第一阶段只做三件事：

- 检查 LightRAG 服务是否可用
- 将当前校园知识库导入 LightRAG
- 对 LightRAG 发起查询测试

暂不直接替换现有 `server/rag.mjs`，避免影响当前已经可用的演示链路。

## 2. 新增文件

- `server/lightrag.mjs`
- `server/scripts/check-lightrag.mjs`
- `server/scripts/import-kb-to-lightrag.mjs`
- `server/scripts/query-lightrag.mjs`

## 3. 环境变量

在 `server/.env` 中配置：

```env
LIGHTRAG_API_BASE_URL=http://127.0.0.1:9621
LIGHTRAG_API_KEY=
LIGHTRAG_INSERT_ENDPOINT=/documents/texts
LIGHTRAG_QUERY_ENDPOINT=/query
LIGHTRAG_QUERY_MODE=hybrid
LIGHTRAG_TIMEOUT_MS=120000
```

如果 LightRAG Server 开启了 API Key，请填写 `LIGHTRAG_API_KEY`。

## 4. 检查 LightRAG 服务

```bash
npm run lightrag:health
```

如果 LightRAG Server 没有启动，这一步会报连接失败。

## 5. 预览导入内容

先 dry-run 看看会导入什么文本：

```bash
npm run lightrag:import -- -- --dry-run --limit 1
```

## 6. 导入校园知识库

先小批量试跑：

```bash
npm run lightrag:import -- -- --limit 10 --batch-size 2
```

确认 LightRAG 侧正常后，再导入完整知识库：

```bash
npm run lightrag:import -- -- --batch-size 8
```

默认导入来源：

- `server/data/knowledge-base.json`

也可以指定其他来源：

```bash
npm run lightrag:import -- -- --source server/data/chunked-knowledge-base.json --batch-size 8
```

## 7. 查询测试

```bash
npm run lightrag:query -- -- --query "补考怎么报名"
```

只看 LightRAG 返回的上下文：

```bash
npm run lightrag:query -- -- --query "转专业需要什么条件" --context-only
```

指定查询模式：

```bash
npm run lightrag:query -- -- --query "国家励志奖学金什么时候申请" --mode hybrid
```

说明：Windows + npm 环境下，第一个 `--` 交给 npm，第二个 `--` 才能稳定传给脚本。也可以直接执行：

```bash
node server/scripts/import-kb-to-lightrag.mjs --dry-run --limit 1
```

## 8. 后续集成路线

建议分三步推进：

1. 用脚本把现有知识库导入 LightRAG，并记录测试问题效果。
2. 在后端增加 `RAG_PROVIDER=local|lightrag` 配置，让 `/chat` 可切换检索来源。
3. 如果 LightRAG 效果稳定，再把 LightRAG 作为默认检索后端，现有 `server/rag.mjs` 保留为 fallback。
