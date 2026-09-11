# 首页与阅读页 NAS 发布

> 部署地址、账号和绝对路径均为示例；实际环境记录仅保存在本机忽略目录 `outputs/private-release-records/`。

- 发布版本：`g0dlog:20260911-public-reading`。
- 首页专栏改为紧凑条目（桌面 64px，手机 56px）；点击筛选专栏后自动聚焦并滚动到文章列表，清除搜索，支持减少动态效果偏好。
- 阅读页使用系统无衬线字体，调整正文宽度、留白和目录；代码和公式保留各自字体。
- 本地构建、5 项回归测试通过；ESLint 无错误，保留两处既有图片警告。线上 1440px/390px 浏览器验收通过，未修改线上内容。
- 24 篇文章、28 个专栏逐项一致；媒体哈希一致，SQLite 完整性检查为 `ok`。
- 发布目录：`/srv/g0dlog/releases/20260911-public-reading`。
- 备份：`storage/backups/g0dlog-20260911T132820Z`。
- 发布脚本 `deploy-public-reading.sh` 在健康检查失败时自动回滚；旧容器 `g0dlog-rollback-public-reading-20260911` 已停止并禁用自动重启。

手动回滚前确认 `g0dlog-failed-public-reading-20260911` 名称空闲，然后执行：

```sh
sudo docker stop g0dlog
sudo docker rename g0dlog g0dlog-failed-public-reading-20260911
sudo docker rename g0dlog-rollback-public-reading-20260911 g0dlog
sudo docker update --restart unless-stopped g0dlog
sudo docker start g0dlog
```

回滚不覆盖数据库或媒体。本次未增加迁移。
