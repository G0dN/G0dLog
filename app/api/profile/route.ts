import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { slugHistory, users } from "../../../db/schema";
import { requireUser } from "../../../lib/server-auth";
import { recordAudit } from "../../../lib/audit";
import { enforceSameOrigin } from "../../../lib/security";
import { readableSlug } from "../../../lib/slug";

export async function PATCH(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const user = await requireUser();
  if (!user) return Response.json({ error: "需要登录" }, { status: 401 });
  const payload = (await request.json()) as { displayName?: string; signature?: string; avatarUrl?: string };
  const displayName = payload.displayName?.trim() ?? user.displayName;
  if (!displayName) return Response.json({ error: "显示名称不能为空" }, { status: 400 });
  const avatarUrl = payload.avatarUrl?.trim() || null;
  if (avatarUrl) {
    try {
      const url = new URL(avatarUrl);
      if (!['http:', 'https:'].includes(url.protocol)) return Response.json({ error: "头像地址必须使用 HTTPS 或 HTTP" }, { status: 400 });
    } catch {
      return Response.json({ error: "头像地址格式不正确" }, { status: 400 });
    }
  }
  const nextSlug = displayName === user.displayName ? user.slug : readableSlug(displayName, user.id.slice(0, 8));
  const now = new Date().toISOString();
  const db = getDb();
  let updated;
  try {
    [updated] = await db.update(users).set({ displayName, signature: payload.signature?.trim() || null, avatarUrl, slug: nextSlug, updatedAt: now }).where(eq(users.id, user.id)).returning({ id: users.id, username: users.username, slug: users.slug, displayName: users.displayName, avatarUrl: users.avatarUrl, signature: users.signature, role: users.role, mustChangePassword: users.mustChangePassword });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return Response.json({ error: "作者地址已被占用" }, { status: 409 });
    throw error;
  }
  if (nextSlug !== user.slug) {
    try {
      await db.insert(slugHistory).values({ id: crypto.randomUUID(), resourceType: "author", resourceId: user.id, slug: user.slug, createdAt: now });
    } catch (error) {
      if (!(error instanceof Error && error.message.includes("UNIQUE"))) throw error;
    }
  }
  await recordAudit(user.id, "update_profile", "user", user.id);
  return Response.json({ user: updated });
}
