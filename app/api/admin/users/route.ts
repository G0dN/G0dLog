import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { hashPassword, requireAdmin } from "../../../../lib/server-auth";

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "需要管理员权限" }, { status: 401 });
  const rows = await getDb().select({ id: users.id, username: users.username, displayName: users.displayName, role: users.role, status: users.status, mustChangePassword: users.mustChangePassword, createdAt: users.createdAt, updatedAt: users.updatedAt }).from(users);
  return Response.json({ users: rows });
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "需要管理员权限" }, { status: 401 });
  const payload = (await request.json()) as { username?: string; displayName?: string; password?: string; signature?: string };
  const username = payload.username?.trim() ?? "";
  const displayName = payload.displayName?.trim() ?? "";
  const password = payload.password ?? "";
  if (!username || !displayName || password.length < 8) return Response.json({ error: "用户名、显示名称和至少 8 位初始密码为必填" }, { status: 400 });
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  try {
    const [user] = await getDb().insert(users).values({ id, username, displayName, signature: payload.signature?.trim() ?? null, passwordHash: await hashPassword(password), role: "author", status: "active", mustChangePassword: true, createdAt: now, updatedAt: now }).returning({ id: users.id, username: users.username, displayName: users.displayName, role: users.role, status: users.status });
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return Response.json({ error: "用户名已存在" }, { status: 409 });
    throw error;
  }
}
