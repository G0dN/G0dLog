# 文章创建与专栏归属交互（2026-09-11）

> 部署地址、账号和绝对路径均为示例；实际环境记录仅保存在本机忽略目录 `outputs/private-release-records/`。

## 已实现

- 文章页「新建文章」弹窗包含可选标题、必选专栏和专栏搜索。默认值只来自文章筛选、专栏页的明确入口或唯一可用专栏，不沿用其他页面的隐藏选择。
- 专栏详情增加「在此专栏新建文章」。创建后转到文章编辑器、选中新草稿并聚焦标题。
- 文章列表可按专栏和草稿/已发布状态筛选。移动后，若正在按专栏筛选，会跟随目标专栏显示文章。
- 编辑器的所属专栏按钮打开移动弹窗。有修改时先保存，失败则不移动；已发布文章明确提示公开链接不变。
- 新增 `POST /api/articles/[id]/move`，在同步 SQLite 事务内校验来源管理员、目标写作权限、未删除状态和文章版本；更新归属、末尾排序、版本、两边专栏的最新发布时间与审计记录。原 ID、slug、作者、正文及发布状态保持不变，无数据库迁移。
- 来源专栏普通协作者不能移动文章，即使文章是自己写的；专栏创建者和 Owner 可移动，目标仍需具备写作权限。

## 验证

- ESLint 无错误，仅两处原有公开页图片提示。
- 生产构建和 TypeScript 通过。
- 5 项回归测试通过；新增移动测试覆盖双方权限、过期版本、删除状态、公开链接、排序与专栏统计。
- 本地 Chrome：文章页选择/搜索专栏、筛选预选、专栏页直接创建、聚焦新标题、先保存后移动、保存失败阻止移动及重试、移动后筛选跟随，均通过。
- 桌面 1440px 与手机 390px 截图已检查，保持极简风格，无横向溢出。
- 本地浏览器脚本/截图：忽略目录 `outputs/destination-review/`。

## NAS 发布

- 当前镜像：`g0dlog:20260911-destination`；正式容器 `g0dlog` 状态 `healthy`。
- 镜像 ID：`sha256:43dfa9b59869ef9a28903f1b5f6d2e27662f47757b24ff6902e03c3224e468de`。
- 发布目录：`/srv/g0dlog/releases/20260911-destination`。
- 备份：`storage/backups/g0dlog-20260911T105046Z`。
- 旧容器 `g0dlog-rollback-destination-20260911` 已停止并关闭自动重启，镜像为 `g0dlog:20260911-recovery-reviewed`。
- `Dockerfile.destination`、`destination-build.log`、`deploy-destination.sh` 保存在发布目录，切换脚本具备健康失败自动回滚。
- 新镜像在独立 NAS 容器内实际创建并移动测试文章成功。正式环境只读验收创建弹窗、筛选预选、专栏页创建入口和移动弹窗，桌面/手机均通过，未创建或移动线上文章。
- 原有 12 篇文章、9 个专栏逐项一致，媒体 SHA-256 一致，SQLite 完整性为 `ok`。
- 内容基线 SHA-256：`6b0087feaad09d1c783adcafd5cbdb3a233c7af78e2d54d2b18bf7d05cc1da25`。
- 线上截图及脚本位于本机忽略目录 `outputs/nas/destination-*`。

手动回滚（先确认 `g0dlog-failed-destination-20260911` 名字未占用）：

```sh
sudo docker stop g0dlog
sudo docker rename g0dlog g0dlog-failed-destination-20260911
sudo docker rename g0dlog-rollback-destination-20260911 g0dlog
sudo docker update --restart unless-stopped g0dlog
sudo docker start g0dlog
```

回滚只切换应用镜像，不覆盖数据库或媒体；本次没有数据库迁移。
