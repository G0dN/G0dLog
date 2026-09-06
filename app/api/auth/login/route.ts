import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { createSession, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from "../../../../lib/server-auth";
import { clearLoginFailures, enforceSameOrigin, isLoginRateLimited, loginRateKey, noteLoginFailure } from "../../../../lib/security";
import { recordAudit } from "../../../../lib/audit";

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const payload = (await request.json()) as { username?: string; password?: string };
  const username = payload.username?.trim() ?? "";
  const password = payload.password ?? "";
  if (!username || !password) return Response.json({ error: "请输入用户名和密码" }, { status: 400 });

  const rateKey = loginRateKey(request, username);
  if (isLoginRateLimited(rateKey)) return Response.json({ error: "登录尝试过多，请稍后再试" }, { status: 429 });
  const db = getDb();
  const rows = await db.select().from(users).where(and(eq(users.username, username), eq(users.status, "active"))).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    noteLoginFailure(rateKey);
    return Response.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  clearLoginFailures(rateKey);
  const session = await createSession(user.id);
  await db.update(users).set({ lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(users.id, user.id));
  await recordAudit(user.id, "login", "session");
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.token, sessionCookieOptions(request, session.expires));
  return Response.json({ user: { id: user.id, username: user.username, slug: user.slug, displayName: user.displayName, role: user.role }, mustChangePassword: user.mustChangePassword });
}
