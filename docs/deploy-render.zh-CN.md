# G0dLog Render MVP 部署

Render 只用于公开的前端/MVP 试用。当前应用是一个完整的 Next.js 服务，不是可单独拆出的静态前端，因此 Render 实例仍会运行 API、SQLite 和媒体处理；它们只使用 Render 的临时文件系统，不承载正式内容。正式服务和全部正式媒体仍部署在极空间 Z4S NAS 上。

## Render 配置

仓库根目录的 `render.yaml` 已声明一个免费的 Docker Web Service：

- 服务名：`g0dlog-mvp`；区域：`singapore`；分支：`main`；推送后自动部署；
- Docker 构建使用仓库中的 `Dockerfile`；健康检查为 `/api/health`；
- `BLOG_DATA_DIR`、`BLOG_MEDIA_DIR` 和 `BLOG_BACKUP_DIR` 指向 `/tmp/g0dlog/...`，明确表示数据可丢弃；
- `PUBLIC_SITE_URL` 暂定为 `https://g0dlog.top`，以便 MVP 期间直接使用目标域名。

在 Render Dashboard 中选择 **New → Blueprint**，连接 `G0dN/G0dLog` 仓库并同步该文件。也可以先创建 Docker Web Service，再按同样的环境变量和健康检查填写。首次部署成功后，访问 Render 分配的 `*.onrender.com` 地址确认页面和 `/api/health`。

Render Free Web Service 空闲 15 分钟后会休眠，唤醒通常需要约一分钟；实例重启、休眠或重新部署都会丢失本地 SQLite、上传图片和其他文件。因此不要在 Render 录入正式文章、正式账号或唯一媒体。Render 免费实例也不提供持久磁盘，不能用它替代 NAS。

## `g0dlog.top` 在 MVP 阶段指向 Render

1. 在 Render 服务的 **Custom Domains** 中添加 `g0dlog.top`。Render 会同时添加 `www.g0dlog.top` 并将其重定向到根域名。
2. 在域名 DNS（若使用 Cloudflare，先保持 DNS only/灰云）中，将根域名和 `www` 各添加一个 CNAME，目标均为 Render 服务的 `*.onrender.com` 子域名。删除可能冲突的 AAAA 记录。
3. 回到 Render 点击 Verify，等待证书签发后访问 `https://g0dlog.top`。确认 HTTPS、`/api/health`、首页、RSS、sitemap 和图片展示。

MVP 期间根域名只能选择一个入口，因此此时不要同时把 `g0dlog.top` 指向 NAS Tunnel。NAS 可以先使用局域网地址完成验收，或使用单独的临时子域名（例如 `nas.g0dlog.top`）进行 Cloudflare Tunnel 验证。

## 从 Render 切换到 NAS

NAS Compose 使用独立的持久化目录和正式 `PUBLIC_SITE_URL=https://g0dlog.top`。完成 NAS、备份、恢复、Tunnel、SMTP 和安全验收后：

1. 停止 Render 上的写入并记录最后一次 MVP 验收结果；
2. 在 Cloudflare Tunnel 中把 `g0dlog.top` 的 Published application 指向 NAS 的 `http://127.0.0.1:3000`；
3. 将 `g0dlog.top` 和 `www` 的 DNS CNAME 改为 Tunnel 生成的 `<UUID>.cfargotunnel.com`，开启代理前先完成源站与 HTTPS 验证；
4. 重新检查 `/api/health`、公开文章、RSS、sitemap、原图权限和 `/studio` 登录；
5. Render 服务保留作临时回归环境，或在确认不再需要后从 Dashboard 删除。Render 数据不迁移到正式 NAS，正式数据从 NAS 空库和 Owner 初始化开始。

切换不是备案或监管规避措施。正式从中国大陆家庭网络对公网提供服务前，仍需按运营商、域名注册地和适用法规完成确认。
