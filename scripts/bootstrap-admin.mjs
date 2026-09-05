import crypto from "node:crypto";

const [username, displayName, password] = process.argv.slice(2);
if (!username || !displayName || !password || password.length < 8) {
  console.error("用法：node scripts/bootstrap-admin.mjs <用户名> <显示名称> <至少 8 位密码>");
  process.exit(1);
}

const salt = crypto.randomUUID();
const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("base64");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const now = new Date().toISOString();
const values = [crypto.randomUUID(), username, displayName, `pbkdf2$120000$${salt}$${hash}`].map(quote).join(", ");
console.log(`INSERT INTO users (id, username, display_name, password_hash, role, status, must_change_password, created_at, updated_at) VALUES (${values}, 'admin', 'active', 0, ${quote(now)}, ${quote(now)});`);
