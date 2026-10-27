# 数智校答 V2 开发基线（任务 0.1 / 0.3）

**建立日期**：2026-10-20  
**最近复核**：2026-10-21<br>
**分支**：`codex/campus-service-platform`  
**起始提交**：`237ba72` fix: harden campus service release readiness（2026-08-18 16:45）  
**配套**：[`v2-gap-analysis.md`](v2-gap-analysis.md)、[`v2-execution-board.md`](v2-execution-board.md)

---

## 1. 归档结果

开工前工作区共有 **49 项未提交改动**（21 项删除、17 项修改、11 项未跟踪）。已按性质拆成 5 个提交归档，当前工作区干净：

| 提交 | 内容 | 范围 | 说明 |
| --- | --- | --- | --- |
| `4af3c89` | `chore(mobile): relocate uni-app sources under src/` | 17 删 + 2 重命名 + `tsconfig.json` | 完成 8-17 的 uni-app 迁移收尾：删除根目录旧副本；`src/` 下 15 个文件原本已在 `237ba72` 中跟踪，本次补入 `manifest.json`、`uni.scss` |
| `61756be` | `chore(web): archive paper-grid visual iteration (2026-08-18 WIP)` | 15 文件（+1827/−1931） | 8-18 的纸质/橙绿视觉改版：`App.vue`、6 个组件、5 个视图、`main.ts`，新增 `styles/design-system.css`，删除 `store/chat.ts` 与 `views/ChatView.vue`。**仅存档**，配色与已确认的 Figma 深绿稿冲突 |
| `364b6b8` | `feat(rag): gate answers on confident retrieval hits` | 6 文件（+220/−18） | 8-20 的低置信度兜底：`RAG_ANSWER_MIN_SCORE`、`filterConfidentRagHits`、低匹配答复、响应式截图参数，新增 2 个测试 |
| `46d754d` | `docs: archive v2 plans and move proposal assets into docs/` | 6 文件 | V2 计划、交互说明、Live2D/Rive 方案；提案 PDF 与文本从根目录迁入 `docs/` |
| `73f4d21` | `docs: add v2 gap analysis and two-agent execution board` | 2 文件 | 39 项差距分析与双 AI 计划表 |

**结论**：8-18/8-20 的成果没有丢失，也没有被覆盖；`2.1` 换深绿视觉时以 `61756be` 为对照，不做回退式重写。

---

## 2. 工具链与依赖（实测）

| 项 | 值 | 来源 |
| --- | --- | --- |
| Node | v23.11.0 | `node -v` |
| npm | 10.9.2 | `npm -v` |
| lockfile | v3 | `package-lock.json` |
| Vue / Vite | 3.5.28 / 7.3.1 | `package.json` |
| Pinia / Element Plus | 3.0.4 / 2.13.2 | `package.json` |
| TypeScript / vue-tsc | 5.9.3 / 3.2.4 | `package.json` |
| ESLint / oxlint | 9.39.2 / 1.47.0 | `package.json` |
| vue-router | 4.6.4 | `package.json` / lockfile；路由与守卫测试已启用 |
| Vitest | 3.2.7 | `package.json` / lockfile；`test:unit` 已运行 |
| @vue/test-utils | 2.5.1 | `package.json` / lockfile |
| jsdom | 27.0.1 | `package.json` / lockfile |

`package.json` 共 49 个 scripts；`lint`、`type-check`、`test:unit`、`test:server`、`rag:test:service`、`release:check`、`service:journey` 均已配置。

---

## 3. 基线验证结果（逐项记录实际执行时间）

