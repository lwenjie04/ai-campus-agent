# 第一版开发任务拆解（Vue3 优先 / Prompt 工程版）

更新时间：2026-02-22

依据：

- `docs/project-proposal-memory.md`
- 最新确认实现约束：
  - 通用大模型 + 提示词工程（不做微调）
  - 数字人使用预生成视频，回复时触发播放
  - 项目侧重 Vue3 开发

## 目标（MVP v1）

做出一个可演示的广二师校园智能问答前端原型，具备：

- 文本问答（可调用后端接口）
- 基本多轮对话
- Prompt 注入（用户角色/专业/年级）
- 回复触发数字人视频播放（规则化）
- 为 RAG 留接口与数据结构扩展位

## 任务拆解（按优先级）

### P0（必须完成）

1. 聊天界面可用化（Vue3）
- 完善消息列表样式（用户/助手/系统区分）
- 输入框体验优化（发送、禁用、回车、滚动到底部）
- 错误态/加载态/空态展示
- 时间戳与消息状态（发送中/失败）基础支持

2. 会话状态管理（Pinia）
- 规范消息类型（`id`, `role`, `content`, `status`, `createdAt`）
- 会话初始化（system prompt + 用户画像）
- 发送流程状态机（提交 -> 请求中 -> 成功/失败）
- 防重复发送与异常兜底

3. Prompt 工程（替代微调）
- 抽离 system prompt 模板
- 设计校园问答回答规范（准确、步骤化、不确定时说明）
- 注入用户画像（身份/专业/年级）
- 预留“知识来源片段”注入位（为后续 RAG 准备）

4. LLM 接口契约（前后端联调）
- 统一请求/响应结构（至少包含 `content`）
- 增加错误码/错误信息处理
- 支持 mock 数据模式（后端未完成时前端可演示）

5. 数字人视频触发播放（核心演示能力）
- 增加视频播放器区域（可在聊天页顶部/侧边）
- 设计“回复 -> 视频素材”映射规则（关键词/意图类型）
- 回复完成后自动切换并播放对应视频
- 无匹配视频时播放默认待机视频

### P1（强烈建议）

6. Vue3 组件化重构（提升可维护性）
- 拆分 `ChatHeader` / `ChatWindow` / `MessageItem` / `InputBox` / `DigitalHumanPlayer`
- 组件 props/emits 类型化
- 抽离可复用 composables（如 `useChatScroll`, `useVideoPlayer`）

7. RAG 接口预留（不一定接真实检索）
- 扩展消息结构支持 `sources`
- UI 支持“回答依据/来源”展示区域（先隐藏或 mock）
- API 层预留 `retrievedChunks` 字段解析

8. 前端配置化
- 模型名称、API 地址、是否 mock、视频资源映射放入 `src/config`
- 环境变量管理（`VITE_API_BASE_URL`）

### P2（下一阶段）

9. 会话增强能力
- 会话列表/新建会话
- 本地缓存（localStorage）
- 常见问题快捷入口

10. 视频播放策略升级
- 基于意图类型而非关键词触发
- 播放队列/防抖（避免连续切视频）
- 播放状态回调（播放结束回待机）

11. 流式输出体验（如果后端支持）
- 流式消息渲染
- 打字机效果
- 边输出边触发视频策略

## 建议的数据结构（前端先行）

### Message（建议）

```ts
type ChatRole = 'system' | 'user' | 'assistant'

interface MessageSource {
  title: string
  url?: string
  snippet?: string
}

interface Message {
  id: string
  role: ChatRole
  content: string
  status?: 'pending' | 'sent' | 'error'
  createdAt: number
  sources?: MessageSource[]
  intent?: string
  videoCue?: string
}
```

### 数字人视频映射（建议）

```ts
interface VideoCueRule {
  key: string
  keywords?: string[]
  intent?: string
  file: string
  priority?: number
}
```

## 第一轮里程碑（建议按这个顺序做）

1. 修正并稳定聊天基础交互（消息类型、滚动、错误态）
2. 抽离 Prompt 模板与配置
3. 加入数字人视频播放器与默认视频
4. 实现“回复完成 -> 视频触发播放”
5. 增加 mock 模式与配置化 API
6. 预留 RAG 来源字段与 UI 区域

## 已确认实现细节（2026-02-22）

1. 视频素材
- 暂时缺少素材，先预留文件夹
- 格式统一为 `mp4`

2. 视频触发方式
- 当数字人做出回复时自动触发视频播放
- 当前实现采用前端规则匹配（后续可升级为后端返回 `intent`）

3. 页面布局
- 数字人视频在左侧，聊天区域在右侧

4. 后端现状
- 暂无后端接口
- 当前前端默认启用 `mock` 模式，保留后续切换到真实接口的能力
