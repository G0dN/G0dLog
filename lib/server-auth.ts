import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../db";
import { articles, columnMembers, columns, sessions, users } from "../db/schema";

export const SESSION_COOKIE = "g0dlog_session";
export const SESSION_DAYS = 30;
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
  if (!Number.isSafeInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations, hash: "SHA-256" }, key, 256);
    const actual = fromBase64(expected);
    const candidate = new Uint8Array(derived);
    if (actual.length !== candidate.length) return false;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ candidate[index];
    return difference === 0;
  } catch {
    return false;
  }
}

export async function createSession(userId: string) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  await getDb().insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: await digest(token),
    expiresAt: expires.toISOString(),
    createdAt: now.toISOString(),
  });
  return { token, expires };
}

export async function invalidateUserSessions(userId: string) {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

export function sessionCookieOptions(request: Request, expires: Date) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: forwardedProtocol === "https" || new URL(request.url).protocol === "https:",
    expires,
    maxAge: SESSION_DAYS * 86400,
    path: "/",
  };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 256) return null;
  const now = new Date().toISOString();
  const rows = await getDb()
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, await digest(token)), gt(sessions.expiresAt, now), eq(users.status, "active")))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  return user && !user.mustChangePassword ? user : null;
}

export async function requireOwner() {
  const user = await requireUser();
  return user?.role === "owner" ? user : null;
}

// Kept as a compatibility alias for older internal callers; the product role is Owner.
export const requireAdmin = requireOwner;

export async function requireColumnManager(columnId: string) {
  const user = await requireUser();
  if (!user) return null;
  if (user.role === "owner") return user;
  const rows = await getDb().select({ id: columns.id }).from(columns).where(and(eq(columns.id, columnId), eq(columns.creatorId, user.id))).limit(1);
  return rows[0] ? user : null;
}

export async function requireArticleEditor(articleId: string) {
  const user = await requireUser();
  if (!user) return null;
  if (user.role === "owner") return user;
  const rows = await getDb()
    .select({ article: articles, column: columns, membership: columnMembers })
    .from(articles)
    .innerJoin(columns, eq(articles.columnId, columns.id))
    .leftJoin(columnMembers, and(eq(columnMembers.columnId, articles.columnId), eq(columnMembers.userId, user.id)))
    .where(eq(articles.id, articleId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.column.creatorId === user.id) return user;
  if (row.article.authorId === user.id && row.membership?.status === "active") return user;
  return null;
}

export function isOwner(user: AppUser | null | undefined) {
  return user?.role === "owner";
}
