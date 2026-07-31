# 组件指南

> Vue 3 单文件组件写法：结构、props/emits、Element Plus 用法、加载状态。

---

## SFC 标准结构

组件统一使用 `<script setup lang="ts">`。模板、脚本、样式三段顺序固定：

```vue
<template>
  <!-- 模板：结构 + Element Plus 组件 + 条件渲染 -->
</template>

<script setup lang="ts">
// 逻辑：import → props/emits → store → 本地状态 → 方法 → 生命周期
</script>

<style scoped>
/* 样式：一律 scoped */
</style>
```

示例来源：`src/components/InputBox.vue`、`src/views/CommunityView.vue`。

---

## Props 与 Emits：必须类型化

用泛型 `defineProps` / `defineEmits` 声明，禁止在模板里推断类型或使用 `any`。

### 类型化 props

```ts
// src/components/InputBox.vue
const props = defineProps<{
  loading: boolean
}>()
```

```ts
// src/components/DigitalHumanPlayer.vue —— 可选 prop
const props = defineProps<{
  cueKey: string
  playSignal: number
  narrationText?: string
  narrationSignal?: number
  stopSignal?: number
}>()
```

### 类型化 emits（两种写法均可，本项目都有使用）

方式一（带参数名，社区等较新组件采用）：

```ts
// src/components/InputBox.vue
const emit = defineEmits<{
  send: [content: string]
}>()

const send = () => {
  const content = text.value.trim()
  if (!content || props.loading) return
  emit('send', content)
  text.value = ''
}
```

方式二（函数签名，消息类组件采用）：

```ts
// src/components/MessageItem.vue
const emit = defineEmits<{
  (e: 'openCommunityPost', postId: string): void
}>()
```

模板中转发事件用 `$event`：

```vue
<!-- src/views/AgentChat.vue -->
<ChatWindow
  :messages="visibleMessages"
  :loading="store.loading"
  @open-community-post="emit('openCommunityPost', $event)"
/>
```

### 规则

- 每个 prop / emit 都要有明确类型。
- 命名用 camelCase；模板中绑定事件用 kebab-case（Vue 自动转换）。
- 组件「做什么」用 emit 通知父组件，「怎么做」由父组件或 store 决定（见下方事件委托）。

---

## 单向数据流 + 事件委托

子组件不直接调用 store 的业务动作（例如发消息、提交帖子），而是向上抛事件，由父组件或 store 统一处理：

```ts
// src/components/InputBox.vue —— 只收集输入并 emit，不发起请求
const send = () => {
  emit('send', content)
  text.value = ''
}
```

```vue
<!-- src/views/AgentChat.vue —— 父组件把事件接到 store 动作 -->
<InputBox :loading="store.loading" @send="store.sendMessage" />
```

例外：仅当组件本身就是某领域入口（如 `MessageItem` 展示来源）时，可用 store 派生数据。

---

## 本地状态用 ref，派生值用 computed

- 纯 UI 状态（弹窗开关、草稿输入、表单）用 `ref`，不需要持久化。
- 依赖其他响应式状态计算的值用 `computed`。

```ts
// src/views/AgentChat.vue
const settingsDialogVisible = ref(false)              // UI 状态
const draftMajor = ref(selectedMajor.value)           // 草稿
const visibleMessages = computed(
  () => store.messages.filter((msg) => msg.role !== 'system'),
)
const roleLabel = computed(() => roleLabelMap[selectedRole.value] || '用户')
```

### 「信号递增」模式：强制子组件响应

当布尔值可能不变导致 watch 不触发时，用递增计数作为信号（本项目多处使用）：

```ts
// src/views/AgentChat.vue —— 每次点击都 +1，子组件一定能 watch 到
const stopPlaySignal = ref(0)
const onStopPlayback = () => {
  store.stopNarrationPlayback()
  stopPlaySignal.value += 1
}
```

```ts
// src/store/agent.ts —— store 内部同样用 tick 通知播放器
triggerVideoCue(cue: 'greeting' | 'idle' | 'teaching') {
  this.videoCueKey = cue
  this.videoPlayTick += 1
}
```

---

## watch 的使用

props 或 store 状态驱动副作用时用 `watch`。涉及 DOM 更新先 `await nextTick()`。

