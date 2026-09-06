import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = path.resolve(process.env.BLOG_DATA_DIR || ".data");
const database = new DatabaseSync(path.join(dataDir, "blog.sqlite"));
const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
const result = database.prepare("DELETE FROM audit_logs WHERE created_at < ?").run(cutoff);
console.log(`Removed ${result.changes} audit records older than 90 days.`);
