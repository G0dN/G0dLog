# G0dLog project summary

> 部署地址、账号和绝对路径均为示例；实际环境记录仅保存在本机忽略目录 `outputs/private-release-records/`。

This is a handoff map for future agents. The confirmed product baseline is `demand_0905.md`; `demand_0810.md` is historical and must not drive implementation.

## Runtime

The independent Sites MVP checkout is `work/sites-mvp/` (ignored by this repository and maintained as its own Git repository). Its `.openai/hosting.json` owns the Site identity; its own `summary.md` documents the Vinext/D1/R2 adapter. It has independent accounts and storage and is not the NAS core. `docs/mainland-launch.zh-CN.md` records the mainland launch process and unresolved operator/domain requirements.

- Next.js `16.2.11` App Router, React 19, TypeScript, Drizzle ORM, and Node.js `node:sqlite`.
- `sharp` is pinned to `0.35.4`; the workspace overrides Next's transitive `sharp` and `postcss` resolutions to audited patched versions.
- Standalone preparation explicitly copies installed Sharp native packages because Next tracing omitted the versioned libvips shared library on Alpine during NAS acceptance. The final Docker image now generates both WebP and AVIF during its build to catch missing runtime libraries before deployment.
- The application is SQLite-only. Vinext, Cloudflare D1, and R2 are not part of the production core.
- `next.config.ts` emits a standalone server. `scripts/prepare-standalone.mjs` copies static assets, `public`, runtime migrations and scripts; Docker and `pnpm start` run `.next/standalone/server.js` after production configuration validation. The validator runs for `pnpm start` even when `NODE_ENV` is unset and rejects missing, placeholder, non-HTTPS, or relative production configuration.
- `BLOG_DATA_DIR` contains `blog.sqlite`; `BLOG_MEDIA_DIR` contains original and display image files. Both are bind-mounted in Compose.
- `lib/runtime-env.ts` is intentionally empty because the application no longer depends on edge bindings.

## Main directories

- `app/`: public home, reader, studio, stable article/column/author pages, and API routes.
- `db/`: Drizzle schema and the Node SQLite connection/migration runner.
- `drizzle/`: the original migrations plus the G0dLog baseline and media display-key migrations.
- `lib/`: public loaders, canonical paths, PBKDF2 sessions, server permissions, security, audit, slugs, and local media storage.
- `scripts/`: Owner bootstrap/reset, backup, export/import, restore verification, audit pruning, and locked NAS deployment.
- `scripts/start-nas-container.sh`: Docker-only NAS startup fallback, reading `.env` from the current directory; requires persistent bind-mount directories and an unused `g0dlog` container name.
- `scripts/test-nas-lan.mjs`: opt-in acceptance against an actual deployed NAS; takes an ignored credentials JSON and state JSON, creates an article/image, and supports `verify` after container recreation.
- `docs/`: Chinese ZSpace Z4S deployment and restore instructions.
- `docs/deploy-nas-lan.zh-CN.md`: actual NAS LAN paths, Docker-only operating commands and acceptance procedure. `docs/nas-acceptance-20260910.md` records the completed hardware deployment.
- `render.yaml`: Render Free Docker Web Service definition for the disposable MVP; it uses `/tmp` paths and `g0dlog.top` only during the MVP window.
- `docs/deploy-render.zh-CN.md`: Render setup, DNS ownership during MVP, and the later Cloudflare Tunnel cutover to NAS.
- `tests/rendered-html.test.mjs`: production server, public output, permission, stable URL, and media smoke tests.

## Permission model

`owner` is the only global management role. `author` accounts are created by the Owner. A column creator manages that column, its collaborators, article order, and all articles in it. An active collaborator can create and edit only their own articles. Removing a collaborator preserves their public articles and attribution but immediately removes edit access. Every mutating API repeats these checks server-side.

`requireOwner`, `requireColumnManager`, and `requireArticleEditor` in `lib/server-auth.ts` are the authority for route-level checks. Accounts with `mustChangePassword` remain able to reach the session/password-change endpoints but are rejected by every normal authenticated operation until the password changes. Do not replace these checks with client-only button hiding.

## Content and URL behavior

Articles have `draft`, `published`, and `deleted` states. Deletion is a soft delete with a permanent `delete` version snapshot. Publishing creates a permanent `publish` snapshot. Autosaves are retained to the latest 20 per article. Version numbers use an optimistic concurrency check and return HTTP 409 on stale writes.

Historical version restoration updates the working draft and increments the concurrency counter without creating or trimming any snapshot (revised 2026-09-11 in `demand_0905.md`). It retains restore audit events and never publishes restored drafts implicitly. The editor pauses autosave during restoration and clears the previous browser draft after success.

