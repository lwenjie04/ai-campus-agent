# 数智校答：校园智能服务台 + 知识运营后台

## 项目简介
数智校答是一个面向高校师生和知识运营人员的双端产品：学生侧通过“校园智能服务台”查询规则、材料、流程和办理入口；运营侧通过“知识运营后台”审核内容、发布知识并维护检索运行状态。系统以可信校园知识为核心，大模型、数字人与语音是表达和交互能力，不替代正式来源与人工审核。

当前版本聚焦以下场景：

- 教务、考试、奖助、生活服务等校园事项导办
- 带官方来源、可信等级和社区经验标识的回答
- 游客免登录试问、登录后继续追问
- 校园社区发帖、回复与经验沉淀
- 知识运营员审核、入库和检索状态维护
- 数字人和语音讲解

## 核心功能
### 1. 校园智能服务台
- 支持用户自然语言提问
- 支持流式文本输出
- 回答可附带来源依据
- 支持数字人欢迎、待机、讲解状态切换

### 2. RAG 知识检索
- 结合本地知识库进行检索增强回答
- 支持校园通知、教务、生活服务等分类数据
- 优先返回官方来源，降低大模型幻觉风险

### 3. 校园社区与经验沉淀
- 支持帖子发布、回复、浏览
- 支持管理员审核帖子与回复
- 支持优质社区内容沉淀为社区知识条目
- 支持社区知识作为低可信度辅助来源参与问答

### 4. 知识运营后台

- 支持候选知识、待发布知识、帖子和回复分区处理
- 社区知识必须人工审核后才参与 RAG
- 支持查看 LightRAG 服务与文档处理状态
- 管理写操作由服务端管理员会话保护

### 5. 登录注册
- 普通用户通过邮箱验证码注册
- 邮箱作为普通用户唯一标识
- 管理员通过账号密码登录
- 支持注册成功邮件通知

### 6. 语音与数字人
- 首页自动显示欢迎词并播放欢迎视频
- 问答回复支持数字人讲解视频
- 已接入后端 TTS 能力
- 支持较长文本的语音处理与播放

## 系统结构
### 前端
- `Vue 3`
- `TypeScript`
- `Pinia`
- `Element Plus`
- `Vite`

### 后端
- `Node.js`
- 原生 HTTP 服务
- `MySQL`
- `Nodemailer`
- `Tencent Cloud TTS`

### 知识层
- 本地知识库 `server/data/knowledge-base.json`
- 社区知识表 `community_knowledge`
- RAG 检索逻辑 `server/rag.mjs`

## 目录说明
```text
src/                     前端页面与组件
server/                  后端接口、RAG、TTS、认证、脚本
server/sql/              数据库建表与初始化 SQL
docs/                    项目方案、部署说明、规则文档
public/                  公共静态资源
```

## 主要页面
- 校园智能服务台：数字人导办、问答与来源查看
- 校园社区：帖子列表、详情与互动
- 知识运营后台：内容治理、知识发布与检索运行
- 登录注册页：邮箱验证码注册与账号登录

## 接口概览
### 问答相关
- `GET /health`
- `POST /chat`
- `POST /chat/stream`
- `POST /tts`

### 认证相关
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/send-register-code`

### 社区相关
- `GET /community/meta`
- `GET /community/posts`
- `GET /community/posts/:id`
- `POST /community/posts`
- `POST /community/posts/:id/replies`
- `GET /community/review/posts`
- `GET /community/review/replies`
- `POST /community/review/posts/:id/approve`
- `POST /community/review/replies/:id/approve`
- `POST /community/knowledge/generate`

## 本地开发
### 1. 安装依赖
```bash
npm install
```

### 2. 启动前端
```bash
npm run dev
```

### 3. 启动后端
```bash
npm run server
```

### 4. 类型检查
```bash
npm run type-check
```

### 5. 产品质量检查

```bash
npm run release:check
npm run service:journey
```

`release:check` 是日常发布预检；`service:journey` 使用隔离环境验证游客问答、登录续问、管理员权限和知识审核闭环。真实外部服务仍需按发布清单在目标环境验证。

## 数据库初始化
先创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS ai_campus_agent
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_unicode_ci;
```

再执行：

- `server/sql/auth-users.sql`
- `server/sql/community-feature-v1.sql`

## 环境变量
后端主要使用：

- `LLM_API_KEY`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USER`
- `MAIL_PASS`
- `AUTH_NOTIFY_EMAIL`
- `TENCENTCLOUD_SECRET_ID`
- `TENCENTCLOUD_SECRET_KEY`

示例可参考：

- `server/.env.example`

## 部署说明
项目支持部署到 Linux 服务器，推荐：

- 前端构建后由 `Nginx` 托管
- 后端通过 `pm2` 启动
- MySQL 存储认证与社区数据
- 域名通过 Nginx 反向代理 `/auth`、`/chat`、`/community`、`/tts` 等接口

详细部署流程见：

- `docs/deploy-server-checklist.md`

## 产品亮点

- 用“服务台 + 运营后台”把用户问答和知识维护连接成持续闭环
- 官方知识优先，社区经验明确标识且必须审核后发布
- 模型、LightRAG 或数据库异常时提供可解释的回退路径
- 游客可先验证价值，登录后无缝继续刚才的问题
- 通过 RAG 金标、后端测试和浏览器旅程形成可重复质量门禁

## 产品文档

- [产品说明](docs/product-brief.md)
- [产品路线](docs/product-roadmap.md)
- [当前状态](docs/product-status.md)
- [发布清单](docs/release-checklist.md)
- [社区知识审核规则](docs/community-knowledge-review-rules.md)
- [部署清单](docs/deploy-server-checklist.md)
- [2026 比赛版本归档](docs/archive/competition-2026/README.md)
