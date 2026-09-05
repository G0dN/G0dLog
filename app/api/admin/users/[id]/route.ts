import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { users } from "../../../../../db/schema";
import { hashPassword, requireAdmin } from "../../../../../lib/server-auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "需要管理员权限" }, { status: 401 });
  const { id } = await context.params;
  const payload = (await request.json()) as { action?: "disable" | "enable" | "reset_password"; password?: string };
  if (id === admin.id && payload.action === "disable") return Response.json({ error: "不能停用当前管理员" }, { status: 400 });
  const now = new Date().toISOString();
  if (payload.action === "disable" || payload.action === "enable") {
    await getDb().update(users).set({ status: payload.action === "disable" ? "disabled" : "active", updatedAt: now }).where(eq(users.id, id));
    return Response.json({ ok: true });
  }
  if (payload.action === "reset_password") {
    const temporaryPassword = payload.password && payload.password.length >= 8 ? payload.password : "Temp-" + crypto.randomUUID().slice(0, 8);
    await getDb().update(users).set({ passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true, passwordChangedAt: null, updatedAt: now }).where(eq(users.id, id));
    return Response.json({ ok: true, temporaryPassword });
  }
  return Response.json({ error: "不支持的操作" }, { status: 400 });
}
