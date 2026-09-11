# 前端 NAS 发布记录（2026-09-11）

> 部署地址、账号和绝对路径均为示例；实际环境记录仅保存在本机忽略目录 `outputs/private-release-records/`。

- 地址：`http://192.168.1.100:3000`；工作台：`/studio`。
- 当前容器：`g0dlog`，状态 `healthy`。
- 当前镜像：`g0dlog:20260911-frontend`。
- 镜像 ID：`sha256:96113ff44aaea52237cc658655968a460b9e8ad16daeec6d9bc0dbe328fd66f5`。
- 发布目录：`/srv/g0dlog/releases/20260911-frontend`。

## 发布内容

部署 `app/page.tsx`、`app/globals.css`、`app/studio.module.css` 的全部前端改动，包括新登录页、初始密码页面与四个工作台页面。基于前次发布源码建立新目录，并复用 `g0dlog:20260910-builder` 的依赖；本地与 NAS 的 package.json 和锁文件 SHA-256 完全一致。`Dockerfile.frontend` 在 NAS 重新执行 `pnpm build`，并保留 WebP/AVIF 运行验证。

前端传输包 SHA-256：`7fc7f337d13f8f7aeb175e34a20d62b3172d80a2dd6cb097cb8114a4ecef7e0a`。

`Dockerfile.frontend`、`frontend-build.log`、`frontend-build.exit` 和 `deploy-frontend.sh` 保存在发布目录。沿用既有数据库、媒体和备份挂载。

## 备份与回滚

部署前已执行并校验备份：`storage/backups/g0dlog-20260910T161832Z`（UTC 时间命名）。旧容器保留为 `g0dlog-rollback-20260911`，已停止并关闭自动重启；旧镜像 `g0dlog:20260910-lan` 保留。切换脚本包含健康检查失败自动回滚。

需要手动回滚时，在 NAS 上执行：

```sh
sudo docker stop g0dlog
sudo docker rename g0dlog g0dlog-failed-20260911
sudo docker rename g0dlog-rollback-20260911 g0dlog
sudo docker update --restart unless-stopped g0dlog
sudo docker start g0dlog
```

只回退容器版本，不覆盖持久化数据。若 `g0dlog-failed-20260911` 已存在，应先检查该容器再选择一个未使用的名字。

## 验证

- 独立候选容器健康接口与 `/studio` 启动通过后才切换。
- 正式容器 Docker 健康状态为 `healthy`。
- Chrome 真实 Owner 登录通过，新登录页标题和工作台样式确认已上线。
- 桌面 1440px、手机 390px，文章、专栏、成员、资料页面均无视口横向溢出，无 JavaScript pageerror；预览切换通过。
- 当前 4 篇文章和 4 个专栏的 API 结果逐项一致，内容 SHA-256：`2d4c6a67204cfa719e13341957031b3f767a2354b41f0561336aebd99d7eecf2`。
- 媒体目录逐文件 SHA-256 比对一致，SQLite `PRAGMA integrity_check` 为 `ok`。
- 旧验收脚本引用的公开测试文章在切换前已经返回 404，因此本次采用当前实际文章、专栏和媒体的前后比对，没有重新发布测试内容。

本地截图在 `outputs/nas/login-deployed.png`、`outputs/nas/deployed-*-1440.png`、`outputs/nas/deployed-*-390.png` 和 `outputs/nas/homepage-deployed.png`；忽略目录内的浏览器与内容比对脚本仅用于本次验收。