Articles, columns, and authors use `/resource/<stable-id>/<slug>`. When a slug changes, the previous slug enters `slug_history`; the dynamic page redirects it to the current canonical URL. Public loaders always filter deleted resources. Published content and its author attribution remain public when an account is disabled, while that account can no longer sign in or edit.

`app/page.tsx` contains a safe, deliberately small Markdown renderer. Raw HTML is treated as text, links/images allow only relative, HTTP, and HTTPS URLs, fenced code uses bundled highlight.js classes, and inline/block math uses bundled KaTeX with `trust: false`. Published article fields are immutable during autosave: unpublished title/body edits live in draft columns until an explicit publish, while public API/page loaders only read the published fields. Image editing supports file selection, drag/drop, paste, a 10 MB limit, magic-byte checks, metadata-safe Sharp transforms, GIF preservation, and guaranteed WebP plus AVIF display derivatives. Original image routes require an authenticated user who has completed initial password change; only Owner can permanently purge media.

## Public outputs

`/rss.xml`, `/sitemap.xml`, `/robots.txt`, canonical metadata, and Open Graph metadata are implemented. The public contact control uses Cloudflare-style `data-cfemail` markup; the address is assembled in `lib/site-config.ts` and is not placed in RSS, public JSON, metadata, exports, or README text. Public API responses never return password hashes or session tokens.

## Verification commands

```bash
pnpm install
pnpm lint
pnpm build
pnpm test
```

The test suite creates a temporary SQLite database, boots the production Next server, checks public output, creates Owner/authors/columns/articles, verifies collaborator isolation and removal, exercises publish/delete/restore/versioned URL redirects, and checks that public media works while original media is private.

## Operational notes

- Start from a clean persistent directory; there is no demo-data or API-error fallback.
- LAN HTTP acceptance is explicitly enabled by `ALLOW_INSECURE_LAN=1` with an RFC1918 IPv4 `PUBLIC_SITE_URL`. Public production URLs still require HTTPS. Compose forwards the flag and sets `HOSTNAME=0.0.0.0` so Docker port publishing can reach Next.js.
- `.env.example` is intentionally tracked as the production configuration template; real `.env` files remain ignored.
- Run `scripts/bootstrap-owner.mjs` once on a new database. Use `scripts/reset-owner-password.mjs` when the UI is unavailable.
- Run `scripts/backup.sh` before release and copy weekly backups to offline removable storage. It snapshots SQLite consistently and writes checksums. Use `scripts/export.mjs`, `scripts/import.mjs`, and `scripts/verify-restore.mjs` for portable quarterly restore drills.
- NAS acceptance fixed backup copying to work as the non-root container user, and excludes the checksum manifest from its own input. Backup creation now verifies checksums before promoting the temporary directory.
- Audit rows are intended to be pruned after 90 days with `scripts/prune-audit.mjs`.
- Release tags run `.github/workflows/release.yml`; the workflow pushes a tagged/latest image to GHCR and requires configured Render/NAS webhook secrets for automatic release deployment. `scripts/release-webhook.mjs` verifies HMAC signatures, requires the image tag to match the release version, waits for the deployment process, and returns failure when the health gate or rollback fails. `scripts/deploy-nas.sh` resolves its repository directory, requires explicit production paths and a `flock` utility, then uses a lock, backup, image pull, health gate, automatic image rollback, and optional SMTP alerting.
- The final local production audit reports no known moderate-or-higher vulnerabilities. Docker/NAS hardware, public GHCR visibility, Cloudflare Tunnel, SMTP, domain, and legal/registration checks remain deployment-time checks when the target services are available.
- Render MVP is intentionally non-persistent: `render.yaml` points data, media, and backups at `/tmp`, and `PUBLIC_SITE_URL` is `https://g0dlog.top` while that domain is attached to Render. The same domain must not point to Render and the NAS Tunnel simultaneously; cut over DNS only after NAS acceptance. Formal SQLite/media/backup storage remains NAS-only.
- NAS LAN deployment completed on 2026-09-10 at `http://192.168.1.100:3000`, container `g0dlog`, image `g0dlog:20260910-lan`. The release lives at `/srv/g0dlog/releases/20260910-lan`; persistent mounts use the sibling `storage/{data,media,backups}` directories. HTTP/API and Chrome login checks, container recreation persistence, SQLite integrity and a verified backup passed. Public GHCR pull was denied, so the image was built on the NAS; the cached builder was reused for the final packaging fixes. Owner credentials are only in the ignored local `outputs/nas/owner-credentials.json` file.

## Studio sign-in UI

