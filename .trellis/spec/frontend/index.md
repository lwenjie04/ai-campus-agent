# 前端开发指南（Vue 3）

> 校园智能问答平台前端开发约定。基于真实代码总结，子代理据此写出与团队一致的前端代码。

## 技术栈

- **框架**: Vue 3.5 + `<script setup lang="ts">`
- **构建工具**: Vite 7
- **语言**: TypeScript（经 `vue-tsc --build` 类型检查）
- **状态管理**: Pinia（Options API 风格：`state` / `getters` / `actions`）
- **UI 组件库**: Element Plus（全局注册 + `ElMessage` 按需导入）
- **HTTP**: axios（`api/auth.ts`、`api/llm.ts`）与 fetch（`api/community.ts`、`api/tts.ts`）
- **代码质量**: oxlint + eslint（vue-ts 配置）+ prettier
- **路由**: 未使用 Vue Router，页面切换由 `App.vue` 内 `activeSection` 等 ref 控制

---

## 文档索引

| 文件 | 内容 | 优先级 |
| --- | --- | --- |
| [directory-structure.md](./directory-structure.md) | 目录结构、命名、导入约定 | **必读** |
| [components.md](./components.md) | SFC 结构、props/emits、Element Plus 用法 | **必读** |
| [state-management.md](./state-management.md) | Pinia store 模式、localStorage 持久化 | **必读** |
| [type-safety.md](./type-safety.md) | 类型组织、`@/` 别名、泛型约束 | **必读** |
| [hooks.md](./hooks.md) | 组合式逻辑的组织方式（module 函数 + computed/watch） | 参考 |
| [css-design.md](./css-design.md) | scoped 样式、`:deep()`、设计语言 | 参考 |
| [quality.md](./quality.md) | lint / type-check / 提交前检查 | 参考 |

---

## 按任务快速导航

### 开发前

| 任务 | 文档 |
| --- | --- |
| 了解目录与导入规则 | [directory-structure.md](./directory-structure.md) |
| 了解组件写法 | [components.md](./components.md) |

### 开发中

| 任务 | 文档 |
| --- | --- |
| 新增/修改状态 | [state-management.md](./state-management.md) |
| 新增页面或组件 | [components.md](./components.md) |
| 定义类型 | [type-safety.md](./type-safety.md) |

### 提交前

| 任务 | 文档 |
| --- | --- |
| 检查代码质量 | [quality.md](./quality.md) |
| 统一样式 | [css-design.md](./css-design.md) |

---

## 核心规则速览

| 规则 | 参考 |
| --- | --- |
| 组件使用 `<script setup lang="ts">` | [components.md](./components.md) |
| props/emits 使用类型化 `defineProps` / `defineEmits` | [components.md](./components.md) |
| 业务状态放进 Pinia store，组件内不存 | [state-management.md](./state-management.md) |
| store 使用 Options API（`state`/`getters`/`actions`） | [state-management.md](./state-management.md) |
| API 调用集中在 `src/api/`，经 `appConfig.apiBaseUrl` 拼接 | [type-safety.md](./type-safety.md) |
| 类型定义集中在 `src/types/`，统一 `import type` | [type-safety.md](./type-safety.md) |
| 样式一律 `scoped`，覆盖 Element Plus 用 `:deep()` | [css-design.md](./css-design.md) |
| 提交前跑 `npm run type-check` 和 `npm run lint` | [quality.md](./quality.md) |

---

## 语言约定

- 代码注释使用**中文**，解释「为什么」而不是「是什么」。
- 组件/变量/函数标识符使用英文 camelCase / PascalCase。
- 用户可见文案使用中文。