```ts
// src/components/ChatWindow.vue —— 消息变化后滚动到底部
watch(
  () => [props.messages.length, props.loading],
  async () => {
    await nextTick()
    const el = containerRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  },
  { immediate: true },
)
```

```ts
// src/components/DigitalHumanPlayer.vue —— 监听信号 prop
watch(
  () => props.playSignal,
  () => {
    void playCurrentVideo()
  },
  { immediate: true },
)
```

---

## Element Plus 用法

### 全局组件

Element Plus 已在 `src/main.ts` 全局注册，模板中直接使用 `<el-xxx>`：

```vue
<el-button type="primary" round :loading="store.submitting" @click="submitPost">
  提交
</el-button>
<el-input v-model="keywordInput" clearable placeholder="搜索..." @keyup.enter="applyFilters" />
<el-skeleton :loading="store.loadingList" animated :rows="5">
  <template #default>
    <el-empty v-if="!store.posts.length" description="暂无数据" />
    <div v-else>...</div>
  </template>
</el-skeleton>
```

常见组合（参考 `CommunityView.vue`、`AdminReviewView.vue`、`LoginView.vue`）：

| 场景 | 组件组合 |
| --- | --- |
| 数据列表 + 加载态 | `el-skeleton` 包裹列表，空数据用 `el-empty` |
| 表单 | `el-form` + `el-form-item` + `el-input` / `el-select` |
| 弹窗 | `el-dialog` + `destroy-on-close` + `#footer` 插槽 |
| 提示 | `el-alert`（错误） + `ElMessage`（操作反馈） |
| 标签 | `el-tag round`，状态用 `type`（`success`/`warning`/`danger`/`info`） |
| 切换 | `el-tabs` / `el-segmented` |

### 全局方法按需导入

`ElMessage` 不能从全局实例调用，直接从 `element-plus` 导入：

```ts
import { ElMessage } from 'element-plus'

try {
  await store.submitPost({ ... })
  ElMessage.success('帖子已提交')
} catch {
  ElMessage.error(store.lastError || '发布失败')
}
```

### 弹窗宽度

移动端优先的宽度写法：

```vue
<el-dialog v-model="editorVisible" title="发布帖子" width="min(720px, calc(100vw - 32px))" destroy-on-close>
```

---

## 加载 / 空状态 / 错误状态

参考 `src/views/CommunityView.vue` 的完整范式：

```vue
<section class="list-card">
  <el-alert v-if="store.lastError" :title="store.lastError" type="warning" show-icon :closable="false" />

  <el-skeleton :loading="store.loadingList" animated :rows="5">
    <template #default>
      <div v-if="store.posts.length" class="post-list">
        <!-- v-for 列表 -->
      </div>
      <el-empty v-else description="当前还没有匹配的帖子，欢迎发布第一条讨论" />
    </template>
  </el-skeleton>
</section>
```

约定：

- **loading**：从 store 的 `loadingXxx` 读取，用 `el-skeleton` 包裹内容区。
- **empty**：列表为空用 `el-empty`，description 写对用户友好的文案。
- **error**：store 统一存 `lastError` 字符串，页面顶部用 `el-alert` 展示。

---

## 表单校验

本项目暂未使用 `el-form` 的 rules 校验，改用提交前手动校验 + `ElMessage.warning`：

```ts
const submitPost = async () => {
  if (!form.value.authorName.trim() || !form.value.title.trim() || !form.value.content.trim()) {
    ElMessage.warning('请先填写昵称、标题和正文')
    return
  }
  // ...
}
```

保持这一轻量模式即可，不必引入重型校验规则。

---

## 关键模式速查

| 模式 | 说明 |
| --- | --- |
| `defineProps<{...}>()` | 类型化 props |
| `defineEmits<{...}>()` | 类型化事件 |
| `:deep(.el-select__wrapper)` | 覆盖 Element Plus 内部样式 |
| `ref` + `computed` | UI 状态 + 派生值 |
| 递增信号 ref | 强制 watch 触发 |
| `ElMessage` | 操作反馈 |
| `el-skeleton` + `el-empty` + `el-alert` | 加载/空/错误三态 |
