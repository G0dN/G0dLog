import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { columnMembers, columns, users } from "../../../../../db/schema";
import { requireColumnManager } from "../../../../../lib/server-auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const manager = await requireColumnManager(id);
  if (!manager) return Response.json({ error: "没有专栏管理权限" }, { status: 403 });
  const db = getDb();
  const [column] = await db.select({ id: columns.id, title: columns.title, creatorId: columns.creatorId, creatorName: users.displayName }).from(columns).innerJoin(users, eq(columns.creatorId, users.id)).where(eq(columns.id, id)).limit(1);
  if (!column) return Response.json({ error: "专栏不存在" }, { status: 404 });
  const members = await db.select({ id: users.id, username: users.username, displayName: users.displayName, role: users.role, status: users.status, membershipStatus: columnMembers.status, joinedAt: columnMembers.joinedAt }).from(columnMembers).innerJoin(users, eq(columnMembers.userId, users.id)).where(eq(columnMembers.columnId, id));
  const available = await db.select({ id: users.id, username: users.username, displayName: users.displayName, role: users.role, status: users.status }).from(users).where(and(eq(users.status, "active"), eq(users.role, "author")));
  return Response.json({ column, managerId: manager.id, members, availableUsers: available });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const manager = await requireColumnManager(id);
  if (!manager) return Response.json({ error: "没有专栏管理权限" }, { status: 403 });
  const payload = (await request.json()) as { userId?: string };
  if (!payload.userId) return Response.json({ error: "请选择要邀请的作者" }, { status: 400 });
  const db = getDb();
  const [column] = await db.select({ creatorId: columns.creatorId }).from(columns).where(and(eq(columns.id, id), isNull(columns.deletedAt))).limit(1);
  if (!column) return Response.json({ error: "专栏不存在" }, { status: 404 });
  if (payload.userId === column.creatorId) return Response.json({ error: "创建者不需要加入协作者列表" }, { status: 400 });
  const [target] = await db.select({ id: users.id, status: users.status, role: users.role }).from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!target || target.status !== "active" || target.role !== "author") return Response.json({ error: "只能邀请启用中的作者账号" }, { status: 400 });
  const [existing] = await db.select().from(columnMembers).where(and(eq(columnMembers.columnId, id), eq(columnMembers.userId, target.id))).limit(1);
  const now = new Date().toISOString();
  if (existing) {
    if (existing.status === "active") return Response.json({ error: "该作者已经是协作者" }, { status: 409 });
    await db.update(columnMembers).set({ invitedBy: manager.id, status: "active", joinedAt: now, removedAt: null, removedBy: null }).where(and(eq(columnMembers.columnId, id), eq(columnMembers.userId, target.id)));
  } else {
    await db.insert(columnMembers).values({ columnId: id, userId: target.id, invitedBy: manager.id, status: "active", joinedAt: now });
  }
  return Response.json({ ok: true, userId: target.id }, { status: 201 });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const manager = await requireColumnManager(id);
  if (!manager) return Response.json({ error: "没有专栏管理权限" }, { status: 403 });
  const payload = (await request.json()) as { userId?: string };
  if (!payload.userId) return Response.json({ error: "缺少作者 ID" }, { status: 400 });
  const now = new Date().toISOString();
  const [member] = await getDb().update(columnMembers).set({ status: "removed", removedAt: now, removedBy: manager.id }).where(and(eq(columnMembers.columnId, id), eq(columnMembers.userId, payload.userId), eq(columnMembers.status, "active"))).returning({ userId: columnMembers.userId });
  if (!member) return Response.json({ error: "协作者不存在" }, { status: 404 });
  return Response.json({ ok: true, userId: member.userId });
}
