# G0dLog 1.0.0 — First stable release

This release meets the project's current functional and NAS deployment acceptance criteria. **ICP filing has not yet been approved.** NAS LAN deployment has been verified; public-domain access, HTTPS integration, and regulatory approval are not claimed as complete.

## Product scope

G0dLog serves one site Owner and invited authors, using Next.js, React, Drizzle, and SQLite. The first stable release includes public article, column, and author pages; stable ID/slug URLs and redirects; search; Markdown; code highlighting; math; image processing; RSS; sitemap; robots; and page metadata. These capabilities originated in the existing production baseline. This release combines them with validated NAS deployment and a complete authoring workflow.

## Changes in this release

### Studio and authentication

- Redesign sign-in and mandatory initial password change, with password visibility, autofill, pending states, error feedback, and native dialog focus management.
- Rework workspace layout, typography, control sizes, member forms, and responsive navigation. Fix misalignment, undersized controls, and narrow-screen overflow while preserving the minimal paper background, thin rules, and green accents.
- Default the editor to Markdown source and live preview side by side, retaining writing/split/preview controls. Keep version history in normal document flow.

### Article creation and column assignment

- Create articles through an explicit, searchable column picker with an optional title, removing dependence on hidden selection state from another page.
- Add direct article creation from column details; select the new draft and focus its title.
- Add column and status filters. Allow changing an article's column from the editor, saving pending edits first and stopping the move if saving fails.
- Add a move API that checks source management authority, target write permission, deletion state, and optimistic concurrency within a SQLite transaction. Update ordering, versions, statistics, and audit records while preserving article ID, slug, author, body, and publication state.
- Append new articles after the maximum existing sort order, accommodating gaps left by moves.

### Saving and recovery

- Autosave column titles and descriptions with debounce, blur/unmount submission, serialized requests, browser draft recovery, status feedback, and failure retry.
- Prevent completed older save requests from clearing newer edits.
- Hide deleted articles and columns from primary management pages and provide separate recovery views.
- Restore articles as drafts, requiring a deleted parent column to be restored first. Include permission guidance, duplicate-request protection, stale-version handling, and retry after failed loads.
- Restore historical versions into the working draft and increment the concurrency version without creating or trimming historical snapshots or implicitly publishing. Retain audit records.

### Homepage and reading

- Replace tall column cards with compact rows, approximately 64px on desktop and 56px on mobile.
- Clear search and filter articles when a column is selected, then focus and scroll to the article list after rendering. Respect reduced-motion preferences.
- Use system sans-serif reading typography and refine text width, line spacing, whitespace, headings, and navigation proportions. Fix character-by-character wrapping in the table of contents while preserving code and math fonts.

### NAS deployment and operations

- Add explicit LAN HTTP acceptance restricted to private IPv4 addresses; public production configuration continues to require HTTPS.
- Provide Docker startup without Compose and a real NAS acceptance script, with persistent SQLite, media, and backup directories.
- Fix missing Sharp/libvips native dependencies in standalone packaging. Generate WebP and AVIF during Docker builds to verify the runtime libraries.
- Fix non-root backup permissions and self-inclusion in checksum manifests. Verify backups before promoting them to their final location.
- Exclude real environment configuration, test output, and logs from Docker builds. Stop tracking package-manager and TypeScript caches in Git.
- Add deployment, workspace review, recovery, autosave, article movement, and reading-page release records; update the project architecture summary. Use sanitized deployment examples in public documentation and retain actual environment records only in ignored local storage.

## Verification

- Production build and TypeScript checks passed. ESLint reported no errors and two existing image optimization warnings.
- All five integration/regression tests passed, covering public output, permissions, versions, stable URLs, media access, and article movement boundaries.
- Local Chrome reviews covered desktop, tablet, and mobile layouts. Final NAS public-page acceptance at 1440px and 390px verified column height, scroll/focus behavior, typography, and absence of horizontal overflow.
- NAS acceptance verified persistence across container recreation, image processing, health checks, and backups. The final deployment preserved all 24 articles and 28 columns exactly; media SHA-256 checksums matched and SQLite integrity checks returned `ok`.
- These results describe the recorded acceptance runs, not unperformed public-network or regulatory checks.

## Deployment and rollback

The deployed NAS image is `g0dlog:20260911-public-reading` and passed health checks. This Git release sets the package version to `1.0.0`; it does not automatically replace that date-named image. The latest deployment introduced no database migration and retained the previous application container and a verified backup.

- [Current NAS deployment and rollback](public-reading-release-20260911.md)
- [NAS deployment guide](deploy-nas-lan.zh-CN.md)
- [Hardware acceptance](nas-acceptance-20260910.md)
- [Workspace UI review](studio-ui-review.md)
- [Article destination workflow](article-destination-20260911.md)
- [Editor and autosave](editor-autosave-20260911.md)
- [Recovery page release](nas-recovery-release-20260911.md)

The first release excludes public registration, comments, likes, follows, private content, email password recovery, two-factor authentication, general attachments, and analytics. Public access, ICP filing, and environment-specific launch configuration remain subject to completion for the intended deployment.
