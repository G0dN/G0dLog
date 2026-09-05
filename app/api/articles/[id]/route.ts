import { and, eq, lt } from "drizzle-orm";
import { getDb } from "../../../../db";
import { articleVersions, articles, columns, users } from "../../../../db/schema";
import { requireArticleEditor } from "../../../../lib/server-auth";

async function findArticle(id: string) {
  const rows = await getDb().select({ article: articles, column: columns, author: users }).from(articles).innerJoin(columns, eq(articles.columnId, columns.id)).innerJoin(users, eq(articles.authorId, users.id)).where(eq(articles.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const row = await findArticle(id);
  if (!row) return Response.json({ error: "文章不存在" }, { status: 404 });
  const isPublic = row.article.status === "published" && !row.article.deletedAt && !row.column.deletedAt;
  if (!isPublic && !await requireArticleEditor(id)) return Response.json({ error: "没有文章访问权限" }, { status: 403 });
  return Response.json({ article: row.article, column: row.column, author: row.author });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await requireArticleEditor(id);
  if (!user) return Response.json({ error: "没有文章编辑权限" }, { status: 403 });
  const current = await findArticle(id);
  if (!current) return Response.json({ error: "文章不存在" }, { status: 404 });
  const payload = (await request.json()) as { version?: number; title?: string; bodyMarkdown?: string; status?: "draft" | "published"; action?: "delete" | "restore" };
  if (!Number.isInteger(payload.version)) return Response.json({ error: "缺少文章版本号" }, { status: 400 });
  if (payload.version !== current.article.version) return Response.json({ error: "检测到内容冲突", currentVersion: current.article.version, article: current.article }, { status: 409 });
  const nextVersion = current.article.version + 1;
  const now = new Date().toISOString();
  const nextTitle = payload.title === undefined ? current.article.title : payload.title.trim();
  const nextBody = payload.bodyMarkdown === undefined ? current.article.bodyMarkdown : payload.bodyMarkdown;
  if (!nextTitle) return Response.json({ error: "文章标题不能为空" }, { status: 400 });
  const nextStatus = payload.action === "delete" ? "deleted" : payload.action === "restore" ? (payload.status === "published" ? "published" : "draft") : payload.status ?? current.article.status;
  const firstPublishedAt = nextStatus === "published" ? current.article.firstPublishedAt ?? now : current.article.firstPublishedAt;
  const lastPublishedAt = nextStatus === "published" ? now : current.article.lastPublishedAt;
  const [updated] = await getDb().update(articles).set({ title: nextTitle, bodyMarkdown: nextBody, status: nextStatus, firstPublishedAt, lastPublishedAt, deletedAt: nextStatus === "deleted" ? now : null, deletedBy: nextStatus === "deleted" ? user.id : null, version: nextVersion, updatedAt: now }).where(and(eq(articles.id, id), eq(articles.version, current.article.version))).returning();
  if (!updated) return Response.json({ error: "检测到内容冲突", currentVersion: current.article.version }, { status: 409 });
  await getDb().insert(articleVersions).values({ id: crypto.randomUUID(), articleId: id, version: nextVersion, title: nextTitle, bodyMarkdown: nextBody, savedBy: user.id, createdAt: now });
  await getDb().delete(articleVersions).where(and(eq(articleVersions.articleId, id), lt(articleVersions.version, Math.max(1, nextVersion - 19))));
  if (nextStatus === "published") await getDb().update(columns).set({ latestPublishedAt: now, updatedAt: now }).where(eq(columns.id, current.article.columnId));
  return Response.json({ article: updated });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await requireArticleEditor(id);
  if (!user) return Response.json({ error: "没有文章编辑权限" }, { status: 403 });
  const current = await findArticle(id);
  if (!current) return Response.json({ error: "文章不存在" }, { status: 404 });
  const now = new Date().toISOString();
  const nextVersion = current.article.version + 1;
  const [article] = await getDb().update(articles).set({ status: "deleted", deletedAt: now, deletedBy: user.id, version: nextVersion, updatedAt: now }).where(and(eq(articles.id, id), eq(articles.version, current.article.version))).returning({ id: articles.id, status: articles.status, deletedAt: articles.deletedAt, version: articles.version });
  if (!article) return Response.json({ error: "检测到内容冲突" }, { status: 409 });
  await getDb().insert(articleVersions).values({ id: crypto.randomUUID(), articleId: id, version: nextVersion, title: current.article.title, bodyMarkdown: current.article.bodyMarkdown, savedBy: user.id, createdAt: now });
  return Response.json({ article });
}
