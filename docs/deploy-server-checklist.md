# 服务器部署清单

本文档用于部署当前 `ai-campus-agent` 主项目到服务器，覆盖：

- 前端部署
- 后端部署
- MySQL 初始化
- 邮件配置
- TTS 配置
- 进程守护
- Nginx 反向代理

适用于当前这版功能：

- 校园智能问答
- 数字人展示与 TTS
- 学生社区
- 管理员审核
- 邮箱验证码注册 / 登录

---

## 1. 服务器准备

建议环境：

- `Node.js 22 LTS`
- `npm 10+`
- `MySQL 8.x`
- `Nginx`
- Linux 服务器推荐 `Ubuntu 22.04+` 或同级别发行版

建议提前确认：

- 服务器可以访问公网
- 能访问 `api.deepseek.com`
- 能访问腾讯云 TTS 接口
- 能访问 QQ 邮箱 SMTP

---

## 2. 项目代码上传

将项目上传到服务器，例如：

```bash
/var/www/ai-campus-agent
```

进入项目目录后执行：

```bash
npm install
```

> 项目为 npm workspaces 多包结构：一次安装会装齐 `web/`（前端）与 `server/`（后端）依赖。`mobile-uniapp/` 因 uni-app 依赖与 Vue3 peer 冲突未纳入 workspaces，如需构建移动端，在 `mobile-uniapp/` 内单独 `npm install`。

---

## 3. 数据库初始化

先进入 MySQL：

```sql
CREATE DATABASE IF NOT EXISTS ai_campus_agent
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_unicode_ci;

USE ai_campus_agent;
```

然后执行以下 SQL 文件：

### 3.1 社区相关表

```sql
source /var/www/ai-campus-agent/server/sql/community-feature-v1.sql;
```

### 3.2 认证相关表

```sql
source /var/www/ai-campus-agent/server/sql/auth-users.sql;
```

执行完成后可检查：

```sql
SHOW TABLES;
```

> `auth_users.must_change_password`、`auth_verification_codes.attempts` 两个新列由后端启动时**自动幂等迁移**（查 information_schema 后 ALTER），无需手工加列。

至少应包含：

- `auth_users`
- `auth_verification_codes`
- `community_posts`
- `community_replies`
- `community_knowledge`
- `community_review_logs`

---

## 4. 后端环境变量

在服务器上创建：

```bash
server/.env
```

参考配置如下：

```env
PORT=3000

LLM_API_BASE_URL=https://api.deepseek.com
LLM_API_KEY=你的DeepSeekKey
LLM_MODEL=deepseek-chat

CORS_ORIGIN=https://你的前端域名

# Auth
AUTH_DEFAULT_ADMIN_USERNAME=admin
AUTH_DEFAULT_ADMIN_PASSWORD=admin123
AUTH_DEFAULT_ADMIN_NAME=系统管理员
AUTH_NOTIFY_EMAIL=3279574698@qq.com
AUTH_CODE_EXPIRE_MINUTES=10
AUTH_CODE_RESEND_SECONDS=60
AUTH_LOGIN_MAX_FAILURES=5
AUTH_LOGIN_WINDOW_MINUTES=15
AUTH_CODE_MAX_ATTEMPTS=5

# JWT（必配：换成随机长字符串，例如 `openssl rand -hex 32` 生成）
JWT_SECRET=替换成随机密钥
JWT_EXPIRES_IN=7d

# SMTP
MAIL_HOST=smtp.qq.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=3279574698@qq.com
MAIL_PASS=你的QQ邮箱SMTP授权码
MAIL_FROM=3279574698@qq.com

# TTS
TTS_PROVIDER=tencentcloud
TTS_AUTH_TOKEN=
TTS_MAX_TEXT_LENGTH=100000

TENCENTCLOUD_SECRET_ID=你的腾讯云SecretId
TENCENTCLOUD_SECRET_KEY=你的腾讯云SecretKey
TENCENTCLOUD_TTS_REGION=ap-guangzhou
TENCENTCLOUD_TTS_MODE=auto
TENCENTCLOUD_TTS_LONG_TEXT_THRESHOLD=220
TENCENTCLOUD_TTS_POLL_INTERVAL_MS=1500
TENCENTCLOUD_TTS_POLL_TIMEOUT_MS=180000
TENCENTCLOUD_TTS_VOICE_TYPE=101001
TENCENTCLOUD_TTS_SPEED=0
TENCENTCLOUD_TTS_VOLUME=0
TENCENTCLOUD_TTS_SAMPLE_RATE=16000
TENCENTCLOUD_TTS_CODEC=wav
TENCENTCLOUD_TTS_PRIMARY_LANGUAGE=1
TENCENTCLOUD_TTS_PROJECT_ID=0
TENCENTCLOUD_TTS_MODEL_TYPE=1

# MySQL
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=你的数据库密码
MYSQL_DATABASE=ai_campus_agent

# RAG
RAG_WEIGHT_EXACT_TITLE=10
RAG_WEIGHT_EXACT_CONTENT=4
RAG_WEIGHT_TERM_TITLE_LONG=5
RAG_WEIGHT_TERM_TITLE_SHORT=3
RAG_WEIGHT_TERM_CONTENT_LONG=2
RAG_WEIGHT_TERM_CONTENT_SHORT=1
RAG_WEIGHT_KEYWORD_MATCH=4
RAG_WEIGHT_CATEGORY_MATCH=2
RAG_WEIGHT_CATEGORY_SCHOLARSHIP_BOOST=3
RAG_WEIGHT_CATEGORY_TEACHING_BOOST=3
RAG_WEIGHT_CATEGORY_EXAM_BOOST=2
RAG_WEIGHT_ROUTE_BOOST=6
RAG_TIME_DECAY_ENABLED=true
RAG_TIME_DECAY_HALFLIFE_DAYS=90
RAG_TIME_DECAY_MIN_FACTOR=0.5
RAG_ROUTE_MIN_HITS=2
RAG_ROUTE_MIN_SCORE=3
RAG_LOG_ENABLED=true
```

