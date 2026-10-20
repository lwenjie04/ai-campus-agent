# 数智校答 V2 开发基线（任务 0.1 / 0.3）

**建立日期**：2026-10-20  
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
| **vue-router** | **未安装** | 依赖清单与 lock 均无 |
| **vitest / @vue/test-utils / jsdom** | **未安装** | 同上；`tsconfig.node.json` 仅残留 `vitest.config.*` 通配符 |

`package.json` 共 37 个 scripts；计划要求的 7 条中，`lint`、`build`、`test:server`、`rag:test:service`、`release:check`、`service:journey` 存在，**`test:unit` 缺失**。

---

## 3. 基线验证结果（本次实际执行）

| 命令 | 结果 | 备注 |
| --- | --- | --- |
| `npm run type-check` | ✅ 通过 | 改版 + 1.1 API 改造后均复跑通过 |
| `npm run lint:oxlint` | ✅ 0 warnings / 0 errors | 94 文件 |
| `npm run lint:eslint` | ✅ 通过 | `--cache`，无输出 |
| `npm run rag:test:service` | ✅ 20/20，top1 100%，阈值 90% | 金标仍为 20 条 |
| `node server/tests/rag-confidence.test.mjs` | ✅ 2/2 | 进程内直跑 |
| `node server/index.mjs` + curl | ✅ `/api/health`、`/health`、`/api/community/posts`、`/community/posts` 均 200；`/api/unknown` 返回 JSON 404；`/api/chat/stream` 返回 `start → delta×N → meta → done` | 端口 3100、`LLM_PROVIDER_MODE=mock` |
| `npm run test:server` | ⛔ 环境阻断 | `node --test` 为每个文件 spawn 子进程，沙箱返回 `EPERM`；**不是用例失败** |
| `npm run build` / `build-only` | ⛔ 环境阻断 | Vite 加载配置时 esbuild/vite 需 spawn 子进程，`EPERM`；需在普通终端或 CI 执行 |
| `npm run service:journey` | 未执行 | 依赖 build 与 Chrome，需在上述环境补跑 |

> 因此本基线**不能宣称“31/31 后端测试通过”与“构建通过”**；这两项是 0.3 的剩余动作。

---

## 4. Mock 与真实服务边界

- **本轮已验证为 Mock/内存**：`LLM_PROVIDER_MODE=mock` 的问答；`MYSQL_PORT=1` 触发的内存鉴权回退；无 LightRAG（`LIGHTRAG_PRIMARY=false`）。
- **未验证真实依赖**：DeepSeek/兼容模型、MySQL 8、SMTP 验证码邮件、腾讯云 TTS、Nginx/HTTPS、真实向量索引（当前本地为 hash 索引）。
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
| `product-status.md` 仍写 13/13、20/20 | 7.5 更新，勿引用旧数字 |
| `src/project-text/exports/` 261 个 JSON 无引用 | 待人工决定移出或忽略（计划表 D-5） |
| `mobile-uniapp` 迁移已提交，但不在 V2 范围 | 不改动；只在合并前确认无 Web 引用 |
