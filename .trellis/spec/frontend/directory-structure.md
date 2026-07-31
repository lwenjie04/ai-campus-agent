# 目录结构

> 本项目前端目录结构与命名约定。

---

## 顶层目录

```text
src/
├── api/               # 后端接口封装（每个领域一个文件）
│   ├── auth.ts        # 认证：登录、注册、验证码（axios）
│   ├── community.ts   # 学生社区：帖子、回复、审核、知识（fetch）
│   ├── llm.ts         # 问答：sendChat / streamChat（axios + NDJSON 流式）
│   └── tts.ts         # 语音合成：requestBackendTts（fetch，返回 Blob）
│
├── components/        # 跨页面复用的业务组件
│   ├── ChatWindow.vue         # 聊天列表容器（滚动管理）
│   ├── MessageItem.vue        # 单条消息（气泡 + 来源）
│   ├── InputBox.vue           # 输入框（发出 send 事件）
│   ├── DigitalHumanPlayer.vue # 数字人视频播放器（cue 驱动）
│   └── VoiceOrb.vue           # 语音光球可视化
│
├── config/            # 前端配置（环境变量读取统一收口在这里）
│   ├── app.ts         # appConfig：apiBaseUrl、mock 开关、demo 模式等
│   ├── agent.ts       # campusAgent：助手名称与 system prompt 常量
│   └── model.ts       # 模型相关配置（当前为空）
│
├── store/             # Pinia store（一个领域一个文件）
│   ├── auth.ts        # 登录态：role、displayName、localStorage 持久化
│   ├── agent.ts       # 问答会话：messages、流式发送、讲解 cue
│   ├── community.ts   # 社区：帖子、回复、审核、知识
│   └── chat.ts        # 轻量聊天示例 store（早期骨架，业务已并入 agent）
│
├── types/             # 前端领域类型定义
│   ├── agent.ts       # Message、MessageSource、AgentState
│   └── community.ts   # 社区模块全部类型
│
├── views/             # 页面级组件（按页面划分）
│   ├── AgentChat.vue        # 数字人问答首页（主页面）
│   ├── ChatView.vue         # 简易聊天页（演示用）
│   ├── CommunityView.vue    # 社区列表页
│   ├── PostDetailView.vue   # 帖子详情页
│   ├── AdminReviewView.vue  # 管理员审核工作台
│   └── LoginView.vue        # 登录/注册页
│
├── project-text/      # 已入库的校园通知文本（JSON 导出）
├── App.vue            # 根组件：登录态门控 + 顶部导航 + 页面切换
├── main.ts            # 入口：createApp + Pinia + Element Plus
```

其他相关位置：

```text
public/
├── branding/          # 校徽等品牌图片
└── videos/
    └── digital-human/ # 数字人视频：greeting.mp4 / idle.mp4 / teaching.mp4
```

---

## 目录职责

| 目录 | 放什么 | 不放什么 |
| --- | --- | --- |
| `api/` | HTTP 请求封装，返回解析后的数据 | UI 逻辑、状态 |
| `components/` | 可复用、无页面概念的组件 | 页面编排 |
| `views/` | 页面级组件，可组合多个组件与 store | 纯展示的小组件 |
| `store/` | 跨组件共享的响应式状态与业务动作 | HTTP 细节（交给 api/） |
| `config/` | 环境相关常量、开关、提示词 | 业务逻辑 |
| `types/` | 领域类型、接口返回结构 | 运行时函数 |

分层原则：**views → store → api → config / types**。view 可以同时依赖 store 和组件；store 只调用 api；api 只读取 config 和 types，不依赖 store 或组件。

---

## 文件命名约定

| 类型 | 约定 | 示例 |
| --- | --- | --- |
| Vue 组件 / 页面 | PascalCase `.vue` | `ChatWindow.vue`、`PostDetailView.vue` |
| store | camelCase，`useXxxStore` 导出 | `store/auth.ts` → `useAuthStore` |
| api 模块 | camelCase | `api/community.ts` |
| 类型文件 | camelCase，内容 PascalCase | `types/agent.ts` → `Message` |
| 配置 | camelCase，`xxxConfig` 或常量对象 | `config/app.ts` → `appConfig` |

---

## 导入约定

### 路径别名

统一使用 `@/` 别名指向 `src/`（配置见 `vite.config.ts` 与 `tsconfig.app.json` 的 `paths`）。

```ts
import { useAgentStore } from '@/store/agent'
import { appConfig } from '@/config/app'
import type { Message } from '@/types/agent'
import AgentChat from '@/views/AgentChat.vue'
```

### 类型导入

类型一律使用 `import type` 单独导入，与值导入分开。

```ts
// store/agent.ts
import { streamChat } from '@/api/llm'
import type { Message, MessageSource } from '@/types/agent'
```

### 相对导入

同一目录内组件相互引用可用相对路径（如 `ChatWindow.vue` 引入 `MessageItem.vue`）：

```ts
import MessageItem from './MessageItem.vue'
```

### 禁止

- 不要用 `@/store/chat.ts` 这类带扩展名的别名导入（有反例，避免模仿）；统一省略 `.vue` / `.ts` 扩展名。
- 不要跨层反向依赖（组件直接 import api 且不经过 store，除非是纯展示场景）。
