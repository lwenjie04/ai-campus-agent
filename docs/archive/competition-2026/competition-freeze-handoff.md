# 比赛版本冻结交接清单

> 历史归档：来自 `feat/backend-rag` 分支，保存点为 `9da3af7`。当前产品发布请使用 `../../release-checklist.md`。

当前工程验证结果见 `./competition-status.md`。以下步骤必须在比赛电脑执行，AI 不代填真实密码或伪造彩排确认。

## 1. 配置比赛环境

在被 `.gitignore` 排除的 `server/.env` 中确认：

```dotenv
LLM_PROVIDER_MODE=deepseek
AUTH_DEFAULT_ADMIN_PASSWORD=<至少 10 位的比赛专用强密码>
AUTH_SESSION_SECRET=<至少 32 位随机值>
GUEST_COOKIE_SECRET=<至少 32 位、与会话密钥不同的随机值>
```

同时确认 DeepSeek、MySQL 和 TTS 的现有配置可用。不要把 `server/.env`、密码、密钥或真实学生数据加入 Git、截图或投屏。

如果希望保留断库管理员兜底，可显式设置 `AUTH_ALLOW_MEMORY_FALLBACK=true`；该模式只允许强管理员登录，普通用户注册会关闭。数据库离线时不能声称完成了真实持久化。

## 2. 执行真实服务彩排

1. 启动真实后端、Web、MySQL、TTS；LightRAG 可开启，也可验证自动回退。
2. 运行 `npm run competition:smoke`。
3. 用无痕窗口按 `docs/competition-demo-script.md` 完整演示一次。
4. 核对三个主问题、官方来源、TTS、数字人、第二问登录、自动续问和社区审核闭环。
5. 只有全部成功后，在当前终端设置：

```powershell
$env:COMPETITION_LIVE_REHEARSAL_CONFIRMED='true'
```

该变量是本次冻结会话的人工签字，不应写入仓库或长期环境文件。

## 3. 创建固定提交与回滚点

1. 检查 `git diff`，确认没有 `.env`、日志、临时浏览器目录或无关修改。
2. 提交比赛版本，记录提交哈希。
3. 确认 `git status --short` 无输出。
4. 运行：

```powershell
npm run competition:freeze:check
```

只有命令输出 `[freeze] FROZEN: all release gates passed`，才能把版本状态改为“已冻结”。

## 4. 比赛电脑备份

- 固定 Git 提交和提交哈希。
- 已安装的 `node_modules` 与锁文件。
- 最新 `dist` 构建产物。
- 396 条正式知识库以及通过 `npm run kb:prepare:offline` 可重建的本地切片/哈希索引。
- 三段数字人视频、演示种子 SQL、主演示和备用问题文档。
- 上一个可用提交，作为离线回滚点。

现场不升级依赖、不重建在线向量、不修改 Top 20 金标、不尝试未经彩排的随机问题。
