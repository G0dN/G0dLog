import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = path.resolve(process.argv[2] || process.env.BLOG_DATA_DIR || ".data");
const mediaDir = path.resolve(process.argv[3] || process.env.BLOG_MEDIA_DIR || ".media");
const database = new DatabaseSync(path.join(dataDir, "blog.sqlite"));
database.exec("PRAGMA foreign_keys=ON");
const required = ["users", "columns", "column_members", "sessions", "articles", "article_versions", "media", "slug_history", "audit_logs"];
for (const table of required) database.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get();
const integrity = database.prepare("PRAGMA integrity_check").get();
if (integrity?.integrity_check !== "ok") throw new Error(`SQLite integrity check failed: ${integrity?.integrity_check ?? "unknown"}`);
const foreignKeyErrors = database.prepare("PRAGMA foreign_key_check").all();
if (foreignKeyErrors.length) throw new Error(`Foreign-key check failed for ${foreignKeyErrors.length} row(s)`);
const media = database.prepare("SELECT storage_key, display_key, avif_key FROM media").all();
for (const record of media) {
  if (!fs.existsSync(path.join(mediaDir, record.storage_key))) throw new Error(`Missing original media: ${record.storage_key}`);
  if (!fs.existsSync(path.join(mediaDir, record.display_key))) throw new Error(`Missing display media: ${record.display_key}`);
  if (record.avif_key && !fs.existsSync(path.join(mediaDir, record.avif_key))) throw new Error(`Missing AVIF media: ${record.avif_key}`);
}
const published = database.prepare("SELECT count(*) AS count FROM articles WHERE status = 'published' AND deleted_at IS NULL").get().count;
const users = database.prepare("SELECT count(*) AS count FROM users").get().count;
const owners = database.prepare("SELECT count(*) AS count FROM users WHERE role = 'owner'").get().count;
if (Number(owners) > 1) throw new Error(`Owner uniqueness check failed: ${owners} owners`);
const versionRows = database.prepare("SELECT count(*) AS count FROM article_versions v LEFT JOIN articles a ON a.id = v.article_id WHERE a.id IS NULL").get().count;
if (Number(versionRows) > 0) throw new Error(`Article version relationship check failed: ${versionRows} orphan(s)`);
console.log(JSON.stringify({ ok: true, users, owners, publishedArticles: published, media: media.length, foreignKeys: 0 }));
