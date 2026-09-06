import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const sourceDir = process.argv[2] && path.resolve(process.argv[2]);
if (!sourceDir) throw new Error("Usage: node scripts/import.mjs <export-directory> [data-directory]");
const dataDir = path.resolve(process.argv[3] || process.env.BLOG_DATA_DIR || ".data");
function safePath(root, relative) {
  if (typeof relative !== "string" || !relative || path.isAbsolute(relative)) throw new Error(`Invalid export path: ${relative}`);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relative);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) throw new Error(`Export path escapes its root: ${relative}`);
  return resolved;
}
const manifestPath = path.join(sourceDir, "manifest.json");
const databaseJsonPath = path.join(sourceDir, "database.json");
if (!fs.existsSync(manifestPath) || !fs.existsSync(databaseJsonPath)) throw new Error("Invalid export: manifest.json and database.json are required");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
for (const file of manifest.files || []) {
  const filePath = safePath(sourceDir, file.path);
  const hash = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  if (hash !== file.sha256) throw new Error(`Checksum mismatch: ${file.path}`);
}
const databasePath = path.join(dataDir, "blog.sqlite");
if (fs.existsSync(databasePath)) throw new Error(`Refusing to overwrite existing database: ${databasePath}`);
fs.mkdirSync(dataDir, { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec("PRAGMA foreign_keys=OFF");
const migrationDir = path.resolve("drizzle");
for (const file of ["0000_abandoned_warhawk.sql", "0001_moaning_blonde_phantom.sql", "0002_g0dlog_baseline.sql", "0003_media_derivatives.sql", "0004_draft_and_avif.sql"]) database.exec(fs.readFileSync(path.join(migrationDir, file), "utf8"));
database.exec("PRAGMA user_version=5");
const exported = JSON.parse(fs.readFileSync(databaseJsonPath, "utf8"));
if (exported.format !== "g0dlog-export" || exported.version !== 1) throw new Error("Unsupported export format");
const order = ["users", "columns", "column_members", "articles", "article_versions", "media", "slug_history", "audit_logs"];
for (const table of order) {
  for (const row of exported.tables?.[table] || []) {
    const keys = Object.keys(row);
    database.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...keys.map((key) => row[key]));
  }
}
database.exec("PRAGMA foreign_keys=ON");
const foreignKeyErrors = database.prepare("PRAGMA foreign_key_check").all();
if (foreignKeyErrors.length) throw new Error(`Imported data has ${foreignKeyErrors.length} foreign-key error(s)`);
const mediaDir = path.resolve(process.env.BLOG_MEDIA_DIR || ".media");
fs.mkdirSync(mediaDir, { recursive: true });
for (const file of manifest.files || []) if (file.path.startsWith("media/")) fs.copyFileSync(safePath(sourceDir, file.path), safePath(mediaDir, file.path.slice("media/".length)));
console.log(`Imported G0dLog data into ${dataDir}`);
