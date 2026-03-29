# 校园智能问答平台

## 项目简介
校园智能问答平台是一个面向高校场景的智能服务系统，围绕“校园信息查询、流程指引、知识检索、社区互动”四类需求展开。系统以大模型问答为核心，结合校园知识库检索、数字人展示、邮箱验证码注册与角色化管理能力，为师生提供统一的信息服务入口。

当前版本聚焦以下场景：

- 校园通知、奖学金、教务、考试、生活服务等信息问答
- 基于知识库来源的可追溯回答
- 数字人首页展示与讲解播报
- 学生社区发帖、回复、审核与知识沉淀
- 管理员审核与社区知识入库
- 邮箱验证码注册与账号登录

## 核心功能
### 1. 智能问答
- 支持用户自然语言提问
- 支持流式文本输出
- 回答可附带来源依据
- 支持数字人欢迎、待机、讲解状态切换

### 2. RAG 知识检索
- 结合本地知识库进行检索增强回答
- 支持校园通知、教务、生活服务等分类数据
- 优先返回官方来源，降低大模型幻觉风险

### 3. 学生社区
- 支持帖子发布、回复、浏览
- 支持管理员审核帖子与回复
- 支持优质社区内容沉淀为社区知识条目
- 支持社区知识作为低可信度辅助来源参与问答

### 4. 登录注册
- 普通用户通过邮箱验证码注册
- 邮箱作为普通用户唯一标识
- 管理员通过账号密码登录
- 支持注册成功邮件通知

### 5. 语音与数字人
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
- 首页：数字人智能问答
- 学生社区：帖子列表、详情、互动
- 管理员页：审核帖子、回复、社区知识
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

## 项目亮点
- 将大模型问答、RAG 检索、数字人展示与社区互动整合到同一平台
- 支持“官方知识 + 社区知识”的分层检索思路
- 支持邮箱验证码注册，降低恶意注册风险
- 支持管理员审核与社区知识沉淀，形成内容反哺闭环
- 具备比赛展示、课程答辩、项目落地的完整演示链路

## 补充文档
- `docs/project-introduction.md`
- `docs/community-feature-v1-plan.md`
- `docs/community-knowledge-review-rules.md`
- `docs/deploy-server-checklist.md`