---

## 5. 邮件链路测试

在服务器上先测试 SMTP，不要直接在页面里试。

执行：

```bash
npm run mail:test
```

如果成功，应看到类似：

```bash
[mail:test] SMTP 连接验证成功。
[mail:test] 测试邮件已发送成功。
```

如果失败，优先检查：

- `MAIL_PASS` 是否为 QQ SMTP 授权码
- 服务器是否能访问 `smtp.qq.com:465`

---

## 6. 后端服务测试

### 6.1 启动后端

```bash
npm run server
```

### 6.2 检查健康接口

浏览器或命令行访问：

```bash
http://服务器IP:3000/health
```

如果后端正常，应该返回健康状态。

### 6.3 测试登录/注册

确认：

- 管理员账号 `admin / admin123` 可以登录；**首次登录会强制修改初始密码**（登录响应 `mustChangePassword: true`），改完才可进入系统
- 普通用户可收邮箱验证码并注册（注册后自动登录）
- 受保护接口（问答、发帖/回复）无 token 返回 401；普通用户调审核接口返回 403

---

## 7. 前端构建

执行：

```bash
npm run build
```

构建产物目录（前后端分离后位于 web 包内）：

```bash
web/dist/
```

> 反向代理时前端 root 指向该目录，见第 9 节 Nginx 示例。

---

## 8. 使用 pm2 托管后端

全局安装：

```bash
npm install -g pm2
```

启动后端（使用仓库内的 `ecosystem.config.cjs`，根 package.json 已提供脚本）：

```bash
npm run pm2:start
```

等价于：

```bash
pm2 start ecosystem.config.cjs
```

查看状态：

```bash
pm2 status
```

保存开机自启：

```bash
pm2 save
pm2 startup
```

查看日志：

```bash
pm2 logs ai-campus-server
```

---

## 9. Nginx 配置示例

假设：

- 前端目录：`/var/www/ai-campus-agent/web/dist`
- 后端地址：`http://127.0.0.1:3000`
- 域名：`your-domain.com`

可参考：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/ai-campus-agent/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /chat {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /community {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /auth {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /tts {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

> `/chat/stream` 为 NDJSON 流式接口，建议在对应 `location` 里加 `proxy_buffering off;`（后端已回 `X-Accel-Buffering: no`，但 Nginx 默认仍可能缓冲导致打字机效果卡顿）。

如果要上 HTTPS，再配置证书并将 `CORS_ORIGIN` 改成正式前端域名。

---

## 10. 上线后验收清单

上线后建议逐项确认：

- 前端首页正常打开
- 登录页正常显示
- 管理员账号可登录，首次登录完成强制改密
- 普通用户可收到邮箱验证码
- 注册成功后管理员邮箱收到通知
- 首页问答正常返回
- `sources` 正常展示
- 数字人视频可正常加载
- TTS 可正常播报
- 学生社区可查看帖子、发帖、回复
- 管理员页可审核帖子、回复、社区知识
- `community_knowledge` 已审核数据可进入 RAG

---

## 11. 常见问题

### 11.1 邮件发不出去

优先检查：

- `MAIL_PASS` 是否写成了 QQ 登录密码（错误）
- 是否已开启 QQ 邮箱 SMTP
- 是否使用了 SMTP 授权码
- 服务器是否放通 465 端口

### 11.2 小程序不能请求接口

原因通常是：

- 仍在用 `localhost`
- 未配置公网 HTTPS 域名
- 未在微信后台配置合法域名

### 11.3 社区或登录接口报 MySQL 错误

优先检查：

- `MYSQL_HOST`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- SQL 是否已执行

### 11.4 TTS 无法播报

优先检查：

- 腾讯云密钥是否有效
- TTS 资源包是否充足
- `TTS_PROVIDER=tencentcloud`
- 后端日志中是否有腾讯云报错

---

## 12. 推荐上线顺序

推荐按这个顺序部署：

1. 数据库初始化
2. 配置 `server/.env`
3. 测试 `npm run mail:test`
4. 启动后端并验证接口
5. 构建前端
6. 配置 Nginx
7. 使用 pm2 托管后端
8. 最后全链路验收

---

如果后续要正式支持微信小程序，建议在当前部署完成后再继续补：

- HTTPS 域名
- 小程序合法域名配置
- 小程序专用接口环境配置
