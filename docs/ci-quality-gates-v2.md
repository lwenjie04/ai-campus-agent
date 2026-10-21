# V2 CI 与可重复验证约定

## 当前质量工作流

`.github/workflows/quality.yml` 在 push、pull request 和手动触发时运行 `lint`、`type-check`、`test:unit`、`test:server` 与生产构建。当前使用 Ubuntu runner 和 Node.js 24；工作流仅授予仓库只读权限，不依赖部署凭据。

这只是 7.3 的第一阶段。RAG golden、服务旅程和发布预检的全量接入等 4.6、5.4、6.5 与 7.2 完成后再补齐。工作流目前不运行 `release:check`，因为它还包含向量索引、golden 等需要单独准备数据的检查。

## 浏览器旅程约定

- 服务旅程只允许串行占用 `127.0.0.1:3000` 后端和 `127.0.0.1:4173` Vite preview；可通过 `JOURNEY_BACKEND_PORT` 与 `JOURNEY_PREVIEW_PORT` 覆盖。启动前检查端口空闲，结束时关闭两个服务。
- 使用 mock LLM、内存认证、禁用 TTS/LightRAG，并为每次旅程生成随机管理员密码和签名密钥。不要连接开发者 MySQL 或真实模型。
- 浏览器用户目录由 `mkdtemp` 在系统临时目录创建，旅程结束后清理。新增旅程时，输入和生成数据放到该次运行独占的临时目录；不要复用 `server/data/` 或 `rag_storage/` 作为临时数据目录。
- 浏览器脚本优先读取 `CHROME_PATH`。Linux runner 应显式指向安装好的 Chrome/Chromium 可执行文件（例如 `/usr/bin/google-chrome`）；Windows 使用 `C:\Program Files\Google\Chrome\Application\chrome.exe` 或设置 `CHROME_PATH`；macOS 使用 Chrome 应用包内的 `.../Google Chrome` 可执行文件或设置 `CHROME_PATH`。CI 接入浏览器旅程时，应在同一个 job 中安装浏览器并传入此变量，不依赖 runner 恰好预装浏览器。
- 当前服务旅程使用固定默认结果 `server/evals/latest-service-journey.json`，因此不能并行运行多个服务旅程实例。若要并行矩阵运行，先为每个 job 配置独立结果路径和独立端口。

## 发布预检

`npm run release:check` 额外包含 `npm run test:unit`。它仍会继续执行后端测试、向量就绪、RAG golden 和生产构建；任何步骤失败都会使命令非零退出。CI 阶段完成前，使用工作流的独立 lint/type-check/unit/server/build 步骤作为稳定门禁。
