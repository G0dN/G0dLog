import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { getCurrentUser, hashPassword, verifyPassword } from "../../../../lib/server-auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "需要登录" }, { status: 401 });
  const payload = (await request.json()) as { currentPassword?: string; newPassword?: string };
  const currentPassword = payload.currentPassword ?? "";
  const newPassword = payload.newPassword ?? "";
  if (newPassword.length < 8) return Response.json({ error: "新密码至少 8 位" }, { status: 400 });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) return Response.json({ error: "当前密码错误" }, { status: 400 });
  const now = new Date().toISOString();
  await getDb().update(users).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, passwordChangedAt: now, updatedAt: now }).where(eq(users.id, user.id));
  return Response.json({ ok: true });
}
