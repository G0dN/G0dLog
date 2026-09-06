import crypto from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const [password] = process.argv.slice(2);
if (!password) {
  console.error("Usage: node scripts/reset-owner-password.mjs <strong-password>");
  process.exit(1);
}
if (password.length < 12 || [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z\d]/].filter((pattern) => pattern.test(password)).length < 3) {
  console.error("Password must be at least 12 characters and use three character classes.");
  process.exit(1);
}
const dataDir = path.resolve(process.env.BLOG_DATA_DIR || ".data");
const database = new DatabaseSync(path.join(dataDir, "blog.sqlite"));
const owner = database.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").get();
if (!owner) {
  console.error("No Owner account exists. Run bootstrap-owner first.");
  process.exit(1);
}
const salt = crypto.randomUUID();
const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("base64");
const now = new Date().toISOString();
database.prepare("UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = ?, updated_at = ? WHERE id = ?").run(`pbkdf2$120000$${salt}$${hash}`, now, now, owner.id);
database.exec("DELETE FROM sessions");
console.log("Owner password reset and all sessions invalidated.");
