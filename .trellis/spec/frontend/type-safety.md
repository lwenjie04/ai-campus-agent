# 类型安全

> TypeScript 类型组织、导入路径与 API 泛型约定。

---

## 类型集中在 `src/types/`

领域类型按模块放在 `src/types/` 下，组件、store、api 统一从这里导入，**不要在各组件内重复定义**。

```ts
// src/types/agent.ts —— 消息与来源类型
export type MessageRole = 'user' | 'assistant' | 'system'

export interface MessageSource {
  attachments?: Array<{ name?: string; url?: string }>
  type?: string
  confidence?: number
  title?: string
  url?: string
  postId?: string
  loginRequiredHint?: boolean
  snippet?: string
  note?: string
}

export interface Message {
  id?: string
  role: MessageRole
  content: string
  status?: 'pending' | 'sent' | 'error'
  errorCode?: string
  requestId?: string
  createdAt?: number
  videoCue?: string
  sources?: MessageSource[]
}
```

```ts
// src/types/community.ts —— 社区模块全部类型集中一处
export type CommunityCategoryValue = 'scholarship' | 'teaching' | 'exam' | 'life' | 'general'
export type CommunityStatus = 'pending' | 'approved' | 'rejected'

export type CommunityPost = {
  id: string
  authorName: string
  title: string
  category: string
  tags: string[]
  status: CommunityStatus
  // ...
}
```

---

## 类型导入统一用 `import type`

类型与值分开导入，类型一律加 `type` 关键字：

```ts
// src/api/community.ts
import type {
  CommunityPost,
  CommunityReply,
  CommunityMeta,
  // ...
} from '@/types/community'
import { appConfig } from '@/config/app'
```

```ts
// src/store/agent.ts
import type { Message, MessageSource } from '@/types/agent'
import { streamChat } from '@/api/llm'
```

---

## `@/` 别名

`@/` 指向 `src/`，同时配置在 `vite.config.ts`（`resolve.alias`）与 `tsconfig.app.json`（`paths`），二者必须保持一致。

```ts
import { appConfig } from '@/config/app'
import { useCommunityStore } from '@/store/community'
import type { Message } from '@/types/agent'
```

---

## 枚举值用联合类型 + 中文标签映射

项目不使用 TS `enum` / Zod，而是用字符串字面量联合类型，配合 label 映射表：

```ts
// 类型定义（types/community.ts）
export type CommunityStatus = 'pending' | 'approved' | 'rejected'

// 展示时映射中文标签（组件内 computed）
const categoryLabel = computed(() => {
  const category = store.currentPost?.category
  const match = store.meta.categories.find((item) => item.value === category)
  return match?.label || category || '未分类'
})
```

```ts
// 角色值到中文标签的映射（views/AgentChat.vue）
const roleLabelMap: Record<UserRole, string> = {
  student: '学生',
  teacher: '教师',
  guest: '访客',
}
const roleLabel = computed(() => roleLabelMap[selectedRole.value] || '用户')
```

约定：

- 内部稳定值用英文小写字符串（`'latest' | 'hot'`、`'student' | 'teacher'`）。
- 显示文本不直接写死，用 `Record<联合类型, string>` 映射。
- `computed` 中给映射一个兜底值（`|| '未分类'`）。

---

## API 泛型封装

接口返回统一泛型化，调用方拿到的是「已经解析出 data」的强类型值。

### community.ts 的 request 泛型

```ts
type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, { ... })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || !payload || payload.code !== 0) {
    throw new Error(payload?.message || `请求失败：${response.status}`)
  }
  return payload.data
}

export const getCommunityMeta = () => request<CommunityMeta>('/community/meta')
export const getCommunityPosts = (params?: { ... }) =>
  request<CommunityPostsResponse>(`/community/posts${suffix}`)
```

### axios 泛型（auth.ts）

```ts
export const loginByPassword = async (payload: { account: string; password: string }) => {
  const response = await axios.post<{ data: AuthUser }>(`${AUTH_BASE_URL}/auth/login`, payload)
  return response.data.data
}
```

### llm.ts 的流式事件结构

后端 NDJSON 事件先按 `any` 解析再逐字段收敛，避免类型断言污染：

```ts
const processLine = (lineRaw: string) => {
  // ...
  let event: any
  try {
    event = JSON.parse(line)
  } catch {
    return
  }
  if (event.type === 'delta' && typeof event.delta === 'string') {
    handlers.onDelta?.(event.delta)
    return
  }
  // ...
}
```

---

## 边界类型处理约定

### 未知错误收敛为 string

store 里统一把错误收敛成 `lastError` 字符串：

```ts
this.lastError = error instanceof Error ? error.message : '帖子列表加载失败'
```

页面 axios 错误解析（`LoginView.vue`）：

```ts
const extractErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message ||
      error.message ||
      fallback
    )
  }
  return error instanceof Error ? error.message : fallback
}
```

### localStorage 恢复字段逐字段收敛

```ts
// store/auth.ts —— 从缓存恢复时只信任明确类型的字段
const normalizeRole = (role: unknown): AuthRole => {
  if (role === 'admin') return 'admin'
  if (role === 'user') return 'user'
  return 'guest'
}
```

### 可空值用可选链 + 兜底

```ts
const next = String(text || '').trim()
const target = this.messages.find((msg) => msg.id === assistantPlaceholder.id)
if (target) target.content += delta
```

---

## 避免

- 不要重复定义已在 `src/types/` 中存在的类型。
- 不要使用非空断言 `!` 绕过检查；用局部变量 + 空值判断。
- 不要把 `any` 泄漏到接口签名里（llm.ts 的 `event` 解析后必须逐字段收敛为具体类型）。
- 不要用 `enum`；用字符串字面量联合类型。
- 不要引入 Zod / 校验库（当前项目未使用）。
