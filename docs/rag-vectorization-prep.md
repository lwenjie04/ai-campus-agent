# RAG 知识库向量化准备

这份说明用于把当前项目的知识库整理到“可向量化、可检索、可复用”的状态。

## 1. 准备目标

当前项目的 RAG 检索已经具备三层能力：

- 关键词检索
- 向量检索
- 关键词 + 向量混合重排

因此，向量化准备不是单独接一个模型就结束，而是要先确认三件事：

1. 源知识库内容是否正常
2. 分块结果是否可用
3. embedding 配置是否完整

## 2. 当前使用的关键文件

- `server/data/knowledge-base.json`
  - 原始知识库
- `server/data/chunked-knowledge-base.json`
  - 分块后的知识库
- `server/data/vector-index.json`
  - 向量索引结果
- `server/vector-index.mjs`
  - embedding 配置、向量生成、向量检索
- `server/rag.mjs`
  - 混合检索与重排

## 3. 建议执行顺序

### 第一步：检查向量化准备状态

```bash
npm run kb:vector:check
```

这个检查会输出：

- 原始知识库是否存在
- 分块文件是否存在
- 当前 embedding provider 是什么
- 配置项是否缺失
- 是否检测到明显乱码

如果这里已经提示 `knowledge-base-encoding` 有问题，建议先修数据，再做向量化。

### 第二步：生成知识块

```bash
npm run kb:chunk
```

如果只想先处理官方知识，不带社区知识：

```bash
node server/scripts/build-chunked-kb.mjs --official-only
```

### 第三步：配置 embedding

在 `server/.env` 中补充或修改：

```env
VECTOR_EMBEDDING_PROVIDER=openai_compatible
VECTOR_EMBEDDING_DIM=1024
VECTOR_EMBEDDING_API_BASE_URL=https://your-api-base-url/v1
VECTOR_EMBEDDING_API_KEY=your_api_key
VECTOR_EMBEDDING_MODEL=your_embedding_model
VECTOR_EMBEDDING_TIMEOUT_MS=30000
RAG_VECTOR_ENABLED=true
RAG_VECTOR_TOPK=8
RAG_WEIGHT_VECTOR_SCORE=6
```

如果当前只是联调流程，也可以先用本地 hash 向量：

```env
VECTOR_EMBEDDING_PROVIDER=hash
VECTOR_EMBEDDING_DIM=256
```

说明：

- `hash` 不依赖外部服务，适合流程打通
- `openai_compatible` 适合后续接入真实 embedding 服务

### 第四步：构建向量索引

```bash
npm run kb:vector
```

也可以手动指定参数：

```bash
node server/scripts/build-vector-index.mjs --provider openai_compatible --dimension 1024
```

## 4. 推荐的实操策略

建议分两阶段推进：

### 阶段 A：先打通流程

- 使用 `hash` provider
- 跑通 `kb:vector:check`
- 跑通 `kb:chunk`
- 跑通 `kb:vector`
- 确认 `server/data/vector-index.json` 正常生成

这一阶段的目标是验证项目链路完整，不是追求最佳召回效果。

### 阶段 B：再切换真实 embedding

- 接入真实向量服务
- 重新构建 `vector-index.json`
- 对比问答召回效果
- 调整 `RAG_VECTOR_TOPK` 和 `RAG_WEIGHT_VECTOR_SCORE`

## 5. 当前最需要优先关注的问题

从现有数据看，知识库源文件中可能存在明显编码异常。如果原始 `knowledge-base.json` 本身就是乱码，那么：

- 分块结果会继续带乱码
- embedding 文本质量会下降
- 最终检索结果会明显变差

所以，向量化之前建议优先确认：

1. 原始知识库是不是 UTF-8 正常文本
2. 标题、正文、分类字段是否可读
3. 导入脚本是否把网页内容以错误编码写入了 JSON

## 6. 建议的下一步

建议我们按这个顺序继续：

1. 先运行 `npm run kb:vector:check`
2. 看是否确实存在知识库乱码
3. 如果有乱码，优先修复原始知识库和导入链路
4. 再切换到真实 embedding 服务生成正式向量索引

这样后面的检索效果才值得调优。
