import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { articles, columns, users } from "../../../../db/schema";
import { requireColumnManager } from "../../../../lib/server-auth";

async function findColumn(id: string, includeDeleted: boolean) {
  const rows = await getDb().select({
    id: columns.id,
    slug: columns.slug,
    title: columns.title,
    description: columns.description,
    creatorId: columns.creatorId,
    creatorName: users.displayName,
    createdAt: columns.createdAt,
    updatedAt: columns.updatedAt,
    latestPublishedAt: columns.latestPublishedAt,
    deletedAt: columns.deletedAt,
    articleCount: count(articles.id),
  }).from(columns)
    .innerJoin(users, eq(columns.creatorId, users.id))
    .leftJoin(articles, and(eq(articles.columnId, columns.id), eq(articles.status, "published"), isNull(articles.deletedAt)))
    .where(and(eq(columns.id, id), includeDeleted ? undefined : isNull(columns.deletedAt)))
    .groupBy(columns.id, columns.slug, columns.title, columns.description, columns.creatorId, users.displayName, columns.createdAt, columns.updatedAt, columns.latestPublishedAt, columns.deletedAt)
    .orderBy(desc(columns.updatedAt))
    .limit(1);
  return rows[0] ? { ...rows[0], articleCount: Number(rows[0].articleCount) } : null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const managed = new URL(request.url).searchParams.get("scope") === "managed";
  if (managed && !await requireColumnManager(id)) return Response.json({ error: "没有专栏管理权限" }, { status: 403 });
  const column = await findColumn(id, managed);
  if (!column || (!managed && column.articleCount === 0)) return Response.json({ error: "专栏不存在" }, { status: 404 });
  return Response.json({ column });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!await requireColumnManager(id)) return Response.json({ error: "没有专栏管理权限" }, { status: 403 });
  const payload = (await request.json()) as { title?: string; description?: string; action?: "restore" };
  const current = await findColumn(id, true);
  if (!current) return Response.json({ error: "专栏不存在" }, { status: 404 });
  const now = new Date().toISOString();
  const nextTitle = payload.title === undefined ? current.title : payload.title.trim();
  if (!nextTitle) return Response.json({ error: "专栏标题不能为空" }, { status: 400 });
  const [column] = await getDb().update(columns).set({
    title: nextTitle,
    description: payload.description === undefined ? current.description : payload.description.trim(),
    deletedAt: payload.action === "restore" ? null : current.deletedAt,
    updatedAt: now,
  }).where(eq(columns.id, id)).returning();
  return Response.json({ column });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!await requireColumnManager(id)) return Response.json({ error: "没有专栏管理权限" }, { status: 403 });
  const now = new Date().toISOString();
  const [column] = await getDb().update(columns).set({ deletedAt: now, updatedAt: now }).where(eq(columns.id, id)).returning({ id: columns.id, deletedAt: columns.deletedAt });
  if (!column) return Response.json({ error: "专栏不存在" }, { status: 404 });
  return Response.json({ column });
}
