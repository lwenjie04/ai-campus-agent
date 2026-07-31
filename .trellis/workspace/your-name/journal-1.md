# Journal - your-name (Part 1)

> AI development session journal
> Started: 2026-07-31

---



## Session 1: 前后端分离重构（web/server workspaces）+ 分支方案落地

**Date**: 2026-07-31
**Task**: 前后端分离重构（web/server workspaces）+ 分支方案落地
**Branch**: `feat/workspaces-split`

### Summary

确认前后端分分支方案；工具链/分支约定提交 master；完成同仓双包重构（web+server+npm workspaces），数据归位、路径改 import.meta.dirname、KB 改写；修 16 个既存 lint 错误；type-check/build/lint/server/health/KB 全绿；3 提交推至 feat/workspaces-split（master 暂不合）

### Git Commits

| Hash | Message |
|------|---------|
| `f434517` | (see git log) |
| `a66958c` | (see git log) |
| `9d09a20` | (see git log) |

### Status

[OK] **Completed**


## Session 2: P0 安全加固：JWT 鉴权 + 管理员接口防护 + 限流 + 强制改密

**Date**: 2026-07-31
**Task**: P0 安全加固：JWT 鉴权 + 管理员接口防护 + 限流 + 强制改密
**Branch**: `feat/security-auth`

### Summary

完成前后端分离（上一任务）后实施 P0 安全加固：登录/注册签发 JWT，requireAuth/requireAdmin 中间件保护问答与社区接口；发帖/回复作者强制取登录用户；登录失败/验证码发送/验证码尝试三重限流；默认 admin 强制改密；修复 DB 不可用时进程崩溃 bug；前端 token 持久化、401 自动登出、改密弹窗。前端 type-check/build/lint 全绿，本地无库验证 7/7 通过；登录发 token/改密/429 待服务器 MySQL 环境验证。3 提交推至 feat/security-auth
## Session 2: 小任务批量：KB 失效引用清理 + mobile-uniapp 整理 + pm2 配置

**Date**: 2026-07-31
**Task**: 小任务批量：KB 失效引用清理 + mobile-uniapp 整理 + pm2 配置
**Branch**: `chore/cleanup-batch`

### Summary

① 清理 knowledge-base.json 4 条指向已删除附件的 downloadPath（剩 2 条有效）；② mobile-uniapp 删除与 src/ 重复的根目录副本（pages/api/stores/types/utils/App.vue/main.ts/pages.json/env.d.ts），保留 src/ 与构建必需文件；③ 新增 ecosystem.config.cjs（cwd=server）+ 根 pm2:start 脚本。全部验证后推 chore/cleanup-batch。

### Git Commits

| Hash | Message |
|------|---------|
| `253de33` | (see git log) |
| `2bd7f4f` | (see git log) |
| `2ce0873` | (see git log) |
| `98a4578` | (see git log) |
| `c0df676` | (see git log) |
| `336919c` | (see git log) |
| `842dbef` | (see git log) |

### Status

[OK] **Completed**
