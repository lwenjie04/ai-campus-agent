# Backend（最小可用版）

当前后端为无额外依赖的 Node.js HTTP 服务，提供：

- `GET /health`
- `POST /chat`

支持两种模式：

- `mock`：本地演示，不调用真实模型
- `openai_compatible`：调用 OpenAI 兼容接口（如 DeepSeek API）

## 启动

在项目根目录执行：

```bash
npm run server
```

默认端口：`3000`

## 环境变量（推荐）

后端现在支持自动读取以下文件（如果存在）：

- `server/.env`
- `.env.server`

示例可参考：`server/.env.example`

推荐做法：在 `server/.env` 写入你的 DeepSeek 配置（不要提交到仓库）。

示例：

```env
PORT=3000
LLM_PROVIDER_MODE=openai_compatible
LLM_API_BASE_URL=https://api.deepseek.com
LLM_API_KEY=你的DeepSeekKey
LLM_MODEL=deepseek-chat
CORS_ORIGIN=http://localhost:5173
```

## 不使用 .env 文件（PowerShell）

```powershell
$env:LLM_PROVIDER_MODE='openai_compatible'
$env:LLM_API_BASE_URL='https://api.deepseek.com'
$env:LLM_API_KEY='你的Key'
$env:LLM_MODEL='deepseek-chat'
npm run server
```

## 接口示例

### `GET /health`

返回服务状态、模型模式等信息。

### `POST /chat`

请求体：

```json
{
  "messages": [
    { "role": "user", "content": "补考怎么报名？" }
  ]
}
```

响应体（示例）：

```json
{
  "content": "考试类问题通常需要确认课程名称、学期和考试类型……",
  "intent": "exam",
  "videoCue": "exam",
  "sources": [],
  "requestId": "..."
}
```

说明：

- `intent` / `videoCue` 已预留给前端数字人视频触发策略
- `sources` 为后续 RAG 的来源展示预留字段
