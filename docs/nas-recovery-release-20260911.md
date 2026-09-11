# 恢复页面审核与 NAS 发布（2026-09-11）

> 部署地址、账号和绝对路径均为示例；实际环境记录仅保存在本机忽略目录 `outputs/private-release-records/`。

## 审核结论

审核修复后通过。文章和专栏一级页面使用不带 `includeDeleted=1` 的受权限约束接口；删除后立即移出列表，删除专栏时同时移出其文章。独立恢复面板读取回收内容，恢复文章为草稿，所属专栏被删除时先恢复专栏。

本次审核补齐：

- 恢复按钮防重复提交、网络/刷新失败提示、过期版本 409 后重新加载。
- 恢复列表加载失败时显示明确重试入口，避免误报空列表。
- 专栏恢复按钮只对 Owner 或专栏创建者启用；协作者显示联系管理员提示。API 权限检查保持不变。
- 修正恢复页专栏文章数量文案：接口统计未删除文章，并非仅公开文章。
- 修复手机端短页面导致导航栏被网格拉高的问题。

## 验证

- `pnpm lint`：无错误，仅两处原有图片优化警告。
- `pnpm build` 和 TypeScript：通过。
- `node --test tests/rendered-html.test.mjs`：4/4 通过。
- 本地独立数据库 Chrome 流程：删除文章与专栏后立即消失、父专栏未恢复时阻止文章恢复、恢复专栏再恢复文章、草稿状态与正文保留、加载失败重试。
- 本地 1440/390/320px 截图无横向溢出，人工检查桌面与手机恢复页；无 JavaScript pageerror。
- 线上只读 Chrome 验收：1440/390px 的恢复入口、一级列表数量、回收列表数量和手机导航高度全部通过。没有删除或恢复线上内容来做测试。
- 线上 4 篇文章、4 个专栏前后结果相同；媒体逐文件 SHA-256 相同，SQLite `integrity_check` 为 `ok`。

## 发布与回滚

- 访问：`http://192.168.1.100:3000/studio`。
- 当前镜像：`g0dlog:20260911-recovery-reviewed`。
- 镜像 ID：`sha256:c3a2d09c85a998e85945dc726ebf917d941edc36aca8656ff74c4b0742f18033`。
- 正式容器 `g0dlog` 状态 `healthy`。
- 发布目录：`/srv/g0dlog/releases/20260911-recovery-reviewed`。
- 备份：`storage/backups/g0dlog-20260911T093157Z`，创建时已自检。
- 旧容器：`g0dlog-rollback-recovery-20260911`，已停止、自动重启关闭，镜像为 `g0dlog:20260911-frontend`。
- 构建与切换文件：`Dockerfile.recovery`、`recovery-build.log`、`deploy-recovery.sh`。脚本包含失败自动回滚。候选容器启动验证后才切换。

手动回退可在确认新名字未占用后执行：

```sh
sudo docker stop g0dlog
sudo docker rename g0dlog g0dlog-failed-recovery-20260911
sudo docker rename g0dlog-rollback-recovery-20260911 g0dlog
sudo docker update --restart unless-stopped g0dlog
sudo docker start g0dlog
```

持久化目录不变，无数据库迁移。NAS 已有 `20260911-recovery` 目录，因此本次使用独立的 `20260911-recovery-reviewed`，未覆盖该已有目录。

本地测试脚本/截图位于忽略目录 `outputs/recovery-review/`；线上截图为 `outputs/nas/recovery-deployed-1440.png` 与 `outputs/nas/recovery-deployed-390.png`。
