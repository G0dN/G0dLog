import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const outputArg = process.argv[2] || `g0dlog-export-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const outputDir = path.resolve(outputArg);
const dataDir = path.resolve(process.env.BLOG_DATA_DIR || ".data");
const mediaDir = path.resolve(process.env.BLOG_MEDIA_DIR || ".media");
const databasePath = path.join(dataDir, "blog.sqlite");
if (!fs.existsSync(databasePath)) throw new Error(`Database not found: ${databasePath}`);
if (fs.existsSync(outputDir)) throw new Error(`Output already exists: ${outputDir}`);
fs.mkdirSync(path.join(outputDir, "media"), { recursive: true });

const database = new DatabaseSync(databasePath);
const tableNames = ["users", "columns", "column_members", "articles", "article_versions", "media", "slug_history", "audit_logs"];
const tables = Object.fromEntries(tableNames.map((table) => [table, database.prepare(`SELECT * FROM ${table}`).all()]));
const files = [];
for (const record of tables.media) {
  for (const key of [record.storage_key, record.display_key, record.avif_key].filter(Boolean)) {
    const source = path.join(mediaDir, key);
    if (!fs.existsSync(source)) throw new Error(`Referenced media file is missing: ${source}`);
    const destination = path.join(outputDir, "media", key);
    fs.copyFileSync(source, destination);
    files.push({ path: `media/${key}`, sha256: crypto.createHash("sha256").update(fs.readFileSync(destination)).digest("hex") });
  }
}
fs.writeFileSync(path.join(outputDir, "database.json"), JSON.stringify({ format: "g0dlog-export", version: 1, tables }, null, 2));
const databaseFile = path.join(outputDir, "database.json");
const manifest = { format: "g0dlog-export", version: 1, exportedAt: new Date().toISOString(), tables: tableNames, files: [{ path: "database.json", sha256: crypto.createHash("sha256").update(fs.readFileSync(databaseFile)).digest("hex") }, ...files] };
fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Exported G0dLog data to ${outputDir}`);
