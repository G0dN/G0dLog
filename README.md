# G0dLog

G0dLog is a small, Chinese-language multi-author blog for one Owner and invited authors. It is designed for a calm public reading experience and straightforward self-hosting on a NAS.

The production architecture is a standard Next.js Node.js application with Drizzle ORM and SQLite. The SQLite database and local media directory are mounted from the host; public image derivatives are served by the application, while original uploads require an authenticated Owner or author session.

## Requirements

- Node.js `>=22.13.0`
- pnpm `11.19.0` (Corepack can provide it)
- Docker and Compose for the NAS deployment

## Local development

```bash
corepack enable
pnpm install
pnpm dev
```

The first database access creates `.data/blog.sqlite` and applies the migrations in `drizzle/`. Local media is stored in `.media/`. These directories are ignored by Git.

For a production build and standalone server (the production validator intentionally requires explicit paths and a site URL):

```bash
pnpm lint
pnpm test
pnpm build
ALLOW_INSECURE_LOCAL=1 PUBLIC_SITE_URL=http://127.0.0.1:3000 BLOG_DATA_DIR="$PWD/.data" BLOG_MEDIA_DIR="$PWD/.media" BLOG_BACKUP_DIR="$PWD/.backups" PORT=3000 pnpm start
```

The initial Owner is created offline after the database exists:

```bash
pnpm db:bootstrap-owner -- owner "Site Owner" 'Replace-With-A-Strong-Password9!'
```

If the web UI is unavailable, reset the Owner password directly on the NAS:

```bash
BLOG_DATA_DIR=/path/to/data node scripts/reset-owner-password.mjs 'New-Strong-Password9!'
```

Both commands enforce the password policy and invalidate existing sessions when appropriate. Do not put real passwords in shell history, logs, backups, or commits.

## Product surfaces

- Public home, author, column, and article pages require no login.
- Search covers article titles and bodies, authors, and columns, with simple Chinese/English substring matching and highlighting.
- Stable public URLs use an immutable resource ID plus a readable slug. Older slugs are recorded and redirected to the canonical URL.
- `/studio` provides Owner and author login, column/member management, Markdown source plus preview editing, autosave, local draft recovery, version history, publishing, soft deletion, restore, and profile/password management.
- Markdown rendering is allowlisted: raw HTML is rendered as text, resource URLs are restricted, fenced code uses the bundled highlight.js grammar, formulas use the bundled KaTeX CSS/runtime, images are magic-byte checked on upload, metadata is stripped, and non-GIF uploads receive WebP and AVIF display derivatives.
- Public output includes `/rss.xml`, `/sitemap.xml`, `/robots.txt`, canonical metadata, and Open Graph metadata.

The first version intentionally does not include comments, likes, follows, public registration, private content, mail password recovery, two-factor authentication, generic attachments, Mermaid, analytics, or a second external database/object store.

## Data and deployment

Copy `.env.example` to `.env` for a Compose deployment. At minimum, provide the public HTTPS URL and persistent host directories:

```text
G0DLOG_IMAGE=ghcr.io/g0dn/g0dlog:latest
BLOG_DATA_DIR=/path/on/nas/g0dlog/data
BLOG_MEDIA_DIR=/path/on/nas/g0dlog/media
BLOG_BACKUP_DIR=/path/on/nas/g0dlog/backups
PUBLIC_SITE_URL=https://your-public-domain.example
```

Start the production container with the published image:

```bash
docker compose pull
docker compose up -d --no-build
docker compose ps
```

Production startup rejects missing persistent paths, placeholder domains, and non-HTTPS public URLs; local standalone checks must explicitly set `ALLOW_INSECURE_LOCAL=1` as shown above.

The public release image is `ghcr.io/g0dn/g0dlog:latest` (release tags are also published). Set the GHCR package visibility to **Public** once in the repository's Packages settings. The image has a health check at `/api/health`. `docs/deploy-zspace.zh-CN.md` documents the ZSpace Z4S, Cloudflare DNS/Tunnel, update lock, backup, and recovery workflow. Cloudflare is only an HTTPS/DNS/Tunnel edge; it is not the database or media store.

## Backup, export, and recovery

Create a checksummed NAS backup:

```bash
BLOG_DATA_DIR=./data BLOG_MEDIA_DIR=./media BLOG_BACKUP_DIR=./backups sh scripts/backup.sh
```

Create a portable JSON plus media export and restore it into an empty directory:

```bash
node scripts/export.mjs ./exports/g0dlog-export
node scripts/import.mjs ./exports/g0dlog-export ./restore-data
BLOG_MEDIA_DIR=./restore-media node scripts/verify-restore.mjs ./restore-data ./restore-media
```

The export includes authors, columns, collaborators, articles, versions, slug history, media metadata/files, audit records, checksums, and import order. Sessions are intentionally excluded. The backup script uses a consistent SQLite snapshot rather than copying a live database file byte-for-byte. See `docs/restore.zh-CN.md` for the quarterly isolated restore drill.

## Release automation

`.github/workflows/release.yml` runs lint, tests, a production build, and pushes the tagged image to GHCR. Release/tag runs require the Render and NAS webhook secrets instead of silently skipping deployment. The NAS helper `scripts/deploy-nas.sh` requires `flock`, takes a deployment lock, creates a backup, pulls the exact release image from `RELEASE_VERSION`, waits for the health check, and rolls back to the previous image on failure. `scripts/release-webhook.mjs` is the HMAC-authenticated receiver for the NAS host; it waits for the deployment process and returns failure to GitHub Actions when the health gate or rollback fails.

## License

G0dLog is released under the MIT License. See [LICENSE](LICENSE).
