import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../db";
import { articles, columnMembers, columns, sessions, users } from "../db/schema";

const SESSION_COOKIE = "yinye_session";
const SESSION_DAYS = 30;
const encoder = new TextEncoder();

export type AppUser = typeof users.$inferSelect;

function toBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function digest(value: string) {
  const result = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toBase64(new Uint8Array(result));
}

export async function hashPassword(password: string) {
  const salt = crypto.randomUUID();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations: 120000, hash: "SHA-256" }, key, 256);
  return `pbkdf2$120000$${salt}$${toBase64(new Uint8Array(derived))}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterationText, salt, expected] = encoded.split("$");
  if (algorithm !== "pbkdf2" || !iterationText || !salt || !expected) return false;
  const iterations = Number(iterationText);
  if (!Number.isSafeInteger(iterations) || iterations < 100000) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations, hash: "SHA-256" }, key, 256);
  const actual = fromBase64(expected);
  const candidate = new Uint8Array(derived);
  if (actual.length !== candidate.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ candidate[index];
  return difference === 0;
}

export async function createSession(userId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  const db = getDb();
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: await digest(token),
    expiresAt: expires.toISOString(),
    createdAt: now.toISOString(),
  });
  return { token, expires };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const now = new Date().toISOString();
  const db = getDb();
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, await digest(token)), gt(sessions.expiresAt, now), eq(users.status, "active")))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function requireUser(): Promise<AppUser | null> {
  return getCurrentUser();
}

export async function requireAdmin(): Promise<AppUser | null> {
  const user = await requireUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function requireColumnManager(columnId: string): Promise<AppUser | null> {
  const user = await requireUser();
  if (!user) return null;
  if (user.role === "admin") return user;
  const db = getDb();
  const rows = await db.select({ id: columns.id }).from(columns).where(and(eq(columns.id, columnId), eq(columns.creatorId, user.id))).limit(1);
  if (!rows[0]) return null;
  return user;
}

export async function requireArticleEditor(articleId: string): Promise<AppUser | null> {
  const user = await requireUser();
  if (!user) return null;
  if (user.role === "admin") return user;
  const db = getDb();
  const rows = await db
    .select({ article: articles, column: columns, membership: columnMembers })
    .from(articles)
    .innerJoin(columns, eq(articles.columnId, columns.id))
    .leftJoin(columnMembers, and(eq(columnMembers.columnId, articles.columnId), eq(columnMembers.userId, user.id)))
    .where(eq(articles.id, articleId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const ownsArticleWithAccess = row.article.authorId === user.id && (row.column.creatorId === user.id || row.membership?.status === "active");
  const allowed = row.column.creatorId === user.id || ownsArticleWithAccess;
  if (!allowed) return null;
  return user;
}

export { SESSION_COOKIE };
