import { and, asc, count, desc, eq, isNull, like, ne, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { articles, columnMembers, columns, users, articleVersions } from "../../../db/schema";
import { requireUser } from "../../../lib/server-auth";
import { enforceSameOrigin } from "../../../lib/security";
import { recordAudit } from "../../../lib/audit";
import { slugWithId } from "../../../lib/slug";

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
    conditions.push(or(like(articles.title, pattern), like(articles.bodyMarkdown, pattern), ...(managed ? [like(articles.draftTitle, pattern), like(articles.draftBodyMarkdown, pattern)] : []), like(users.displayName, pattern), like(columns.title, pattern))!);
  }
  if (managed) {
    const user = await requireUser();
    if (!user) return Response.json({ error: "需要登录" }, { status: 401 });
    const membership = and(eq(columnMembers.columnId, columns.id), eq(columnMembers.userId, user.id), eq(columnMembers.status, "active"));
    const access = user.role === "owner" ? undefined : or(eq(columns.creatorId, user.id), and(eq(articles.authorId, user.id), eq(columnMembers.userId, user.id)));
    const rows = await getDb().select({ id: articles.id, slug: articles.slug, columnId: articles.columnId, columnSlug: columns.slug, columnTitle: columns.title, authorId: articles.authorId, authorSlug: users.slug, authorName: users.displayName, title: articles.title, bodyMarkdown: articles.bodyMarkdown, draftTitle: articles.draftTitle, draftBodyMarkdown: articles.draftBodyMarkdown, firstPublishedAt: articles.firstPublishedAt, lastPublishedAt: articles.lastPublishedAt, sortOrder: articles.sortOrder, status: articles.status, version: articles.version }).from(articles).innerJoin(columns, eq(articles.columnId, columns.id)).innerJoin(users, eq(articles.authorId, users.id)).leftJoin(columnMembers, membership).where(and(...conditions, access)).orderBy(asc(articles.sortOrder), asc(articles.firstPublishedAt), desc(articles.lastPublishedAt));
    return Response.json({ articles: rows.map(({ draftTitle, draftBodyMarkdown, ...article }) => ({ ...article, title: draftTitle ?? article.title, bodyMarkdown: draftBodyMarkdown ?? article.bodyMarkdown })) });
  }
  const rows = await getDb().select({ id: articles.id, slug: articles.slug, columnId: articles.columnId, columnSlug: columns.slug, columnTitle: columns.title, authorId: articles.authorId, authorSlug: users.slug, authorName: users.displayName, title: articles.title, bodyMarkdown: articles.bodyMarkdown, firstPublishedAt: articles.firstPublishedAt, lastPublishedAt: articles.lastPublishedAt, sortOrder: articles.sortOrder, status: articles.status, version: articles.version }).from(articles).innerJoin(columns, eq(articles.columnId, columns.id)).innerJoin(users, eq(articles.authorId, users.id)).where(and(...conditions)).orderBy(columnId ? asc(articles.sortOrder) : desc(articles.firstPublishedAt), columnId ? asc(articles.firstPublishedAt) : desc(articles.lastPublishedAt), desc(articles.lastPublishedAt));
  const normalized = query?.toLocaleLowerCase();
  const publicRows = normalized ? rows.map((row) => { const titleHit = row.title.toLocaleLowerCase().includes(normalized); const bodyHit = row.bodyMarkdown.toLocaleLowerCase().includes(normalized); const authorHit = (row.authorName ?? "").toLocaleLowerCase().includes(normalized); const columnHit = (row.columnTitle ?? "").toLocaleLowerCase().includes(normalized); return { ...row, matchType: titleHit ? "title" : bodyHit ? "body" : authorHit ? "author" : columnHit ? "column" : "none", snippet: row.bodyMarkdown.replace(/\s+/g, " ").slice(0, 180) }; }).sort((a, b) => (a.matchType === "title" ? 0 : a.matchType === "body" ? 1 : 2) - (b.matchType === "title" ? 0 : b.matchType === "body" ? 1 : 2) || String(b.firstPublishedAt ?? "").localeCompare(String(a.firstPublishedAt ?? ""))) : rows;
  return Response.json({ articles: publicRows });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const user = await requireUser();
  if (!user) return Response.json({ error: "需要登录" }, { status: 401 });
  const payload = (await request.json()) as { columnId?: string; title?: string; bodyMarkdown?: string; status?: "draft" | "published" };
  const db = getDb();
  let [column] = payload.columnId
    ? await db.select({ id: columns.id, creatorId: columns.creatorId }).from(columns).where(and(eq(columns.id, payload.columnId), isNull(columns.deletedAt))).limit(1)
    : await db.select({ id: columns.id, creatorId: columns.creatorId }).from(columns).where(and(eq(columns.title, "随笔"), eq(columns.creatorId, user.id), isNull(columns.deletedAt))).orderBy(columns.createdAt).limit(1);
  if (!column && !payload.columnId) [column] = await db.select({ id: columns.id, creatorId: columns.creatorId }).from(columns).where(and(eq(columns.title, "随笔"), isNull(columns.deletedAt))).orderBy(columns.createdAt).limit(1);
  if (!column && !payload.columnId) {
    const defaultColumnId = crypto.randomUUID();
    const now = new Date().toISOString();
    [column] = await db.insert(columns).values({ id: defaultColumnId, slug: slugWithId("随笔", defaultColumnId), title: "随笔", description: "", creatorId: user.id, createdAt: now, updatedAt: now }).returning({ id: columns.id, creatorId: columns.creatorId });
  }
  if (!column) return Response.json({ error: "专栏不存在" }, { status: 404 });
  if (!payload.columnId && user.role !== "owner" && column.creatorId !== user.id) {
    const [membership] = await db.select({ userId: columnMembers.userId }).from(columnMembers).where(and(eq(columnMembers.columnId, column.id), eq(columnMembers.userId, user.id), eq(columnMembers.status, "active"))).limit(1);
    if (!membership) {
      const defaultColumnId = crypto.randomUUID();
      const defaultNow = new Date().toISOString();
      [column] = await db.insert(columns).values({ id: defaultColumnId, slug: slugWithId("随笔", defaultColumnId), title: "随笔", description: "", creatorId: user.id, createdAt: defaultNow, updatedAt: defaultNow }).returning({ id: columns.id, creatorId: columns.creatorId });
    }
  }
  if (user.role !== "owner" && column.creatorId !== user.id) {
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
  const [article] = await db.insert(articles).values({ id, slug: slugWithId(title, id), columnId: column.id, authorId: user.id, title, bodyMarkdown, status, firstPublishedAt, lastPublishedAt: firstPublishedAt, sortOrder: Number(last?.maxSortOrder ?? 0), createdAt: now, updatedAt: now }).returning();
  await db.insert(articleVersions).values({ id: crypto.randomUUID(), articleId: id, version: 1, title, bodyMarkdown, savedBy: user.id, kind: status === "published" ? "publish" : "autosave", createdAt: now });
  if (status === "published") await db.update(columns).set({ latestPublishedAt: now, updatedAt: now }).where(eq(columns.id, column.id));
  await recordAudit(user.id, status === "published" ? "publish_article" : "create_article", "article", id);
  return Response.json({ article }, { status: 201 });
}
