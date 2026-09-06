import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { createSession, getCurrentUser, hashPassword, invalidateUserSessions, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from "../../../../lib/server-auth";
import { enforceSameOrigin, passwordError } from "../../../../lib/security";
import { recordAudit } from "../../../../lib/audit";

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "需要登录" }, { status: 401 });
  const payload = (await request.json()) as { currentPassword?: string; newPassword?: string };
  const currentPassword = payload.currentPassword ?? "";
  const newPassword = payload.newPassword ?? "";
  const passwordValidation = passwordError(newPassword);
  if (passwordValidation) return Response.json({ error: passwordValidation }, { status: 400 });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) return Response.json({ error: "当前密码错误" }, { status: 400 });
  const now = new Date().toISOString();
  await getDb().update(users).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, passwordChangedAt: now, updatedAt: now }).where(eq(users.id, user.id));
  await invalidateUserSessions(user.id);
  const session = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.token, sessionCookieOptions(request, session.expires));
  await recordAudit(user.id, "change_password", "user", user.id);
  return Response.json({ ok: true, user: { id: user.id, username: user.username, slug: user.slug, displayName: user.displayName, role: user.role, mustChangePassword: false } });
}
