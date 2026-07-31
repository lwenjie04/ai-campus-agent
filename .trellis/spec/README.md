# 开发指南（Spec）

本项目开发约定按层存放于 `.trellis/spec/`。AI 子代理（`trellis-implement` / `trellis-check`）会按任务清单加载对应文件，因此**这里的文档描述的是真实代码约定**，而非理想目标。

## 技术栈

- **前端**: Vue 3.5 + `<script setup lang="ts">`、TypeScript、Pinia、Element Plus、Vite 7
- **后端**: Node.js 原生 HTTP 服务（`server/`）、MySQL、Nodemailer、腾讯云 TTS
- **构建**: Vite（前端）、node 直接运行（后端）
- **代码质量**: oxlint + eslint（vue-ts 配置）+ vue-tsc + prettier

## 结构

### [Frontend](./frontend/index.md)

Vue 3 前端开发约定（**已按本仓库真实代码填充**）：

- [目录结构](./frontend/directory-structure.md)
- [组件指南](./frontend/components.md)
- [状态管理（Pinia）](./frontend/state-management.md)
- [组合式逻辑组织](./frontend/hooks.md)
- [类型安全](./frontend/type-safety.md)
- [CSS 与设计约定](./frontend/css-design.md)
- [代码质量](./frontend/quality.md)

### [Guides](./guides/index.md)

通用思考指南（思维模板，非项目特定）。

### [Backend](./backend/index.md) / [Shared](./shared/index.md) / [Big Questions](./big-question/index.md)

> ⚠️ 当前仍为通用模板内容（Electron + SQLite + Zod 等），**尚未按本项目后端（Node.js + MySQL）重写**。在这些目录重写完成前，请勿依赖其中的技术栈描述；`server/` 代码以 `README.md` 与 `docs/` 为准。

## 使用方式

1. 开发某层功能前，阅读对应 spec 文件。
2. 参考真实代码示例（spec 中引用的 `src/`、`server/` 路径）。
3. 提交前按 [frontend/quality.md](./frontend/quality.md) 与对应后端规范自查。

## 维护

- 规范文件描述真实约定；约定变化时同步更新 spec。
- 引用真实文件路径与示例，不用虚构代码。
- 注释与正文语言：中文。
