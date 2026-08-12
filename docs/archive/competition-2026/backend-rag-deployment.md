# 后端 RAG 部署文档（feat/backend-rag）

> 历史归档：来自 `feat/backend-rag` 分支的比赛期部署方案，保存点为 `9da3af7`。当前产品部署请使用 `../../deploy-server-checklist.md`。

> 面向比赛版（maila.club）的后端 RAG 升级部署说明。
> **前端已锁定（比赛版），本方案只改 `server/` 后端，前端 `src/` 零改动。**

## 1. 背景与约束

- **线上版本**：`codex/archive-online-chat-20260720`（比赛版，前端锁死）
- **开发分支**：`feat/backend-rag`（从比赛版分叉，只加后端 RAG）
- **约束**：`/chat` `/chat/stream` 接口契约不变，前端不用改

## 2. 当前 RAG 架构（三层）

```
用户问题
  ├─ ① LightRAG 层（可选，LIGHTRAG_PRIMARY=true 时启用）
  │     → queryLightRag(mode: hybrid)  知识图谱语义检索
  │     → 失败自动回退下一层
  └─ ② 混合层（始终生效）
        ├─ 关键词检索（ngram + 同义词 + 分类路由 + 时间衰减）
        └─ 向量检索（bge-m3，余弦相似度 top8）
        → 混合重排：final = 关键词分 + 向量分 × 30 → top3
```

**当前实际形态**：`LIGHTRAG_PRIMARY=false`，走「关键词 + bge-m3 向量」混合检索。

## 3. 知识库组织

| 文件 | 内容 | 是否入库 |
|---|---|---|
| `server/data/knowledge-base.json` | 学校通知（396 条） | 是（基线跟踪） |
| `server/data/student-handbook.json` | 学生手册规定（33 份） | 生成物，未跟踪 |
| `server/data/chunked-knowledge-base.json` | 通知分块（410 块） | 生成物 |
| `server/data/handbook-chunked.json` | 手册分块（252 块） | 生成物 |
| `server/data/combined-knowledge.json` | **合并知识库（662 条 = 410 通知块 + 252 手册块）** | 生成物 |
| `server/data/vector-index.json` | bge-m3 向量索引（662 条） | 生成物 |

> 手册原始 docx 放入 `_ingest/student-handbook/`（当前为 304 页手册）。

## 4. 部署步骤

### 4.1 拉取代码

```bash
git fetch origin
git switch -c feat/backend-rag origin/feat/backend-rag   # 若远端已推送
# 或本地直接基于比赛版：git switch -c feat/backend-rag codex/archive-online-chat-20260720
```

### 4.2 配置环境变量（`server/.env`）

从 `server/.env.example` 复制并填写关键项：

```env
# DeepSeek（聊天 LLM）
LLM_API_KEY=sk-你的DeepSeek密钥
LLM_MODEL=deepseek-chat

# SiliconFlow（embedding，bge-m3）
VECTOR_EMBEDDING_PROVIDER=openai_compatible
VECTOR_EMBEDDING_DIM=1024
VECTOR_EMBEDDING_API_BASE_URL=https://api.siliconflow.cn/v1
VECTOR_EMBEDDING_API_KEY=sk-你的SiliconFlow密钥
VECTOR_EMBEDDING_MODEL=BAAI/bge-m3

# LightRAG（与 embedding 共用 SiliconFlow key）
LIGHTRAG_EMBEDDING_BINDING_API_KEY=sk-你的SiliconFlow密钥

# 向量权重（已调优，让手册语义命中不被关键词碾压）
RAG_WEIGHT_VECTOR_SCORE=30

# LightRAG 开关（默认 false = 关键词+向量混合）
LIGHTRAG_PRIMARY=false
```

> ⚠️ `server/.env` 已被 .gitignore 忽略，key 不会提交。

### 4.3 重建向量索引（知识库更新后执行）

```bash
# ① 手册分块（若 student-handbook.json 更新过）
node server/scripts/build-chunked-kb.mjs \
  -i server/data/student-handbook.json \
  -o server/data/handbook-chunked.json

# ② 重新合并知识库（通知分块 + 手册分块 → 662 条）
node -e "
const fs=require('fs');
const kb=JSON.parse(fs.readFileSync('server/data/chunked-knowledge-base.json','utf8'));
const hb=JSON.parse(fs.readFileSync('server/data/handbook-chunked.json','utf8'));
fs.writeFileSync('server/data/combined-knowledge.json',
  JSON.stringify([...kb, ...hb.map(c=>({...c, sourceType:'student_handbook'}))]));
"

# ③ 重建 bge-m3 向量索引（约 90 秒 / 662 条）
node server/scripts/build-vector-index.mjs \
  -i server/data/combined-knowledge.json \
  -o server/data/vector-index.json
```

### 4.4 启动后端

```bash
npm run server          # = node server/index.mjs（从仓库根启动）
# 验证
curl http://localhost:3000/api/health
```

### 4.5 验证检索

```bash
# 从仓库根跑，先模拟 index.mjs 加载 .env
node -e "
const fs=require('fs');
for(const l of fs.readFileSync('server/.env','utf8').split(/\r?\n/)){
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<=0)continue;
  const k=t.slice(0,i).trim(),v=t.slice(i+1).trim();
  if(!(k in process.env)) process.env[k]=v;
}
import('./server/rag.mjs').then(async m=>{
  for(const q of ['考试作弊怎么处理','学位证怎么拿','助学贷款','转专业条件']){
    const h=await m.searchKnowledgeBase(q,{limit:3,minScore:0});
    console.log(q,'→',h.map(x=>'['+(x.sourceType==='student_handbook'?'册':'知')+']'+(x.title||'').slice(0,20)).join(' | '));
  }
});"
```

