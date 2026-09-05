# 一页 YiYe Notes — 项目架构速览

> 给接手项目的 agent 使用。先读本文件，再读 `REQUIREMENTS.md`；需求文档优先级最高。

## 0. 2026-08-12 验收与界面优化状态

本轮已完成一次需求对照验收和视觉收敛：

- 首页改为纯文字、细分隔线与大留白的极简排版，只保留站点、搜索、专栏和文章；专栏卡片使用轻微入场/悬停动画。
- 阅读页已改为浏览器 PDF 阅读器结构：顶部工具栏、左侧专栏文章目录、灰色画布、中央白色纸张、右侧页内目录；移动端目录折叠。
- 后台去掉筛选、格式工具条、安全提示和模拟冲突等演示噪音；编辑器默认显示排版结果，点击“编辑”进入 Markdown 源码模式，粘贴/拖拽图片仍可用。
- `app/page.tsx` 现在包含轻量 Markdown 解析，支持标题、段落、粗体、行内代码、链接、引用、无序列表、代码块、表格和图片；不执行原始 HTML。
- 历史版本面板改为读取真实 API 并支持恢复；文章增加软删除/恢复按钮。
- 修正 `requireArticleEditor`：普通协作者现在只能修改自己的文章，专栏创建者和管理员仍可管理专栏内任意文章。
- 修正生产 `Dockerfile`：运行阶段复制构建阶段的 `node_modules`，避免只安装 production dependencies 后缺少 `vinext` 启动命令。
- 管理员重置密码后，前端会显示 API 返回的临时密码。
- 已通过 `vinext build`、2 个 Node 验收测试、桌面与 390×844 移动端浏览器检查。ESLint 无错误，仅保留动态媒体使用原生 `<img>` 的性能提示。

已确认仍未完整实现的需求：

- 作者尚无个人资料编辑界面/API（显示名称、头像、签名）。
- 编辑器是“同页排版视图 + 源码模式”，还不是 Typora 那种逐块原地编辑的真正 WYSIWYG。
- API 仍会自动裁剪超过 20 条的文章版本，和“被删除文章的内容及版本永久保留”存在语义冲突。
- 图片上传仅依据浏览器声明的 MIME 校验，没有检查文件魔数；Markdown 图片 URL 尚缺少协议白名单。
- 当前自动化测试偏静态与 SSR 冒烟，没有登录后 CRUD、权限矩阵、上传、恢复和 Docker 容器的端到端测试。
- Cloudflare D1/R2 部署链路和极空间 Z4S 上的 Docker Compose 尚未在真实环境验证。
- 中文搜索使用 SQLite `LIKE`，在目标规模可用，但未做分词、相关度排序和命中高亮。

## 1. 项目定位

这是一个极简中文博客/教程站原型：

- 公开内容：主页、专栏、文章、作者主页、全站搜索、专栏内搜索；无需登录。
- 后台内容：文章编辑、专栏管理、成员与权限管理。
- 视觉方向：公开阅读页接近浏览器 PDF 阅读器 / Typora，克制、留白、少装饰文字。
- 当前本地入口：`http://127.0.0.1:3000/`。
- 最终部署目标：极空间 Z4S NAS + Docker；Cloudflare/Sites 配置使用 D1 + R2 binding 名称。

## 2. 技术栈与启动方式

- React 19 + TypeScript。
- Next App Router 风格目录，由 `vinext` 构建和启动，不是标准 Next CLI。
- Drizzle ORM + SQLite/D1 schema。
- Cloudflare runtime binding：`DB`（D1）、`MEDIA`（R2）。配置在 `.openai/hosting.json`。
- 本地 `vinext start` 没有 Cloudflare binding 时，`db/index.ts` 使用 Node 22 内置 `node:sqlite`，数据库文件默认写入 `.data/blog.sqlite`。
- 本地媒体没有 R2 时，图片写入 `BLOG_MEDIA_DIR`，默认 `.media/`。

```bash
npm install
npm run build
npm run start
```

开发环境要求 Node.js `>=22.13.0`。当前环境中如果 `npm` 不在 PATH，需要使用 Codex bundled Node 路径和 `node_modules/.bin` 下的命令。

## 3. 目录结构

