# 组合式逻辑组织

> 本项目**不使用 React Query / custom hooks**。可复用逻辑按以下方式组织，新增逻辑遵循既有模式。

---

## 现实：三种逻辑归属

本项目没有独立的 `hooks/` 目录。逻辑按依赖情况分三处：

### 1. 模块级纯函数（与组件状态无关的算法）

放在 store 文件或组件文件顶部，组件外定义，接收参数返回结果：

```ts
// src/store/agent.ts —— store 顶部模块级纯函数
const createMessage = (role: Message['role'], content: string, extra?: Partial<Message>): Message => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  createdAt: Date.now(),
  status: 'sent',
  ...extra,
})

const splitSpeakableChunks = (raw: string) => {
  // ...按句子切分
  return { chunks, rest }
}
```

```ts
// src/components/MessageItem.vue —— 组件文件内纯函数
const formatMessageContent = (content: string) =>
  String(content || '').replace(/\*\*(.*?)\*\*/g, '$1')

const resolveSourceHref = (url?: string) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${appConfig.apiBaseUrl}${url}`
  return url
}
```

### 2. Store action（涉及共享状态的动作）

多个组件复用的业务动作放进 Pinia store 的 actions，组件内直接调用：

```ts
// src/store/community.ts
async loadPosts() {
  this.loadingList = true
  this.lastError = ''
  try {
    const data = await getCommunityPosts({ page: this.page, ... })
    this.posts = data.list
    this.total = data.pagination.total
  } catch (error) {
    this.lastError = error instanceof Error ? error.message : '帖子列表加载失败'
  } finally {
    this.loadingList = false
  }
}
```

### 3. 组件内 ref / computed / watch

仅组件本地需要的派生逻辑就地写，不抽目录：

```ts
// src/views/AgentChat.vue
const visibleMessages = computed(() => store.messages.filter((msg) => msg.role !== 'system'))
```

```ts
// src/components/ChatWindow.vue
watch(
  () => [props.messages.length, props.loading],
  async () => {
    await nextTick()
    el.scrollTop = el.scrollHeight
  },
  { immediate: true },
)
```

---

## 何时新建 `composables/`

只有同时满足以下条件才新建 `src/composables/` 下的 `useXxx.ts`：

1. 逻辑被 **两个以上** 组件复用；
2. 逻辑依赖响应式状态（props / ref），无法放进 store 或纯函数；
3. 不是全局共享状态（全局共享状态一律进 store）。

目前项目中尚未出现满足以上条件的案例，因此**优先沿用上述三种既有方式**。

---

## 命名约定

- 纯函数：camelCase，动词开头（`splitNarrationText`、`formatMessageContent`、`resolveSourceHref`）。
- 常量（阈值、上限）：SCREAMING_SNAKE_CASE（`TTS_SEGMENT_MAX_LENGTH`）。
- store action：camelCase，动词或 load 前缀（`loadPosts`、`submitPost`、`setKeyword`）。

---

## 避免

- 不要引入 React Query、axios 之外的请求库；本项目 HTTP 用 axios 或 fetch 封装在 `src/api/`。
- 不要在组件里写大段业务逻辑；放进 store action。
- 不要为单点使用的逻辑提前抽象成 composable。