- `LoginModal` in `app/page.tsx` serves the studio sign-in and mandatory initial password change flows. A native modal dialog provides focus containment, background inertness, and guarded Escape dismissal.
- `app/globals.css` contains scoped `.studio-auth` / `.auth-*` styles: a forest-green editorial brand panel and warm-white form, collapsing to a compact brand header on mobile.
- The form includes password visibility, browser autofill, pending/disabled submission states, network and API error feedback, and administrator contact guidance. Authentication endpoints and server permission rules remain authoritative.

## Studio workspace UI

- `app/studio.module.css` is the scoped layout and typography source for the current `StudioView`, `ArticleEditor`, `ColumnManager`, `MemberManager`, and `ProfilePanel` in `app/page.tsx`. The wrapper class prevents changes from affecting public pages; older studio prototype selectors in `globals.css` do not match several current components and should not be used for new work.
- The workspace uses the public site's paper background, thin rules, serif headings, and teal accents. Form inputs use 16px type; navigation/actions use 14–15px type and controls target at least 40–46px height.
- Desktop uses a navigation rail and list/detail panels. Navigation becomes horizontal below 1100px; below 760px article/column lists become scrollable strips with all items available, and member/forms use a single column.
- The article editor defaults to split view, with Markdown source on the left and live preview on the right at every viewport width. Explicit writing/split/preview controls remain available. Version history is in document flow with a close control, so it cannot cover the editor toolbar.
- `app/column-info-form.tsx` owns column title/description autosave: one-second debounce, blur/unmount flush, serial requests with pending edits, browser draft recovery, visible status and failure retry. It is keyed by column ID so switching columns does not reuse another column's draft. There is no manual save button.
- Member rows match the actual two-child markup, account controls wrap, and account creation is displayed only for the Owner. Server-side permissions remain unchanged.
- The Studio's top-level article and column panels load only active managed records. Deletion removes the item from those panels immediately; the adjacent `恢复文章` / `恢复专栏` buttons open the separate recovery panel. The recovery panel loads deleted records with `includeDeleted=1`, restores articles as drafts and columns independently, and prevents restoring an article while its deleted column would still hide it.
- ESLint ignores the repository's generated `outputs/` directory in addition to build artifacts; source lint still reports only the two existing image optimization warnings.
- `docs/studio-ui-review.md` records the 2026-09-11 Chrome review at 1440/1024/390/320px, production build checks, and the local screenshot/report paths.

## Current NAS release

- Current image: `g0dlog:1.0.1`, container `g0dlog` healthy. Storage mounts are unchanged; the previous image is `g0dlog:20260911-public-reading`, retained in stopped container `g0dlog-rollback-v1.0.1-20260912` with automatic restart disabled.
- `docs/release-v1.0.1.md` records the release behavior and validation; private deployment paths and backup details remain in ignored local release records.

## Recovery review follow-up

- Recovery actions now prevent duplicate requests, report network/refresh failures, and reload stale article versions after a 409. Failed recovery-list loads show an explicit retry state.
- Column recovery controls reflect Owner/column-creator authority; collaborators receive an administrator recovery hint. Server permission enforcement remains unchanged.
- The compact navigation grid uses `auto 1fr` rows so short recovery/empty pages do not stretch the horizontal navigation vertically.
- Local Chrome acceptance covers actual delete -> hidden active list -> deleted-parent guard -> column restore -> draft article restore, body preservation, failed-load retry, and 1440/390/320px screenshots (`outputs/recovery-review/`).

## Article creation and moves

- `app/article-destination-dialog.tsx` is the shared accessible, searchable column picker for creating drafts and moving articles. Creation requires a visible column choice; defaults come only from the article column filter, an explicit column-page action, or the sole available column.
- `StudioView` owns independent column/status article filters. Creation selects the new draft and focuses its title. Column details offer a direct creation button. The editor's column control opens a move confirmation and saves pending edits first; failed saves block the move.
- `POST /api/articles/[id]/move` checks source manager authority, destination write permission, active records and optimistic version inside a synchronous SQLite transaction (`withLocalTransaction` in `db/index.ts`). It keeps article ID/slug/publication/body intact, appends to target order, increments version, updates both columns' publication timestamps, and audits the move atomically. No migration is required.
- Article creation now appends using maximum sort order rather than count, accommodating gaps after moves. API tests cover manager/collaborator boundaries, stale/deleted records, stable URLs, target ordering and source/target statistics.

## Public presentation

The public column list uses compact responsive rows; selecting a column clears search and focuses/scrolls to `#public-article-list` after React commits the filter, respecting reduced motion. Public reader typography is scoped under `.reader-page` in `app/globals.css`: system sans-serif, with monospace code and KaTeX fonts preserved. Its text-only heading links must remain block elements (legacy TOC grid styles assume numbered child spans).
