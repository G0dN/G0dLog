# G0dLog 在极空间 Z4S 上部署

本文以 Docker Compose 为正式部署路径。应用、SQLite 和媒体都在 NAS 的 bind mount 中，容器重建不会把内容留在容器可写层。

## 一次性准备

1. 在极空间上创建项目目录，例如 `/DATA/G0dLog`，并准备 `data`、`media`、`backups` 三个子目录。
2. 安装 Docker 与 Compose，进入项目目录，复制 `.env.example` 为 `.env`。
3. 设置 `G0DLOG_IMAGE=ghcr.io/g0dn/g0dlog:latest`、`PUBLIC_SITE_URL` 为最终的 HTTPS 地址，并设置 `BLOG_DATA_DIR`、`BLOG_MEDIA_DIR`、`BLOG_BACKUP_DIR` 为宿主机的绝对路径。Compose 会在缺少这些关键值时直接失败。
4. 首次启动：

   ```sh
   docker compose pull
   docker compose up -d --no-build
   docker compose ps
   ```

5. 确认 `http://127.0.0.1:3000/api/health` 返回 `{"ok":true}` 后，在 NAS 上创建 Owner：

   ```sh
   docker compose exec g0dlog node scripts/bootstrap-owner.mjs <用户名> <显示名称> '<强密码>'
   ```

   `bootstrap-owner` 会在空库上执行迁移、建立唯一 Owner，并清除已有会话。生产密码不要写入 shell 历史；可以使用临时受保护的终端或在 NAS 上离线执行 `reset-owner-password.mjs`。

## 日常更新

宿主机脚本需要读取 `.env` 中的关键配置时，先将其导出到当前 shell；Compose 自己读取 `.env` 不会自动把值导出给 `curl` 或部署脚本：

```sh
set -a
. ./.env
set +a
```

发布前先做备份，更新时让 Compose 执行向前兼容迁移：

```sh
docker compose exec g0dlog sh -c 'BLOG_DATA_DIR=/var/lib/g0dlog/data BLOG_MEDIA_DIR=/var/lib/g0dlog/media BLOG_BACKUP_DIR=/var/lib/g0dlog/backups /app/scripts/backup.sh'
docker compose pull
docker compose up -d --no-build
docker compose ps
curl -fsS "$PUBLIC_SITE_URL/api/health"
```

实际 NAS 上也可以在宿主机执行 `BLOG_DATA_DIR=... BLOG_MEDIA_DIR=... BLOG_BACKUP_DIR=... sh scripts/backup.sh`。升级前应确认备份目录位于独立持久化卷；不要把 SQLite 放入镜像或容器临时目录。

`scripts/deploy-nas.sh` 会读取 `RELEASE_VERSION`，拼出对应的公开 GHCR 镜像，先备份再 `docker compose pull`，并且只使用 `--no-build` 启动发布镜像。健康检查失败时会恢复部署前容器使用的精确镜像引用。建议在 NAS 上以受保护的 systemd、计划任务或容器方式运行下面的接收器，并让 Cloudflare Tunnel/反向代理只暴露 `/deploy`：

```sh
G0DLOG_WEBHOOK_SECRET='与 GitHub secret 相同的随机值' \
DEPLOY_WORKDIR=/DATA/G0dLog/repository \
PUBLIC_SITE_URL='https://你的域名' \
BLOG_DATA_DIR=/DATA/G0dLog/data BLOG_MEDIA_DIR=/DATA/G0dLog/media BLOG_BACKUP_DIR=/DATA/G0dLog/backups \
node scripts/release-webhook.mjs
```

接收器只接受带 `X-Hub-Signature-256` 的 `POST /deploy`，只允许版本标签和固定 GHCR 仓库；它会同步等待备份、拉取、健康检查和必要的回滚完成，只有部署成功才返回 `200`，失败返回 `502`。部署脚本要求宿主机提供 `flock`，缺少时会安全失败，不会无锁继续发布。GitHub Actions 的 `NAS_DEPLOY_WEBHOOK_URL` 与 `NAS_DEPLOY_WEBHOOK_SECRET` 任一缺失时，发布工作流会失败而不是显示成功。

## Cloudflare Tunnel

Cloudflare 只负责 DNS、HTTPS 和 Tunnel 入站连接。Tunnel 的 origin 指向 NAS 上的 Compose 服务，例如 `http://127.0.0.1:3000`；SQLite 和媒体仍然只由 G0dLog 的 NAS bind mount 管理。公网访问必须使用 HTTPS，并在切换域名后重新验证 `/api/health`、文章页、RSS、sitemap 和图片展示。

## 备份策略

- 每天执行一次 `scripts/backup.sh`，保留 NAS 内最近一段时间的带校验备份；
- 每周把完整备份目录复制到移动硬盘，完成后保持离线；
- 备份覆盖 `blog.sqlite`、媒体、Compose/Docker 文件、锁文件、迁移和恢复说明；
- 每季度在隔离目录执行真实导入与 `scripts/verify-restore.mjs`，然后启动一份临时 Compose 实例，验证网页、关系和媒体。

备份脚本不会打包 `.env` 中的真实密钥；SMTP 授权码只能在 NAS 的安全配置中提供。部署健康检查失败时会调用 `scripts/send-alert.mjs`，配置安全的 `SMTP_HOST`、`SMTP_PORT=465`、`SMTP_USER`、`SMTP_PASSWORD` 和 `ALERT_EMAIL` 后才会发出告警，不要把凭据提交到仓库。

## 回滚

1. 获取部署锁，停止并记录当前镜像标签；
2. 保留失败版本的日志和健康检查结果；
3. 回到上一个已验证的 Git Release/镜像标签；
4. 只执行该版本支持的向前兼容迁移；
5. `docker compose up -d` 后检查健康状态和公开内容；
6. 若迁移无法向前兼容，先停止应用，在隔离目录按恢复文档还原 SQLite 与媒体，再启动验证。

恢复演练和真正灾难恢复都要记录数据库可打开、文章/作者/专栏关系、媒体可读取和应用健康检查结果。