```text
app/
├── page.tsx                         # 主客户端入口：主页、阅读页、后台工作台
├── layout.tsx                       # html lang、metadata、全局 CSS
├── globals.css                      # 全站样式；末尾有极简风格覆盖规则
├── studio/page.tsx                  # /studio，复用 Home(initialView="studio")
├── articles/[id]/page.tsx           # 稳定文章公开入口
├── columns/[id]/page.tsx            # 稳定专栏公开入口
├── authors/[id]/page.tsx            # 稳定作者公开入口
└── api/
    ├── auth/                        # 登录、会话、退出、首次改密
    ├── admin/users/                 # 管理员创建/停用/重置作者账号
    ├── columns/                     # 专栏、成员、文章顺序
    ├── articles/                    # 文章 CRUD、版本、发布和软删除
    └── media/                       # 图片上传与读取

db/
├── schema.ts                        # Drizzle schema
└── index.ts                         # D1 adapter + 本地 node:sqlite fallback

lib/
├── server-auth.ts                   # PBKDF2 密码、session、服务端权限检查
├── runtime-env.ts                   # Cloudflare Worker runtime binding bridge
├── media-storage.ts                 # R2 / 本地媒体目录双实现

drizzle/
├── 0000_abandoned_warhawk.sql       # 初始 schema
├── 0001_moaning_blonde_phantom.sql  # session、密码字段、成员软移除字段
└── meta/                            # Drizzle migration snapshots/journal

worker/index.ts                      # Cloudflare Worker entry；注入 __YIYE_ENV
vite.config.ts                       # vinext、Sites、Cloudflare Vite plugin
build/sites-vite-plugin.ts           # Sites 构建插件
docker-compose.yml                   # Docker 端口与 data/media volume
Dockerfile                           # multi-stage production image
scripts/backup.sh                    # data/media/迁移备份
scripts/bootstrap-admin.mjs          # 生成 PBKDF2 管理员 SQL
tests/rendered-html.test.mjs         # build 后 HTML 和架构静态验收
```

## 4. 前端架构

`app/page.tsx` 是一个客户端组件，当前通过 `View` 切换三种界面：

```text
Home
├── home
│   └── SiteHeader + HomeView
├── reader
│   └── ReaderView + ArticleBody
└── studio
    └── StudioView
        ├── ArticleEditor
        ├── ColumnManager
        └── MemberManager
```

### 公开端

- 主页：专栏卡片、最近文章、全站搜索结果三类分组。
- 阅读页：左侧文章目录、专栏内搜索、正文、Markdown 标题目录。
- 移动端：目录折叠为抽屉，保留返回主页和搜索入口。
- 稳定地址使用内部 ID；前端点击文章时会更新到 `/articles/:id`。

### 后台端

- `文章`：单页面编辑区、草稿/发布、保存状态、冲突提示、版本入口、图片粘贴/拖拽/文件上传。
- `专栏`：标题/简介、软删除/恢复、文章拖拽/上下移动排序。
- `成员与权限`：选择专栏、显示创建者、邀请/移除协作者、创建作者、停用/启用、重置密码、首次登录改密状态。
- 未登录时仍能看到极简后台壳作为预览；真正写入操作必须登录，服务端不会只依赖前端隐藏按钮。

示例数据仍保存在 `app/page.tsx`，用于数据库为空或 API 不可用时的视觉预览。登录后后台会请求 managed API；公开主页会请求公开 API，失败时保留示例内容。

## 5. 数据模型

定义在 `db/schema.ts`：

| 表 | 作用 | 关键约束 |
|---|---|---|
| `users` | 管理员/作者账号 | `role`、`status`、密码 hash、`mustChangePassword` |
| `sessions` | 登录 session | token hash 唯一、30 天过期 |
| `columns` | 专栏 | 不可变 `id`/`slug`、创建者、最近发布时间、`deletedAt` |
| `columnMembers` | 专栏协作者关系 | `(columnId,userId)` 复合主键；`active/removed` 软移除 |
| `articles` | 文章 | `draft/published/deleted`、不可变 slug、sortOrder、version |
| `articleVersions` | 文章历史 | 每次保存一条，接口保留最近 20 个版本 |
| `media` | 图片元数据 | 随机 storage key、类型、大小、上传者；业务删除不物理删除 |

删除业务对象使用软删除/状态更新，不使用物理 DELETE。文章保存用 `version` 做乐观并发检查；版本不匹配时返回 HTTP 409，前端保留当前输入并提示冲突。

## 6. API 速查

### 认证

```text
POST /api/auth/login
GET  /api/auth/session
POST /api/auth/logout
POST /api/auth/change-password
```