| 命令 | 结果 | 备注 |
| --- | --- | --- |
| `npm run type-check` | ✅ 通过 | 改版 + 1.1 API 改造后均复跑通过 |
| `npm run lint:oxlint` | ✅ 0 warnings / 0 errors | 94 文件 |
| `npm run lint:eslint` | ✅ 通过 | `--cache`，无输出 |
| `npm run rag:test:service` | ✅ 20/20，top1 100%，阈值 90% | 金标仍为 20 条 |
| `node server/tests/rag-confidence.test.mjs` | ✅ 2/2 | 进程内直跑 |
| `node server/index.mjs` + curl | ✅ `/api/health`、`/health`、`/api/community/posts`、`/community/posts` 均 200；`/api/unknown` 返回 JSON 404；`/api/chat/stream` 返回 `start → delta×N → meta → done` | 端口 3100、`LLM_PROVIDER_MODE=mock` |
| `npm run build`（由 `npm run service:journey` 调用） | ✅ 通过（普通终端、工作区临时目录） | 1650 模块，约 6.2s；type-check 与 Vite build 均通过 |
| `npm run test:unit` | ✅ 90/90（18 个测试文件；2026-10-21） | Vitest 3.2.7；包含路由、会话、流式取消、反馈、社区交互等单测 |
| `npm run test:server` | ✅ 56/56（2026-10-21，普通终端） | 当前仓库版本复跑通过；测试明确使用 mock/内存回退，日志中的 MySQL `ECONNREFUSED` 是隔离配置预期，不代表真实库验证 |
| `npm run service:journey` | ✅ 10/10（2026-10-21，9.6s） | 独立执行证据由 `5dda2a6` 产生、`8d060c2` 登记；`server/evals/latest-service-journey.json`；验证 10 轮游客问答、登录意图恢复与确认、社区知识审核及 RAG 来源闭环；构建和 type-check 在旅程中通过 |

> 0.3 基线已复核：当前服务端测试 56/56，单测 90/90；服务旅程 10/10，社区审核到 RAG 来源及待恢复问题确认均闭环。旅程使用隔离 Mock/内存环境，不能据此宣称目标环境的真实服务已验证。

---

## 4. Mock 与真实服务边界

- **本轮已验证为 Mock/内存**：`LLM_PROVIDER_MODE=mock` 的问答；`MYSQL_PORT=1` 触发的内存鉴权回退；无 LightRAG（`LIGHTRAG_PRIMARY=false`）。
- **已验证的隔离依赖**：本地 MySQL 8 隔离 schema 已完成 6.4 审核事务 9/9 与 7.1 反馈迁移/持久化验证；测试库已清理，详情见执行计划表 §6.1 和 `server/evals/latest-mysql-review-validation.json`。
- **目标环境仍未验证**：DeepSeek/兼容模型、部署用 MySQL 配置与数据、SMTP 验证码邮件、腾讯云 TTS、Nginx/HTTPS、真实 embedding 向量索引（当前本地为 hash 索引）。
- 任何“通过”结论仅覆盖隔离环境；发布门槛仍按计划 §7.2 在目标环境单独取证。

---

## 5. 恢复与回滚

```bash
# 回到 V2 开工前的提交（保留工作区）
git switch codex/campus-service-platform
git reset --soft 237ba72   # 仅取消提交，改动回到暂存区

# 只撤销某一批归档（示例：撤销 8-18 视觉存档）
git revert 61756be

# 查看某批归档的具体文件
git show --stat 61756be
```

注意事项：

1. `.env.local`、`server/.env`、`dist/`、`rag_storage/` 均未进版本库，回滚不会带回凭证与构建产物。
2. `docs/project-proposal.pdf`（6 MB）已进库，属有意归档；若仓库体积敏感，后续可换 Git LFS。
3. `mobile-uniapp/src` 与根目录旧副本的重复已消除；回滚 `4af3c89` 会恢复重复，不建议。
4. 回滚应用版本时必须同时核对前端、后端与 Nginx 三处（见计划 §9.3）。

---

## 6. 已知风险（基线层面）

| 风险 | 处理 |
| --- | --- |
| 沙箱内无法 build / 跑完整测试 | 在普通终端或 CI 执行后补记到本文件 §3 |
| Top 50 金标和目标环境状态 | `product-status.md` 已按当前本地证据更新；Top 50 仍待 5.4 人工核对，真实模型/部署 MySQL/SMTP/TTS/HTTPS 仍待 7.4 验收 |
| 原 `src/project-text/exports/` 261 个 JSON | 已移至 `_ingest/project-text/exports/`；导入脚本默认路径、浏览器导出说明与知识库来源路径已同步，文件保留在仓库且不进入前端源码树 |
| `mobile-uniapp` 迁移已提交，但不在 V2 范围 | 不改动；只在合并前确认无 Web 引用 |
