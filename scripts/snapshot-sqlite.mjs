import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const sourceDir = path.resolve(process.env.BLOG_DATA_DIR || ".data");
const source = path.join(sourceDir, "blog.sqlite");
const destination = path.resolve(process.argv[2] || "");
if (!destination) throw new Error("Usage: node scripts/snapshot-sqlite.mjs <destination.sqlite>");
if (!fs.existsSync(source)) throw new Error(`Database not found: ${source}`);
fs.mkdirSync(path.dirname(destination), { recursive: true });
if (fs.existsSync(destination)) fs.rmSync(destination, { force: true });

const database = new DatabaseSync(source);
try {
  database.prepare("PRAGMA wal_checkpoint(PASSIVE)").run();
  database.prepare("VACUUM INTO ?").run(destination);
} finally {
  database.close();
}
console.log(`Created consistent SQLite snapshot: ${destination}`);
