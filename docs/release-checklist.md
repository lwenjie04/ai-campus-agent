# 产品发布检查清单

## 1. 本地质量门禁

```bash
npm run release:check
```

该命令依次检查产品资产、后端语法、自动测试、知识索引、RAG 金标和 Web 生产构建。`WARN` 必须逐条评估，不能只看最终退出码。

## 2. 核心服务旅程

```bash
npm run service:journey
```

隔离旅程使用明确 Mock 和内存回退，验证游客首次问答、页面重载后的待问恢复、登录续问、管理员权限及知识审核闭环。它用于回归测试，不等于真实外部服务验证。

## 3. 目标环境验证

在后端启动后执行：

```bash
npm run service:smoke
```

随后人工验证真实模型、MySQL、TTS、跨域、反向代理、移动端和主要校园问题。成功后才能设置 `RELEASE_LIVE_VALIDATION_CONFIRMED=true`。

## 4. 生产安全配置

- `AUTH_DEFAULT_ADMIN_PASSWORD` 至少 10 位且不是示例值。
- `AUTH_SESSION_SECRET` 至少 32 位随机值。
- `GUEST_COOKIE_SECRET` 至少 32 位随机值。
- 模型、邮件、数据库和 TTS 密钥只放在被忽略的部署环境文件中。
- 管理接口和 LightRAG 代理必须验证管理员会话。

## 5. 严格发布门槛

```bash
npm run release:gate
```

严格门槛要求通用检查通过、目标环境验证已确认、最新服务旅程证据通过，并且 Git 工作区干净。不要通过修改脚本或伪造环境变量绕过失败项。
