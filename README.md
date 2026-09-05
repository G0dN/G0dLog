# 一页 YiYe Notes

一个克制、留白充分的中文个人博客与教程站原型。公开阅读页以浏览器 PDF 阅读器为参考，后台工作台围绕 Markdown 写作、自动保存、版本历史、专栏管理与协作者权限设计。

## 本地运行

要求 Node.js `>=22.13.0`。

```bash
npm install
npm run build
npm run start
```

打开终端输出的本地地址即可查看：

- 首页：专栏列表、最近文章、站点介绍；
- 全站搜索：同时检索文章、专栏与作者；
- 阅读页：专栏目录、专栏内搜索、文章目录与响应式移动目录；
- 工作台：`/studio`。文章、专栏、成员与权限均有独立入口；登录后可以创建作者、首次改密、邀请/移除协作者、软删除/恢复专栏和调整文章顺序。

公开示例内容仍集中写在 `app/page.tsx`，用于无数据库时预览页面；登录后的后台数据通过 D1 API 持久化，图片通过 R2 API 持久化。服务端会校验账号、专栏成员关系、文章编辑权限和版本号，移除协作者不会删除其既有文章。

首次配置管理员时，先生成一条不保存明文密码的 SQL，再交给 D1 执行：

```bash
node scripts/bootstrap-admin.mjs admin 管理员 '请替换为至少 8 位密码' > /tmp/yinye-admin.sql
wrangler d1 execute site-creator-d1 --local --file=/tmp/yinye-admin.sql
```

生产环境将 `--local` 换成对应的远程 D1 选项，并先执行 `drizzle/0000_abandoned_warhawk.sql` 和 `drizzle/0001_moaning_blonde_phantom.sql`。不要把生成的 SQL 或密码提交到仓库。

## 验证

```bash
npm run build
npm test
npm run lint
```

## 持久化与部署

`.openai/hosting.json` 已声明：结构化数据使用 `DB`（D1），媒体文件使用 `MEDIA`（R2）。数据库表覆盖用户、会话、专栏、成员关系、文章、版本历史和媒体元数据；文章使用不可变 ID 和 slug 关联，删除字段均为软删除，文章保存使用版本号支持冲突检测。D1 迁移文件位于 `drizzle/`，R2 媒体接口限制图片类型和 10 MB 大小，并生成随机安全文件名。

正式部署的建议目录：

```text
/volume1/docker/yinye/
├── data/       # 数据库文件或迁移产物
├── media/      # 图片媒体
└── backups/    # 第二份备份
```

NAS 上使用 Docker Compose 时，先复制 `.env.example` 为 `.env`，填写实际目录，确保 `data`、`media` 和 `backups` 都是 Docker volume 或 bind mount，不要把内容放在容器层。可执行备份脚本：

```bash
./scripts/backup.sh
```

脚本会把数据库目录、Markdown/迁移文件和媒体目录打包到带时间戳的备份目录。正式使用时还需要把 `backups` 同步到另一块硬盘或另一台设备；“永久保留”不能只依赖 NAS 上的一份数据。

## 第一版边界

不包含评论、点赞、关注、邮件通知、统计、私密文章、开放注册和邮箱找回密码。后台账号由管理员创建，停用账号不删除其已公开内容。
