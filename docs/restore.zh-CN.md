# G0dLog 导出、导入与恢复

## 完整导出

在应用停止写入或确认 SQLite 备份窗口后执行：

```sh
node scripts/export.mjs ./exports/g0dlog-$(date -u +%Y%m%dT%H%M%SZ)
```

导出目录包含：

- `database.json`：作者、专栏、协作者、文章、版本、slug 历史、媒体元数据和审计记录；不包含会话令牌；
- `media/`：数据库引用的原图、WebP 和 AVIF 公开衍生图；
- `manifest.json`：文件列表、格式版本、导出时间和 SHA-256 校验值。

导出格式是程序无关的 JSON + 文件目录，导入顺序由脚本明确实现，避免只能由当前数据库文件读取。

## 隔离恢复演练

将导出目录复制到隔离主机或临时 NAS 目录后：

```sh
BLOG_MEDIA_DIR=./restore-media node scripts/import.mjs ./exports/g0dlog-YYYYMMDDTHHMMSSZ ./restore-data
BLOG_MEDIA_DIR=./restore-media node scripts/verify-restore.mjs ./restore-data ./restore-media
ALLOW_INSECURE_LOCAL=1 BLOG_DATA_DIR="$PWD/restore-data" BLOG_MEDIA_DIR="$PWD/restore-media" BLOG_BACKUP_DIR="$PWD/restore-backups" PUBLIC_SITE_URL=http://127.0.0.1:3300 PORT=3300 pnpm start
```

验证主页、任意公开文章、作者页、专栏页、RSS、sitemap、图片和后台登录；确认文章作者、专栏和版本关系正确后再结束演练。不要把恢复库直接覆盖正式库。

## 从每日备份恢复

每日备份目录是可直接检查的 `data/blog.sqlite` 与 `media/`。停止应用后，把它们复制到新的隔离 bind mount，运行 `verify-restore.mjs`，确认无误后再切换 Compose 的 `BLOG_DATA_DIR` 和 `BLOG_MEDIA_DIR`。保留旧目录，直到新实例完成健康检查与人工抽查。

## Owner 离线密码重置

如果网页不可用但 NAS 数据盘可读：

```sh
BLOG_DATA_DIR=/path/to/data node scripts/reset-owner-password.mjs '<新的强密码>'
```

该命令不发送邮件，会清除所有既有会话。密码不得出现在备份、日志或提交记录中。
