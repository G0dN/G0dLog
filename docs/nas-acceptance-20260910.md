# NAS 局域网验收记录（2026-09-10）

> 部署地址、账号和绝对路径均为示例；实际环境记录仅保存在本机忽略目录 `outputs/private-release-records/`。

部署地址：`http://192.168.1.100:3000`。

## 运行环境

- 极空间 Z4S，x86_64，Docker 20.10.2。
- 容器：`g0dlog`；重启策略：`unless-stopped`。
- 镜像：`g0dlog:20260910-lan`。
- 最终镜像 ID：`sha256:92f4224fc1172def030158910e65a3136639b2c6d805cbeb87bf0d164351b8eff`。
- 镜像内部运行 Node.js 22，Next.js 16.2.11，SQLite，Sharp 0.35.4。
- 管理员用户名：`owner`；密码另存于本机忽略目录 `outputs/nas/owner-credentials.json`，未使用 NAS 登录密码。

项目实际根目录为 `/srv/g0dlog`。源码与运行配置位于 `releases/20260910-lan`，SQLite、媒体、备份分别位于 `storage/data`、`storage/media`、`storage/backups`。详见 `deploy-nas-lan.zh-CN.md`。

## 已通过

- 从开发电脑经局域网访问首页、CSS/JS、健康接口、RSS、sitemap、robots。
- Owner 登录、创建草稿、拒绝匿名读取草稿、发布文章。
- PNG 上传，WebP/AVIF 生成与公开访问，匿名原图访问被拒绝，登录后可读取原图。
- 删除并重建应用容器后，同一账号、文章与媒体仍可访问。
- Chrome 无头浏览器真实点击后台、填写凭据并登录工作台，无页面脚本错误；截图位于本机 `outputs/nas/homepage.png` 和 `outputs/nas/studio.png`。
- SQLite `PRAGMA integrity_check` 返回 `ok`。
- 最终镜像执行 `scripts/backup.sh` 成功，并在保存备份前验证 SHA-256 清单。
- 有效备份目录：`storage/backups/g0dlog-20260910T155048Z`。
- 局域网 HTTP 开关的正反例检查，以及修改过的 JavaScript 文件 ESLint 检查。

验收文章 ID：`8e68a9aa-4d3f-42f7-815d-26f0a30b2590`。另外保留了一份调试验收脚本时生成的草稿和图片，均为测试内容。

## 部署时修复

1. 增加仅允许私有 IPv4 的显式局域网 HTTP 配置，Compose 设置监听地址。
2. 提供无 Compose 时的 Docker 启动脚本。
3. 修复独立打包遗漏 Sharp/libvips 动态库；镜像构建时实际生成 WebP 和 AVIF。
4. 备份不再尝试保留镜像内 root 文件的所有权，校验清单不再包含自身，并在提交备份前自检。

公开 GHCR 镜像拒绝匿名拉取，本次使用当前工作区源码在 NAS 构建。编译器下载曾重试，补下载的 musl SWC 压缩包通过锁文件 SHA-512 校验。最终打包复用 `g0dlog:20260910-builder` 缓存，保留了 `Dockerfile.nas-repack`、`build.log` 和 `repack.log`。正常完整构建继续使用仓库 `Dockerfile`。

本次验证局域网部署，未配置公网域名、Tunnel 或 SMTP，也未重启 NAS 整机。
