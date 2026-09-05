import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { articles } from "../../../../../../db/schema";
import { requireColumnManager } from "../../../../../../lib/server-auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!await requireColumnManager(id)) return Response.json({ error: "没有专栏管理权限" }, { status: 403 });
  const payload = (await request.json()) as { articleIds?: string[] };
  const articleIds = Array.isArray(payload.articleIds) ? payload.articleIds : [];
  const db = getDb();
  const rows = await db.select({ id: articles.id }).from(articles).where(and(eq(articles.columnId, id), isNull(articles.deletedAt)));
  const validIds = new Set(rows.map((row) => row.id));
  if (articleIds.length !== validIds.size || articleIds.some((articleId) => !validIds.has(articleId))) return Response.json({ error: "文章顺序与当前专栏不一致" }, { status: 400 });
  for (const [sortOrder, articleId] of articleIds.entries()) await db.update(articles).set({ sortOrder, updatedAt: new Date().toISOString() }).where(eq(articles.id, articleId));
  return Response.json({ ok: true, articleIds });
}
