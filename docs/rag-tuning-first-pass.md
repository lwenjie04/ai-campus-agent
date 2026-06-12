# RAG 第一轮调优

这份文档用于做第一轮混合检索调优，目标不是一次把参数调到最好，而是先确认：

1. Top 命中是否合理
2. 关键词分和向量分是否平衡
3. 不同类型问题是否都能召回正确资料

## 1. 直接跑本地测试

```bash
npm run rag:test
```

默认会测试这些问题：

- 国家励志奖学金什么时候申请
- 补考怎么报名
- 宿舍报修怎么申请
- 清明节放假怎么安排
- 转专业需要什么条件

如果只测一个问题：

```bash
node server/scripts/test-rag-retrieval.mjs --query "补考怎么报名" --limit 5
```

## 2. 重点看什么

输出里重点看这些字段：

- `title`
- `category`
- `score`
- `keywordScore`
- `vectorScore`
- `matchedTerms`
- `snippet`

### 理想状态

- Top1 或 Top2 就命中正确主题
- `keywordScore` 和 `vectorScore` 都有贡献
- `matchedTerms` 能反映用户问题中的关键术语
- `snippet` 看起来和问题确实相关

### 常见问题

#### 远端 embedding 太慢，调试一直卡住

表现：

- `npm run rag:test` 很久不返回
- 单条查询也要等很久

建议：

```env
VECTOR_EMBEDDING_TIMEOUT_MS=30000
```

如果网络波动较大，也可以先提高到：

```env
VECTOR_EMBEDDING_TIMEOUT_MS=45000
```

#### 关键词太强，语义检索太弱

表现：

- 只有字面匹配强的问题召回好
- 稍微换个表达就召回变差

可调项：

```env
RAG_WEIGHT_VECTOR_SCORE=7
RAG_VECTOR_TOPK=10
```

#### 向量太强，召回开始飘

表现：

- 语义接近但主题不准
- Top 命中不够稳定

可调项：

```env
RAG_WEIGHT_VECTOR_SCORE=4
RAG_VECTOR_TOPK=6
```

#### 候选集太窄

表现：

- 明明库里有资料，但最终没进 Top3

可调项：

```env
RAG_KEYWORD_LIMIT_MULTIPLIER=4
RAG_VECTOR_TOPK=10
```

## 3. 当前建议起点

对于校园知识库这种“术语明显、问法也有一定变化”的场景，建议先用这组参数作为第一轮：

```env
RAG_VECTOR_ENABLED=true
RAG_VECTOR_TOPK=10
RAG_WEIGHT_VECTOR_SCORE=7
RAG_KEYWORD_LIMIT_MULTIPLIER=4
```

理由：

- 让向量检索比现在更有参与度
- 让关键词候选集更宽一点
- 混合重排时更容易把“语义对但字面不完全一致”的结果拉上来

## 4. 建议的调优顺序

不要一次改太多，建议按下面顺序改：

1. 先把 `RAG_WEIGHT_VECTOR_SCORE` 从 `6` 调到 `7`
2. 再把 `RAG_VECTOR_TOPK` 从 `8` 调到 `10`
3. 再把 `RAG_KEYWORD_LIMIT_MULTIPLIER` 从 `3` 调到 `4`

每改一次，都重新跑：

```bash
npm run rag:test
```

## 5. 下一步

第一轮调优完成后，建议再补两件事：

1. 增加一组你项目里真实高频问句
2. 记录“Top1 是否正确、Top3 是否包含正确结果”的人工评估表

这样后面继续调参数时，就不会只凭感觉。
