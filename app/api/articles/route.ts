import { and, asc, count, desc, eq, isNull, like, ne, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { articles, columnMembers, columns, users, articleVersions } from "../../../db/schema";
import { requireUser } from "../../../lib/server-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const managed = url.searchParams.get("scope") === "managed";
  const includeDeleted = url.searchParams.get("includeDeleted") === "1";
  const columnId = url.searchParams.get("columnId");
  const query = url.searchParams.get("q")?.trim();
  const conditions = managed ? [includeDeleted ? undefined : ne(articles.status, "deleted"), includeDeleted ? undefined : isNull(articles.deletedAt), includeDeleted ? undefined : isNull(columns.deletedAt)] : [eq(articles.status, "published"), isNull(articles.deletedAt), isNull(columns.deletedAt)];
  if (columnId) conditions.push(eq(articles.columnId, columnId));
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(or(like(articles.title, pattern), like(articles.bodyMarkdown, pattern), like(users.displayName, pattern))!);
  }
  if (managed) {
    const user = await requireUser();
    if (!user) return Response.json({ error: "需要登录" }, { status: 401 });
    const membership = and(eq(columnMembers.userId, user.id), eq(columnMembers.status, "active"));
    const rows = await getDb().select({ id: articles.id, slug: articles.slug, columnId: articles.columnId, columnTitle: columns.title, authorId: articles.authorId, authorName: users.displayName, title: articles.title, bodyMarkdown: articles.bodyMarkdown, firstPublishedAt: articles.firstPublishedAt, lastPublishedAt: articles.lastPublishedAt, sortOrder: articles.sortOrder, status: articles.status, version: articles.version }).from(articles).innerJoin(columns, eq(articles.columnId, columns.id)).innerJoin(users, eq(articles.authorId, users.id)).leftJoin(columnMembers, membership).where(and(...conditions, user.role === "admin" ? undefined : or(eq(columns.creatorId, user.id), eq(columnMembers.userId, user.id)))).orderBy(asc(articles.sortOrder), asc(articles.firstPublishedAt), desc(articles.lastPublishedAt));
    return Response.json({ articles: rows });
  }
  const rows = await getDb().select({ id: articles.id, slug: articles.slug, columnId: articles.columnId, columnTitle: columns.title, authorId: articles.authorId, authorName: users.displayName, title: articles.title, bodyMarkdown: articles.bodyMarkdown, firstPublishedAt: articles.firstPublishedAt, lastPublishedAt: articles.lastPublishedAt, sortOrder: articles.sortOrder, status: articles.status, version: articles.version }).from(articles).innerJoin(columns, eq(articles.columnId, columns.id)).innerJoin(users, eq(articles.authorId, users.id)).where(and(...conditions)).orderBy(asc(articles.sortOrder), asc(articles.firstPublishedAt), desc(articles.lastPublishedAt));
  return Response.json({ articles: rows });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "需要登录" }, { status: 401 });
  const payload = (await request.json()) as { columnId?: string; title?: string; bodyMarkdown?: string; status?: "draft" | "published" };
  if (!payload.columnId) return Response.json({ error: "请选择专栏" }, { status: 400 });
  const db = getDb();
  const [column] = await db.select({ id: columns.id, creatorId: columns.creatorId }).from(columns).where(and(eq(columns.id, payload.columnId), isNull(columns.deletedAt))).limit(1);
  if (!column) return Response.json({ error: "专栏不存在" }, { status: 404 });
  if (user.role !== "admin" && column.creatorId !== user.id) {
    const [membership] = await db.select({ userId: columnMembers.userId }).from(columnMembers).where(and(eq(columnMembers.columnId, column.id), eq(columnMembers.userId, user.id), eq(columnMembers.status, "active"))).limit(1);
    if (!membership) return Response.json({ error: "没有该专栏的写作权限" }, { status: 403 });
  }
  const now = new Date().toISOString();
  const status = payload.status === "published" ? "published" : "draft";
  const id = crypto.randomUUID();
  const title = payload.title?.trim() || "未命名文章";
  const bodyMarkdown = payload.bodyMarkdown ?? "";
  const [last] = await db.select({ maxSortOrder: count(articles.id) }).from(articles).where(eq(articles.columnId, column.id));
  const firstPublishedAt = status === "published" ? now : null;
  const [article] = await db.insert(articles).values({ id, slug: `article-${id.slice(0, 8)}`, columnId: column.id, authorId: user.id, title, bodyMarkdown, status, firstPublishedAt, lastPublishedAt: firstPublishedAt, sortOrder: Number(last?.maxSortOrder ?? 0), createdAt: now, updatedAt: now }).returning();
  await db.insert(articleVersions).values({ id: crypto.randomUUID(), articleId: id, version: 1, title, bodyMarkdown, savedBy: user.id, createdAt: now });
  if (status === "published") await db.update(columns).set({ latestPublishedAt: now, updatedAt: now }).where(eq(columns.id, column.id));
  return Response.json({ article }, { status: 201 });
}
