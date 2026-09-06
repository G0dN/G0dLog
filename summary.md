# G0dLog project summary

This is a handoff map for future agents. The confirmed product baseline is `demand_0905.md`; `demand_0810.md` is historical and must not drive implementation.

## Runtime

- Next.js `16.2.11` App Router, React 19, TypeScript, Drizzle ORM, and Node.js `node:sqlite`.
- `sharp` is pinned to `0.35.4`; the workspace overrides Next's transitive `sharp` and `postcss` resolutions to audited patched versions.
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
- `docs/`: Chinese ZSpace Z4S deployment and restore instructions.
- `tests/rendered-html.test.mjs`: production server, public output, permission, stable URL, and media smoke tests.

## Permission model

`owner` is the only global management role. `author` accounts are created by the Owner. A column creator manages that column, its collaborators, article order, and all articles in it. An active collaborator can create and edit only their own articles. Removing a collaborator preserves their public articles and attribution but immediately removes edit access. Every mutating API repeats these checks server-side.

`requireOwner`, `requireColumnManager`, and `requireArticleEditor` in `lib/server-auth.ts` are the authority for route-level checks. Accounts with `mustChangePassword` remain able to reach the session/password-change endpoints but are rejected by every normal authenticated operation until the password changes. Do not replace these checks with client-only button hiding.

## Content and URL behavior

Articles have `draft`, `published`, and `deleted` states. Deletion is a soft delete with a permanent `delete` version snapshot. Publishing creates a permanent `publish` snapshot. Autosaves are retained to the latest 20 per article. Version numbers use an optimistic concurrency check and return HTTP 409 on stale writes.

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
- Run `scripts/bootstrap-owner.mjs` once on a new database. Use `scripts/reset-owner-password.mjs` when the UI is unavailable.
- Run `scripts/backup.sh` before release and copy weekly backups to offline removable storage. It snapshots SQLite consistently and writes checksums. Use `scripts/export.mjs`, `scripts/import.mjs`, and `scripts/verify-restore.mjs` for portable quarterly restore drills.
- Audit rows are intended to be pruned after 90 days with `scripts/prune-audit.mjs`.
- Release tags run `.github/workflows/release.yml`; the workflow pushes a tagged/latest image to GHCR and requires configured Render/NAS webhook secrets for automatic release deployment. `scripts/release-webhook.mjs` verifies HMAC signatures, requires the image tag to match the release version, and passes the exact release image to `scripts/deploy-nas.sh`, which resolves its repository directory, requires explicit production paths, uses a lock, backup, image pull, health gate, automatic image rollback, and optional SMTP alerting.
- The final local production audit reports no known moderate-or-higher vulnerabilities. Docker/NAS hardware, public GHCR visibility, Cloudflare Tunnel, SMTP, domain, and legal/registration checks remain deployment-time checks when the target services are available.
