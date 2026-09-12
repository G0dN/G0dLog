# Sites MVP 运维入口

公开地址：https://g0dlog-mvp.charles4carlos55.chatgpt.site

访问首页的写作后台入口，或 `/studio`。独立 Owner 用户名为 `owner`；本机 `work/sites-mvp-access.txt` 保存初始登录信息。该文件不应提交到 Git 或上传为站点资产。

MVP 使用独立数据库，首次打开没有文章；登录后可创建专栏、写草稿并发布。NAS 的账号、文章和图片没有导入，两个环境互不共享数据。

图片限制为 10 MB、300 万像素；当前使用 WebP 展示版本，不生成 AVIF。后台权限、草稿隔离和发布流程沿用 G0dLog。

代码位于独立 Git 仓库 `work/sites-mvp/`，已推送至 Sites 保存的源码仓库。再次维护时以该目录 `.openai/hosting.json` 的身份为准，不要重新创建 Site。其 README 和 summary.md 记录构建与存储差异。

已完成本地 Workers 生产构建验证：登录、专栏/文章持久化、草稿隔离、发布与文章服务端渲染、版本及地址冲突、文章原子移动、来源校验、图片转换/R2 存储、删除和退出登录后的服务端会话失效。平台返回部署成功；未把本地测试描述为线上逐项验收。

尚未绑定 `g0dlog.top`，也未提交备案申请。大陆正式上线办理路线见 `mainland-launch.zh-CN.md`。

2026-09-12 已更新应用版本至 `1.0.1`（Sites 平台版本 2），部署状态为成功。包含行尾两空格硬换行及 Ctrl/Cmd+B、Ctrl/Cmd+* 编辑快捷键，沿用原数据库、图片存储和公开访问权限。
