import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { hashPassword, requireOwner } from "../../../../lib/server-auth";
import { enforceSameOrigin, passwordError } from "../../../../lib/security";
import { recordAudit } from "../../../../lib/audit";
import { slugWithId } from "../../../../lib/slug";

export async function GET() {
  if (!await requireOwner()) return Response.json({ error: "需要 Owner 权限" }, { status: 401 });
  const rows = await getDb().select({ id: users.id, username: users.username, displayName: users.displayName, role: users.role, status: users.status, mustChangePassword: users.mustChangePassword, createdAt: users.createdAt, updatedAt: users.updatedAt }).from(users);
  return Response.json({ users: rows });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const owner = await requireOwner();
  if (!owner) return Response.json({ error: "需要 Owner 权限" }, { status: 401 });
  const payload = (await request.json()) as { username?: string; displayName?: string; password?: string; signature?: string };
  const username = payload.username?.trim() ?? "";
  const displayName = payload.displayName?.trim() ?? "";
  const password = payload.password ?? "";
  const passwordValidation = passwordError(password);
  if (!username || !displayName || passwordValidation) return Response.json({ error: passwordValidation ?? "用户名和显示名称为必填" }, { status: 400 });
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  try {
    const [user] = await getDb().insert(users).values({ id, username, slug: slugWithId(displayName, id), displayName, signature: payload.signature?.trim() ?? null, passwordHash: await hashPassword(password), role: "author", status: "active", mustChangePassword: true, createdAt: now, updatedAt: now }).returning({ id: users.id, username: users.username, slug: users.slug, displayName: users.displayName, role: users.role, status: users.status });
    await recordAudit(owner.id, "create_user", "user", id, { username });
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return Response.json({ error: "用户名已存在" }, { status: 409 });
    throw error;
  }
}
