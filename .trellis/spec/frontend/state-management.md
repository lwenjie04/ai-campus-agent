# 状态管理

> 本项目使用 Pinia，**Options API 风格**（`state` / `getters` / `actions`），不做 setup 风格 store。

---

## 总览

| 状态类型 | 存放位置 | 持久化 |
| --- | --- | --- |
| 登录态 | `useAuthStore`（`store/auth.ts`） | `localStorage`（版本化 key） |
| 问答会话 | `useAgentStore`（`store/agent.ts`） | `localStorage`（版本化 key） |
| 社区业务 | `useCommunityStore`（`store/community.ts`） | 不持久化 |
| 页面 UI 状态（弹窗开关、草稿） | 组件内 `ref` | 不持久化 |

原则：**业务状态进 store，UI 状态留组件**。

---

## Options API store 结构

```ts
import { defineStore } from 'pinia'
import { loginByPassword, type AuthUser } from '@/api/auth'

type AuthRole = 'guest' | 'user' | 'admin'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    loggedIn: false,
    role: 'guest' as AuthRole,
    displayName: '',
    username: '',
    userId: '',
    email: '',
  }),

  getters: {
    isAdmin(state) {
      return state.loggedIn && state.role === 'admin'
    },
    isUser(state) {
      return state.loggedIn && state.role === 'user'
    },
  },

  actions: {
    async login(payload: { account: string; password: string }) {
      const user = await loginByPassword(payload)
      this.applyUser(user)
      return this.role === 'admin' ? 'admin' : 'user'
    },
    logout() {
      this.resetAuthState()
      this.persist()
    },
    // ...
  },
})
```

要点：

- store 内通过 `this` 访问 state 与 action（Options API）。
- `getters` 接收 `state` 参数，从 state 派生布尔/计算值。
- 复杂的内部状态重置抽成私有 action（如 `resetAuthState`）。
- API 调用统一走 `src/api/`，store 只编排调用顺序和状态。

---

## 异步加载模式（loading / lastError / finally）

参考 `src/store/community.ts`，异步 action 统一三件事：

1. 置 `loadingXxx = true`，清空 `lastError`；
2. `try` 中调用 api 并写入 state；
3. `catch` 里把错误信息写入 `lastError`（供页面 `el-alert` 展示）；
4. `finally` 复位 `loadingXxx = false`。

```ts
async loadPosts() {
  this.loadingList = true
  this.lastError = ''
  try {
    const data = await getCommunityPosts({
      page: this.page,
      pageSize: this.pageSize,
      category: this.selectedCategory || undefined,
      keyword: this.keyword || undefined,
      sortBy: this.sortBy,
    })
    this.posts = data.list
    this.total = data.pagination.total
  } catch (error) {
    this.lastError = error instanceof Error ? error.message : '帖子列表加载失败'
  } finally {
    this.loadingList = false
  }
}
```

错误信息处理统一为：

```ts
this.lastError = error instanceof Error ? error.message : '帖子列表加载失败'
```

页面消费 `lastError`：

```vue
<el-alert v-if="store.lastError" :title="store.lastError" type="warning" show-icon :closable="false" />
```

---

## localStorage 持久化模式

需要跨刷新保留的状态（登录态、会话）手动读写 localStorage，**带版本化 key** 与防御性解析：

### 版本化 key

key 包含项目名与版本号，便于以后变更结构时做迁移：

```ts
const AUTH_STORAGE_KEY = 'ai-campus-agent.auth.v4'
const STORAGE_KEY = 'ai-campus-agent.session.v2'
```

### 环境守卫

访问 `window` 前先判断，避免非浏览器环境报错：

```ts
const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage
```

### hydrate（读）+ persist（写）

```ts
actions: {
  hydrate() {
    if (!canUseStorage()) return
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as PersistedAuthState
      // 只恢复可信字段
      this.loggedIn = Boolean(parsed.loggedIn)
      this.role = normalizeRole(parsed.role)
      // ...
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      this.resetAuthState()
    }
  },

  persist() {
    if (!canUseStorage()) return
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ... }))
  },
}
```

要点：

- **只恢复可信字段**，逐字段做类型收敛（`normalizeRole`、`typeof parsed.xxx === 'string'`）。
- `catch` 里清掉损坏缓存，避免污染后续会话。
- 写入时只持久化「恢复界面所需的最小状态」，不带无关数据。

### 页面挂载时恢复

```ts
// src/App.vue
onMounted(() => {
  authStore.hydrate()
  if (authStore.loggedIn) {
    activeSection.value = authStore.isAdmin ? 'admin' : 'home'
  }
})
```

```ts
// src/views/AgentChat.vue
onMounted(() => {
  store.hydrateSession()
  syncFormFromStore()
  // ...
  store.initAgent()
})
```

---

## 跨组件通信：store 而非事件链

多个视图共享的数据（登录态、会话、社区列表）用 store 共享。页面切换不靠 Vue Router，而是 `App.vue` 里用 `activeSection` / `communityView` 两个 ref 控制：

```ts
// src/App.vue
const activeSection = ref<MainSection>('home')
const communityView = ref<CommunityViewState>('list')
const currentPostId = ref('')

const openPostDetail = (postId: string) => {
  currentPostId.value = postId
  activeSection.value = 'community'
  communityView.value = 'detail'
}
```

store 负责数据，`App.vue` 负责「当前显示哪个页面」。视图之间通过 emit + `App.vue` 中转事件（如 `@open-post` / `@back-list`）。

---

## 避免

- 不要用 setup 风格 store（`defineStore('x', () => {...})`），本项目统一 Options API。
- 不要把 HTTP 细节写进 store；调用 `src/api/`。
- 不要用 `el-state` / Vuex / 其他状态库。
- 不要把页面 UI 状态（弹窗开关、表单草稿）塞进 store。
- 不要无守卫直接访问 `localStorage` / `window`。