## 5. 调参说明

| 参数 | 默认 | 本次调优 | 说明 |
|---|---|---|---|
| `RAG_WEIGHT_VECTOR_SCORE` | 6 | **30** | 向量分权重，调高让语义匹配（手册）更易命中 |
| `RAG_VECTOR_TOPK` | 8 | 8 | 向量检索取 top N |
| `RAG_KEYWORD_LIMIT_MULTIPLIER` | 3 | 3 | 关键词多取倍数，供混合合并 |
| `VECTOR_EMBEDDING_PROVIDER` | hash | **openai_compatible** | 真实语义向量（bge-m3） |
| `LIGHTRAG_PRIMARY` | false | false | 设 true 启用 LightRAG 主用 |

## 6. 启用 LightRAG（可选，语义最强）

LightRAG 把知识库建成**知识图谱**（实体-关系），能回答跨文档推理问题。

```bash
# ① 准备 Python 环境（Windows）
# 安装 LightRAG 到 .venv-lightrag，生成 lightrag-server.exe
#（start-lightrag.mjs 默认找 .venv-lightrag/Scripts/lightrag-server.exe）

# ② 配置 server/.env（LightRAG 块）
# LIGHTRAG_LLM_BINDING_HOST/API_KEY = DeepSeek（可复用 LLM_API_KEY）
# LIGHTRAG_EMBEDDING_BINDING_HOST/API_KEY = SiliconFlow bge-m3（已配）

# ③ 启动 LightRAG 服务（端口 9621）
node server/scripts/start-lightrag.mjs

# ④ 导入知识建图（学生手册等）
node server/scripts/import-kb-to-lightrag.mjs

# ⑤ 开启 LightRAG 主用
# server/.env: LIGHTRAG_PRIMARY=true
```

> LightRAG 未部署时保持 `LIGHTRAG_PRIMARY=false`，系统自动用「关键词 + bge-m3 向量」混合检索，功能不受影响。

### ⚠️ 实战要点（部署踩过的坑）

1. **后端必须从仓库根启动**：`index.mjs` 用 `process.cwd()` 定位 `.env`（`resolve(process.cwd(), 'server/.env')`）。从 `server/` 目录启动会读不到 `.env` → `LIGHTRAG_PRIMARY` 变 false。启动：根目录 `node server/index.mjs`（即 `npm run server`）。
2. **LightRAG 的 LLM key**：`start-lightrag.mjs` 读 `server/.env` 的 `LIGHTRAG_LLM_BINDING_API_KEY`（**不是** `rag_storage/.../ .env`），此值必须是真实 DeepSeek key，否则建图报 401（`****_key is invalid`）。
3. **LightRAG 认证**：用 fully open 模式（`server/.env` 的 `LIGHTRAG_API_KEY` 留空）。设了无效值会 `Invalid token`，留空且服务以无认证启动即可。
4. **建图失败的文档**：LightRAG 建图偶发 LLM 调用失败（`statuses.failed`），用 `POST /documents/reprocess_failed` 一键重试，无需清空重导。
5. **curl 传中文会乱码**（Git Bash GBK 编码）：测试接口用 `node -e "fetch(...)"`，不要在 curl 命令行直接带中文。
6. **建图时间**：429 条文档 LLM 建图约 2 小时；期间 `LIGHTRAG_PRIMARY=false` 时系统用混合检索兜底，功能不受影响。

## 7. 常用脚本

| 脚本 | 用途 |
|---|---|
| `server/scripts/import-student-handbook-docx.mjs` | 从 `_ingest/student-handbook/*.docx` 导入学生手册 |
| `server/scripts/build-chunked-kb.mjs` | 知识库分块 |
| `server/scripts/build-vector-index.mjs` | 构建 bge-m3 向量索引 |
| `server/scripts/start-lightrag.mjs` | 启动 LightRAG 服务 |
| `server/scripts/import-kb-to-lightrag.mjs` | 知识导入 LightRAG 建图 |
| `server/scripts/check-vector-readiness.mjs` | 检查向量索引就绪状态 |
| `server/scripts/rag-log-analysis.mjs` | RAG 检索日志分析 |

## 8. 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| `/chat` 返回 `LLM_API_KEY_MISSING` | 未配 DeepSeek key | 填 `server/.env` 的 `LLM_API_KEY` |
| embedding 报 `VECTOR_EMBEDDING_CONFIG_MISSING` | 未配 SiliconFlow | 填 `VECTOR_EMBEDDING_API_KEY/MODEL/BASE_URL` |
| SiliconFlow 返回 20015 | 中文经命令行传输编码问题 | 用 node/fetch 调用（代码路径正常） |
| 检索手册知识不命中 | 向量权重低 / 索引未重建 | 确认 `RAG_WEIGHT_VECTOR_SCORE=30`、重建索引 |
| 中文 embedding 全 20015 | key 无 embedding 权限 | SiliconFlow 控制台完成实名认证 |
| LightRAG 启动失败 | Python 环境缺失 | 先部署 .venv-lightrag，或保持 `LIGHTRAG_PRIMARY=false` |
