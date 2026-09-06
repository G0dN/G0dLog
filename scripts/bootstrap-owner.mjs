import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const [username, displayName, password] = process.argv.slice(2);
if (!username || !displayName || !password) {
  console.error("Usage: node scripts/bootstrap-owner.mjs <username> <display-name> <strong-password>");
  process.exit(1);
}

function passwordError(value) {
  if (value.length < 12) return "Password must be at least 12 characters.";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z\d]/].filter((pattern) => pattern.test(value)).length;
  return classes >= 3 ? null : "Password must use at least three character classes.";
}

const error = passwordError(password);
if (error) {
  console.error(error);
  process.exit(1);
}

const dataDir = path.resolve(process.env.BLOG_DATA_DIR || ".data");
fs.mkdirSync(dataDir, { recursive: true });
const database = new DatabaseSync(path.join(dataDir, "blog.sqlite"));
database.exec("PRAGMA foreign_keys=ON");
const migrationDir = path.resolve("drizzle");
const migrations = [
  [1, "0000_abandoned_warhawk.sql"],
  [2, "0001_moaning_blonde_phantom.sql"],
  [3, "0002_g0dlog_baseline.sql"],
  [4, "0003_media_derivatives.sql"],
  [5, "0004_draft_and_avif.sql"],
];
const version = Number(database.prepare("PRAGMA user_version").get()?.user_version ?? 0);
for (const [target, file] of migrations) if (version < target) database.exec(fs.readFileSync(path.join(migrationDir, file), "utf8"));
database.exec("PRAGMA user_version=5");

const id = crypto.randomUUID();
const salt = crypto.randomUUID();
const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("base64");
const passwordHash = `pbkdf2$120000$${salt}$${hash}`;
const now = new Date().toISOString();
const slug = `${displayName.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "owner"}-${id.slice(0, 8)}`;
const existing = database.prepare("SELECT id FROM users WHERE username = ?").get(username);
if (existing) {
  database.prepare("UPDATE users SET role = 'author' WHERE role = 'owner' AND id <> ?").run(existing.id);
  database.prepare("UPDATE users SET display_name = ?, slug = ?, password_hash = ?, role = 'owner', status = 'active', must_change_password = 0, password_changed_at = ?, updated_at = ? WHERE id = ?").run(displayName, slug, passwordHash, now, now, existing.id);
} else {
  database.prepare("UPDATE users SET role = 'author' WHERE role = 'owner'").run();
  database.prepare("INSERT INTO users (id, username, slug, display_name, password_hash, role, status, must_change_password, password_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'owner', 'active', 0, ?, ?, ?)").run(id, username, slug, displayName, passwordHash, now, now, now);
}
database.exec("DELETE FROM sessions");
console.log(`Owner account ready: ${username}`);
