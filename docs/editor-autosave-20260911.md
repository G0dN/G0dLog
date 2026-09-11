# 编辑器和自动保存调整（2026-09-11）

> 部署地址、账号和绝对路径均为示例；实际环境记录仅保存在本机忽略目录 `outputs/private-release-records/`。

## 行为

- Markdown 编辑器默认开启对照，左侧源码、右侧实时渲染；窄窗口也保持左右布局，仍可切换纯写作或纯预览。
- 专栏标题、简介停止输入约 1 秒或离开输入框时自动保存；删除原「保存专栏」按钮，显示保存状态及失败重试。保存请求串行处理，切换专栏时提交待保存内容，本地保留未提交修改。
- 版本历史回溯不再新增普通自动保存记录，也不裁剪历史快照。这是对原实现行为的明确调整，已同步到 `demand_0905.md`。回溯仍递增并发版本号、记录审计，并将历史内容写入工作稿；已发布文章的公开内容只有再次发布才更新。
- 回溯期间暂停编辑器自动保存；成功后清理旧本地草稿，避免重新打开文章又生成自动保存。后续实际编辑仍正常产生自动保存。

## 验证

- 本地生产构建、TypeScript、五项回归测试通过；ESLint 无错误，仅两处已有图片提示。
- API 回归覆盖回溯前后所有历史记录完全一致、版本号递增、过期请求 409、发布内容保持不变。
- Chrome 验证专栏自动保存、连续输入串行保存、失败重试、空标题拦截和切换专栏时提交。
- Chrome 验证带未保存本地草稿的回溯、刷新后无新增历史、回溯后实际编辑生成历史；1440/1024/390px 默认左右布局且无页面横向溢出。
- 浏览器脚本和截图位于忽略目录 `outputs/autosave-review/`。

## NAS 发布

- 正式容器 `g0dlog` 已切换到 `g0dlog:20260911-autosave`，状态 `healthy`。
- 镜像 ID：`sha256:c4b52c71e5c760bc3df09f4dce57407fdbdf8d39edb2ab21185a6d60e77f370bd`。
- 发布目录：`/srv/g0dlog/releases/20260911-autosave`。
- 复用现有系统 SSH/SCP 和 `g0dlog:20260910-builder` 缓存，源码包包含当前全部应用代码、脚本及配置；依赖文件与前次部署 SHA-256 相同。Docker 构建排除本地输出和环境配置。
- 备份：`storage/backups/g0dlog-20260911T125429Z`，备份脚本已完成校验。
- NAS 独立候选容器完整浏览器交互测试通过；正式环境只读检查默认左右预览、版本历史入口、专栏自动保存状态和保存按钮移除，桌面与手机均通过。
- 发布前后 13 篇文章、11 个专栏逐项一致；内容 SHA-256：`692fed52eff0ecbb81e4319b369000cd969cecf3ff7a594284794013cd284086`。媒体校验一致，SQLite 完整性为 `ok`。
- 构建文件、日志和切换脚本：`Dockerfile.autosave`、`autosave-build.log`、`autosave-build.exit`、`deploy-autosave.sh`。切换脚本在健康检查失败时自动回滚。
- 旧容器保留为 `g0dlog-rollback-autosave-20260911`，镜像 `g0dlog:20260911-destination`，已停止并关闭自动重启。

手动回滚（先确认失败容器名字未占用）：

```sh
sudo docker stop g0dlog
sudo docker rename g0dlog g0dlog-failed-autosave-20260911
sudo docker rename g0dlog-rollback-autosave-20260911 g0dlog
sudo docker update --restart unless-stopped g0dlog
sudo docker start g0dlog
```

回滚只切换应用，不覆盖数据库或媒体；本次无数据库迁移。