密码使用 PBKDF2-SHA-256，不保存明文。管理员创建账号后设置 `mustChangePassword=true`；首次登录必须调用改密接口。

### 管理员账号

```text
GET  /api/admin/users
POST /api/admin/users
PATCH /api/admin/users/:id
     action = disable | enable | reset_password
```

账号停用，不物理删除；停用账号不能登录，但已发布内容仍可公开展示。

### 专栏与成员

```text
GET    /api/columns                         # 公共已发布专栏
GET    /api/columns?scope=managed            # 当前用户可管理专栏
POST   /api/columns
GET    /api/columns/:id
PATCH  /api/columns/:id                      # 修改或 restore
DELETE /api/columns/:id                      # 软删除
GET    /api/columns/:id/members
POST   /api/columns/:id/members              # 邀请已有启用作者
DELETE /api/columns/:id/members              # status=removed
PATCH  /api/columns/:id/articles/order
```

专栏创建者或管理员才能管理专栏、成员和文章顺序。被移除作者的既有文章保留公开，但 `requireArticleEditor` 会阻止其继续编辑。

### 文章与版本

```text
GET  /api/articles                         # 公共文章，可带 columnId/q
GET  /api/articles?scope=managed            # 当前用户可管理文章
POST /api/articles
GET  /api/articles/:id
PATCH /api/articles/:id                     # 带 version；支持发布/恢复/删除
DELETE /api/articles/:id                    # 软删除并留版本
GET  /api/articles/:id/versions
POST /api/articles/:id/versions             # 从历史版本恢复
```

文章权限规则：管理员 > 专栏创建者 > active 协作者；普通协作者默认只能改自己的文章。所有 API 都在服务端重新查询用户和成员关系。

### 媒体

```text
POST /api/media                            # multipart file
GET  /api/media/:key
```

只接受 JPG、PNG、WebP、GIF，单张最大 10 MB，文件名由 UUID 生成。Cloudflare 环境写 R2，本地/Docker 环境写 `BLOG_MEDIA_DIR`。

## 7. 运行时与持久化

### Cloudflare/Sites

- `.openai/hosting.json`：`DB: D1`、`MEDIA: R2`。
- `worker/index.ts` 收到 request/env 后把 binding 放进 `globalThis.__YIYE_ENV`。
- `db/index.ts` 优先使用 D1；`media-storage.ts` 优先使用 R2。

### 本地 / Docker

- `BLOG_DATA_DIR`：SQLite 数据目录，默认 `.data/`；Compose 映射到 `/var/lib/yinye/data`。
- `BLOG_MEDIA_DIR`：图片目录，默认 `.media/`；Compose 映射到 `/var/lib/yinye/media`。
- 本地启动时首次访问数据库会执行两份迁移并设置 SQLite `user_version=2`。
- `.data/`、`.media/`、`data/`、`media/` 已加入 `.gitignore`。

首次生成管理员 SQL：

```bash
node scripts/bootstrap-admin.mjs admin 管理员 '至少 8 位密码' > /tmp/yinye-admin.sql
wrangler d1 execute site-creator-d1 --local --file=/tmp/yinye-admin.sql
```

## 8. 验证命令

```bash
npm run build
npm run lint
npm test
```

`npm test` 会先 build，再运行 `tests/rendered-html.test.mjs`，检查主页 SSR、核心文案、响应式 CSS、schema、hosting binding、Docker volume 和关键 API/权限代码是否存在。

## 9. 接手时优先注意

1. 先读 `REQUIREMENTS.md` 第 15 节核心验收标准，再修改功能。
2. 不要把新的说明性文字堆到公开页面；公开端的文字必须直接服务于需求。
3. `app/page.tsx` 目前是较大的单文件客户端实现；新增功能前先判断能否抽出组件，避免继续膨胀。
4. 公开端目前保留示例数据作为 fallback；真正的生产数据路径是 API + D1/本地 SQLite。
5. 修改 schema 后必须生成并检查新的 Drizzle migration，同时考虑本地 SQLite 的 `user_version` 初始化逻辑。
6. 修改权限时必须同时更新 `lib/server-auth.ts` 和对应 API route，不能只改后台按钮。
7. 修改上传逻辑时保留类型校验、10 MB 限制、UUID 文件名和“业务删除不物理删除媒体”的规则。
8. 本地 `vinext dev` 在当前 macOS 13.1 环境可能因 Miniflare 运行时版本失败；优先使用 `npm run build && npm run start`。
