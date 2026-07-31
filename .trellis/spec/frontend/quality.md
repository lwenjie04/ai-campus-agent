# 代码质量

> 提交前检查、lint / 格式化、禁止模式。基于真实配置（`package.json`、`eslint.config.ts`、`.oxlintrc.json`、`.prettierrc.json`）。

---

## 提交前必跑

```bash
npm run type-check   # vue-tsc --build，类型检查
npm run lint         # oxlint + eslint（均带 --fix）
```

检查清单：

- [ ] `npm run type-check` — 无类型错误
- [ ] `npm run lint` — 0 error / 0 warning
- [ ] 手动验证改动功能
- [ ] 无控制台报错

格式化（可选，提交前跑一遍更稳）：

```bash
npm run format       # prettier --write src/
```

---

## 工具链

| 工具 | 配置文件 | 作用 |
| --- | --- | --- |
| oxlint | `.oxlintrc.json` | 快速 lint，`correctness` 级别为 error |
| eslint | `eslint.config.ts` | vue-ts 配置（`@vue/eslint-config-typescript`）+ oxlint 插件 + prettier 冲突规避 |
| vue-tsc | `tsconfig.app.json` | 类型检查 |
| prettier | `.prettierrc.json` | 无分号、单引号、printWidth 100 |

Prettier 关键设置：

```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100
}
```

代码风格要点：

- **无分号**（semi: false）。
- **单引号**（singleQuote: true）。
- 单行长度 100，超长换行。
- 缩进 2 空格。

---

## 禁止模式

| 模式 | 原因 | 修正 |
| --- | --- | --- |
| 非空断言 `!` | 绕过空值检查 | 局部变量 + 空值判断 |
| 类型泄漏 `any` | 丢失类型安全 | 用具体类型或逐字段收敛 |
| 未使用的导入 / 变量 | 死代码 | 删除或 `_` 前缀 |
| 重复定义常量 / 映射 | 维护负担 | 收敛到 `src/types/` 或组件内统一映射 |
| `enum` | 与项目风格不符 | 字符串字面量联合类型 |

---

## 非空断言修正

```ts
// Bad
const name = user!.name

// Good
if (user) {
  const name = user.name
}
```

```ts
// Bad —— 访问可能不存在的元素
const target = this.messages.find(...)!
target.content += delta

// Good —— 局部变量 + 判断
const target = this.messages.find((msg) => msg.id === assistantPlaceholder.id)
if (target) {
  target.content += delta
}
```

---

## 禁止 `any` 泄漏

接口签名、store 状态、props 里禁止裸 `any`。必须解析未知结构时，先用 `any` 接收再逐字段收敛成具体类型：

```ts
// src/api/llm.ts —— 流式事件先 any 解析，再收敛
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
```

注意：`src/store/chat.ts` 存在 `messages: [] as any[]` 的历史遗留反例，**新代码不要模仿**；新消息类型一律用 `Message`（见 `src/types/agent.ts`）。

---

## 错误处理

### API 调用统一 try/catch/finally + lastError

```ts
async loadPosts() {
  this.loadingList = true
  this.lastError = ''
  try {
    const data = await getCommunityPosts({ ... })
    this.posts = data.list
    this.total = data.pagination.total
  } catch (error) {
    this.lastError = error instanceof Error ? error.message : '帖子列表加载失败'
  } finally {
    this.loadingList = false
  }
}
```

### 用户反馈用 ElMessage

```ts
try {
  await store.submitPost({ ... })
  ElMessage.success('帖子已提交，当前默认进入待审核状态')
} catch {
  ElMessage.error(store.lastError || '发布失败，请稍后重试')
}
```

---

## 代码组织

- **组件**：控制在合理规模；超过 ~600 行拆分（当前最复杂组件如 `AgentChat.vue` 约 800 行含样式，尽量保持结构清晰、注释分区）。
- **函数**：单个函数不超过 ~50 行；复杂逻辑抽纯函数（见 [hooks.md](./hooks.md)）。
- **注释**：解释 **WHY** 而非 **WHAT**，用中文。

```ts
// Good —— 解释为什么用递增信号
const stopPlaySignal = ref(0)
// 为什么不用 boolean？因为 boolean 连续点击可能值不变，子组件 watch 不到；
// 数字递增则每次点击都会触发一次变化。
```

---

## 快速参考

| 规则 | 为什么 |
| --- | --- |
| 提交前跑 `type-check` + `lint` | 提前发现问题 |
| 无分号、单引号、100 列 | Prettier 配置 |
| 不用 `!` | 隐藏潜在空值问题 |
| 不用 `any`（接口签名） | 丢失类型安全 |
| 错误收敛为 `lastError` string | 页面统一展示 |
| 中文注释解释 WHY | 团队协作可读性 |
