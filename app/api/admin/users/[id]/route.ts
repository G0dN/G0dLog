import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { users } from "../../../../../db/schema";
import { hashPassword, invalidateUserSessions, requireOwner } from "../../../../../lib/server-auth";
import { enforceSameOrigin, passwordError } from "../../../../../lib/security";
import { recordAudit } from "../../../../../lib/audit";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const owner = await requireOwner();
  if (!owner) return Response.json({ error: "需要 Owner 权限" }, { status: 401 });
  const { id } = await context.params;
  const payload = (await request.json()) as { action?: "disable" | "enable" | "reset_password"; password?: string };
  if (id === owner.id && payload.action === "disable") return Response.json({ error: "不能停用当前 Owner" }, { status: 400 });
  const [target] = await getDb().select({ id: users.id, role: users.role }).from(users).where(eq(users.id, id)).limit(1);
  if (!target) return Response.json({ error: "账号不存在" }, { status: 404 });
  if (target.role === "owner" && id !== owner.id) return Response.json({ error: "系统只允许一个 Owner" }, { status: 400 });
  const now = new Date().toISOString();
  if (payload.action === "disable" || payload.action === "enable") {
    await getDb().update(users).set({ status: payload.action === "disable" ? "disabled" : "active", updatedAt: now }).where(eq(users.id, id));
    if (payload.action === "disable") await invalidateUserSessions(id);
    await recordAudit(owner.id, payload.action === "disable" ? "disable_user" : "enable_user", "user", id);
    return Response.json({ ok: true });
  }
  if (payload.action === "reset_password") {
    const passwordValidation = payload.password ? passwordError(payload.password) : null;
    if (payload.password && passwordValidation) return Response.json({ error: passwordValidation }, { status: 400 });
    const temporaryPassword = payload.password ?? "T-" + crypto.randomUUID().replaceAll("-", "") + "!a9";
    await getDb().update(users).set({ passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true, passwordChangedAt: null, updatedAt: now }).where(eq(users.id, id));
    await invalidateUserSessions(id);
    await recordAudit(owner.id, "reset_password", "user", id);
    return Response.json({ ok: true, temporaryPassword });
  }
  return Response.json({ error: "不支持的操作" }, { status: 400 });
}
