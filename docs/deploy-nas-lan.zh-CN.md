# NAS 局域网部署

> 部署地址、账号和绝对路径均为示例；实际环境记录仅保存在本机忽略目录 `outputs/private-release-records/`。

本次目标为极空间 Z4S，局域网地址 `192.168.1.100`，应用端口 `3000`。SQLite 随应用运行，不需要另建数据库容器。

已有部署通道为 Windows 系统自带的 `ssh` / `scp`，SSH 端口 `22`，用户 `nas-user`。直接复用此通道，不需要另装 Python SSH 库。密码通过交互提示输入，不保存在源码或部署文档中。连接后用 `sudo -s` 管理 Docker。

```powershell
ssh -p 22 nas-user@192.168.1.100
scp -P 22 <release-archive.tgz> nas-user@192.168.1.100:/tmp/
```

## 目录与启动

共享目录为 `\\192.168.1.100\nas-user\SERVICE\G0dLog`。极空间将多个物理磁盘合并为共享视图；数据库挂载应使用真实磁盘路径，避免把 SQLite 放在 SMB 或虚拟合并文件系统中。

本次使用的真实项目根目录：

```text
/srv/g0dlog
├── releases/20260910-lan/   # 部署源码、Dockerfile、.env、build.log
└── storage/
    ├── data/              # blog.sqlite
    ├── media/             # 原图、WebP、AVIF
    └── backups/           # SQLite 一致性备份和媒体
```

NAS 的 Docker 版本为 `20.10.2`，没有 Compose。使用项目内的 Docker 原生命令脚本部署：

```sh
cd /srv/g0dlog/releases/20260910-lan
sudo sh scripts/start-nas-container.sh
sudo docker inspect --format '{{.State.Health.Status}}' g0dlog
sudo docker logs --tail 50 g0dlog
```

首次启动前，按 `.env.example` 配置 `.env`，使用本地构建镜像 `g0dlog:20260910-lan`、`PUBLIC_SITE_URL=http://192.168.1.100:3000`、`ALLOW_INSECURE_LAN=1`、`BLOG_BIND_IP=192.168.1.100`，并填写 `storage` 下三个目录的绝对路径。目录须允许容器用户 UID/GID `1000:1000` 写入。脚本使用 `--mount`，目录不存在时直接失败。

容器名为 `g0dlog`，重启策略为 `unless-stopped`。已经存在容器时，启动脚本会报错；普通重启用 `sudo docker restart g0dlog`。更新镜像或配置需要先备份，再停止并删除该容器后重建，保留所有 `storage` 目录。

共享根目录中的历史 Docker 配置不代表本次运行配置；请从上述 release 目录执行管理操作。

## 验收

从同一局域网访问 `http://192.168.1.100:3000`。管理员凭据单独保存在本机忽略目录 `outputs/nas/owner-credentials.json`，不会进入源码包。HTTP 开关只接受 RFC1918 私有 IPv4 地址；公开域名部署应恢复 HTTPS 并关闭该开关。

从开发电脑运行：

```sh
node scripts/test-nas-lan.mjs outputs/nas/owner-credentials.json outputs/nas/acceptance-state.json
node scripts/test-nas-lan.mjs outputs/nas/owner-credentials.json outputs/nas/acceptance-state.json verify
```

第一次运行创建一篇验收文章和一张图片，测试首页、静态资源、RSS、sitemap、robots、登录、草稿保密、发布、WebP/AVIF 和原图权限。容器重建后运行 `verify`，检查同一篇文章和图片是否保留。凭据文件和状态文件应留在忽略目录。

备份命令：

```sh
sudo docker exec g0dlog sh scripts/backup.sh
```

公网域名、Cloudflare Tunnel 和 SMTP 不属于本次局域网部署。

## 当前前端版本（2026-09-11）

当前应用已切换至 `releases/20260911-frontend`、镜像 `g0dlog:20260911-frontend`。以上 `20260910-lan` 路径保留为首次部署记录；后续运维请进入当前 release 目录。持久化目录和访问地址保持不变。备份、验证与回滚步骤见 `nas-frontend-release-20260911.md`。

## 当前恢复页版本（2026-09-11）

最新发布目录为 `releases/20260911-recovery-reviewed`，镜像为 `g0dlog:20260911-recovery-reviewed`，已替代前端首发版本。审核结果与回滚步骤见 `nas-recovery-release-20260911.md`。

## 当前文章创建／移动版本（2026-09-11）

最新目录为 `releases/20260911-destination`，镜像为 `g0dlog:20260911-destination`。本次增加明确选择专栏的创建弹窗、专栏详情创建入口，以及文章移动接口。当前运行版本与回滚说明见 `article-destination-20260911.md`。

## 当前编辑器／自动保存版本（2026-09-11）

最新目录为 `releases/20260911-autosave`，镜像为 `g0dlog:20260911-autosave`，已替代文章创建／移动版本。默认左右对照、专栏自动保存和不新增快照的版本回溯已上线。备份、验收与回滚说明见 `editor-autosave-20260911.md`。
