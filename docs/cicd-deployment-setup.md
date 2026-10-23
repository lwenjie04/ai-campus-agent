# GitHub Actions 自动部署配置

当前部署配置面向仓库文档描述的 Ubuntu + Nginx + PM2 单机方案。`.github/workflows/quality.yml` 仍负责验证；`.github/workflows/deploy.yml` 只会在 `Quality` 工作流于默认分支的 push 全部通过后运行，并部署同一个 commit。GitHub 仓库当前默认分支是 `master`。`workflow_run` 类型的工作流文件必须先合入默认分支才会被 GitHub 触发，因此本次分支上的配置需合并到 `master` 后才生效。

部署默认关闭。没有服务器地址、SSH 凭据和健康检查地址时，不会尝试部署。

## 一次性服务器准备

服务器需要 Node.js 22.12+、npm、PM2、curl、tar。SSH 部署账号必须能通过 `sudo -n` 执行远程部署脚本；如果现有 PM2 服务由 root 管理，部署与回滚也必须由 root 的 PM2 daemon 执行，不能另起一个用户级 PM2 实例。Nginx 应能读取 `current/dist`，并把 `/api/` 代理到 `127.0.0.1:3000`；`/api/chat/stream` 需关闭代理缓冲。PM2 的开机启动服务需要由服务器管理员预先配置。

部署目录采用以下结构：

```text
/var/www/ai-campus-agent/
  current -> releases/<commit>-<run>-<attempt>
  previous -> releases/<previous-release>
  releases/
  shared/
    server.env
    data/
    logs/
```

首次启用前，在服务器上创建 `shared/server.env`，内容使用 `docs/deploy-server-checklist.md` 的生产配置；权限设为仅部署进程可读。不要把密钥放进 GitHub Actions 日志、仓库文件或部署包。若已有线上 `server/data` 中的生成向量索引或本地数据，先将其备份并复制到 `shared/data`，再启用第一次部署。CD 会把每个版本的已跟踪 `server/data` 文件同步到共享目录，保留其中额外的生成文件。

部署账号的 SSH 公钥需加入服务器 `authorized_keys`。第一次部署前，现有部署目录中的 `current` 若存在，必须是指向当前稳定版本目录的符号链接，且该目录包含兼容的 `ecosystem.config.cjs`；脚本会拒绝覆盖普通目录或无法自动恢复的旧版本。首次迁移时先把当前稳定程序改为用此 PM2 配置运行，并验证一次手动 reload。对于原先由宝塔管理、PM2 服务以 root 运行的主机，应先备份服务器配置，再创建上述目录；把现有 `.env` 安全复制到 `shared/server.env`（权限 `600`），把 `server/data` 和 `server/logs` 复制到共享目录，并让 `current` 暂时指向现有稳定程序目录。首次新版本通过本机健康检查后，再将 Nginx 静态根目录改为：

```nginx
root /var/www/ai-campus-agent/current/dist;
```

示例 `DEPLOY_PATH` 为 `/var/www/ai-campus-agent`。`current` 切换使用同一文件系统内的原子符号链接替换。每次切换都会删除并重新创建 PM2 后端进程，使它从当前 release 的实际目录启动；这会造成短暂的 API 重启。部署先检查本机 `/health` 返回的 `releaseId` 与本次发布一致，再由 GitHub runner 检查外部 HTTPS 健康地址。检查失败时会切回上一版本并重新启动旧进程。CD 不会自动执行数据库 SQL 或修改 MySQL 数据。

## HTTPS 证书与自动续期

`maila.club` 使用 Certbot 管理 Let's Encrypt 证书，Nginx 读取 `/etc/letsencrypt/live/maila.club/fullchain.pem` 和 `privkey.pem`。HTTP-01 challenge 使用固定目录 `/var/www/ai-campus-agent/acme`，Nginx 的 `/.well-known/acme-challenge/` location 指向这个目录，因此部署切换 `current/dist` 不会改变续期路径。不要删除此目录或 challenge location。

Ubuntu 的 `certbot.timer` 负责定期检查和续期；`/etc/letsencrypt/renewal-hooks/deploy/10-reload-baota-nginx` 在证书续期成功后先执行 Nginx 配置检查，再平滑 reload。可用下面的命令模拟续期，确认 HTTP 验证和续期配置仍有效：

```sh
sudo certbot renew --dry-run
```

当前 Certbot 账户未设置联系邮箱，因此不会收到 CA 的到期提醒；自动续期和 Nginx reload 不依赖该邮箱。

## GitHub 配置

在仓库 Settings → Environments 创建 `production` 环境，并添加以下 **Environment secrets**：

| 名称                 | 内容                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `DEPLOY_HOST`        | 服务器 IP 或主机名，不带协议和端口                                |
| `DEPLOY_USER`        | 专用部署 Linux 用户                                               |
| `DEPLOY_SSH_KEY`     | 与服务器 `authorized_keys` 匹配的私钥，多行原文                   |
| `DEPLOY_KNOWN_HOSTS` | 经管理员核验的 SSH host key 行；非 22 端口使用 `[host]:port` 格式 |

在 `production` 环境添加以下 **Environment variables**：

| 名称                | 默认值 / 示例                 | 用途                           |
| ------------------- | ----------------------------- | ------------------------------ |
| `DEPLOY_PATH`       | `/var/www/ai-campus-agent`    | 服务器发布根目录               |
| `DEPLOY_PORT`       | `22`                          | SSH 端口                       |
| `DEPLOY_APP_PORT`   | `3000`                        | Node 健康检查与监听端口        |
| `DEPLOY_HEALTH_URL` | `https://你的域名/api/health` | runner 上的公网 HTTPS 健康检查 |

在仓库 Settings → Secrets and variables → Actions → Variables 添加仓库级变量 `CD_ENABLED=true`。该开关位于仓库级变量，因为 GitHub 在判断 job 是否运行时不会加载 Environment-scoped variables。配置完成前保持未设置或 `false`。

第一次配置由服务器管理员核对 host key、权限、`server.env`、Nginx 路由和 `/health`，再启用 `CD_ENABLED`。当前服务器现状、首次迁移与验证记录写在 `docs/v2-execution-board.md` 的 7.3/7.4 行。其后，合并到默认分支的代码会先完整通过 CI，再自动发布；PR 和其他分支不会触发生产部署。可在 `production` Environment 配置 required reviewers 作为人工发布批准门。

## 回滚与故障排查

部署脚本每次创建独立 release 目录，并保留 `current` 与 `previous` 链接。新版本本机健康检查失败会自动回滚；公网健康检查失败会由 workflow 发起回滚。数据库迁移仍按 [`release-checklist.md`](release-checklist.md) 人工备份和执行；不自动运行旧 SQL 或增量迁移。

若部署 job 被跳过，检查 push 是否来自默认分支、`Quality` 是否全绿，以及 `CD_ENABLED` 是否为 `true`。若配置校验失败，检查 Environment secrets/variables 是否齐全、host key 是否准确、部署用户是否能无交互 sudo，以及服务器是否已安装依赖工具和 PM2。
