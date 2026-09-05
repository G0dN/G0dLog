import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { createSession, SESSION_COOKIE, verifyPassword } from "../../../../lib/server-auth";

export async function POST(request: Request) {
  const payload = (await request.json()) as { username?: string; password?: string };
  const username = payload.username?.trim() ?? "";
  const password = payload.password ?? "";
  if (!username || !password) return Response.json({ error: "请输入用户名和密码" }, { status: 400 });

  const db = getDb();
  const rows = await db.select().from(users).where(and(eq(users.username, username), eq(users.status, "active"))).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) return Response.json({ error: "用户名或密码错误" }, { status: 401 });

  const session = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.token, { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", expires: session.expires, path: "/" });
  return Response.json({ user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role }, mustChangePassword: user.mustChangePassword });
}
