import { and, desc, eq, isNull, max } from "drizzle-orm";
import { getDb } from "../../../../db";
import { articleVersions, articles, columns, slugHistory, users } from "../../../../db/schema";
import { requireArticleEditor } from "../../../../lib/server-auth";
import { enforceSameOrigin } from "../../../../lib/security";
import { recordAudit } from "../../../../lib/audit";
import { readableSlug } from "../../../../lib/slug";
import { publicAvatarUrl } from "../../../../lib/site-config";

async function findArticle(id: string) {
  const rows = await getDb().select({ article: articles, column: columns, author: users }).from(articles).innerJoin(columns, eq(articles.columnId, columns.id)).innerJoin(users, eq(articles.authorId, users.id)).where(eq(articles.id, id)).limit(1);
  return rows[0] ?? null;
}

function editorArticle(article: typeof articles.$inferSelect) {
  return { ...article, title: article.draftTitle ?? article.title, bodyMarkdown: article.draftBodyMarkdown ?? article.bodyMarkdown };
}

function publicArticle(article: typeof articles.$inferSelect) {
  const { draftTitle: _draftTitle, draftBodyMarkdown: _draftBodyMarkdown, ...publishedArticle } = article;
  void _draftTitle;
  void _draftBodyMarkdown;
  return publishedArticle;
}

async function trimAutosaves(articleId: string) {
  const db = getDb();
  const autosaves = await db.select({ id: articleVersions.id }).from(articleVersions).where(and(eq(articleVersions.articleId, articleId), eq(articleVersions.kind, "autosave"))).orderBy(desc(articleVersions.version));
  for (const oldVersion of autosaves.slice(20)) await db.delete(articleVersions).where(eq(articleVersions.id, oldVersion.id));
}

async function refreshColumnLatestPublishedAt(columnId: string, updatedAt: string) {
  const db = getDb();
  const [latest] = await db.select({ value: max(articles.lastPublishedAt) }).from(articles).where(and(eq(articles.columnId, columnId), eq(articles.status, "published"), isNull(articles.deletedAt)));
  await db.update(columns).set({ latestPublishedAt: latest?.value ?? null, updatedAt }).where(eq(columns.id, columnId));
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const row = await findArticle(id);
  if (!row) return Response.json({ error: "文章不存在" }, { status: 404 });
  const isPublic = row.article.status === "published" && !row.article.deletedAt && !row.column.deletedAt;
  const editor = await requireArticleEditor(id);
  if (!isPublic && !editor) return Response.json({ error: "没有文章访问权限" }, { status: 403 });
  const article = editor ? editorArticle(row.article) : publicArticle(row.article);
  return Response.json({ article, column: row.column, author: { id: row.author.id, slug: row.author.slug, displayName: row.author.displayName, avatarUrl: publicAvatarUrl(row.author.avatarUrl), signature: row.author.signature } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const { id } = await context.params;
  const user = await requireArticleEditor(id);
  if (!user) return Response.json({ error: "没有文章编辑权限" }, { status: 403 });
  const current = await findArticle(id);
  if (!current) return Response.json({ error: "文章不存在" }, { status: 404 });
  const payload = (await request.json()) as { version?: number; title?: string; bodyMarkdown?: string; slug?: string; status?: "draft" | "published"; saveKind?: "autosave" | "publish"; action?: "delete" | "restore" };
  if (!Number.isInteger(payload.version)) return Response.json({ error: "缺少文章版本号" }, { status: 400 });
  if (payload.status !== undefined && payload.status !== "draft" && payload.status !== "published") return Response.json({ error: "文章状态无效" }, { status: 400 });
  if (payload.saveKind !== undefined && payload.saveKind !== "autosave" && payload.saveKind !== "publish") return Response.json({ error: "保存类型无效" }, { status: 400 });
  if (payload.version !== current.article.version) return Response.json({ error: "检测到内容冲突", currentVersion: current.article.version, article: editorArticle(current.article) }, { status: 409 });

  const isDelete = payload.action === "delete";
  const isRestore = payload.action === "restore";
  const shouldPublish = !isDelete && (payload.saveKind === "publish" || (isRestore && payload.status === "published"));
  const nextStatus = isDelete ? "deleted" : isRestore ? (payload.status === "published" ? "published" : "draft") : shouldPublish ? "published" : current.article.status;
  const sourceTitle = payload.title === undefined ? current.article.draftTitle ?? current.article.title : payload.title.trim();
  const sourceBody = payload.bodyMarkdown === undefined ? current.article.draftBodyMarkdown ?? current.article.bodyMarkdown : payload.bodyMarkdown;
  const nextTitle = isDelete || isRestore ? (payload.title?.trim() || current.article.title) : sourceTitle;
  const nextBody = isDelete || isRestore ? (payload.bodyMarkdown ?? current.article.bodyMarkdown) : sourceBody;
  if (!nextTitle) return Response.json({ error: "文章标题不能为空" }, { status: 400 });

  const now = new Date().toISOString();
  const nextVersion = current.article.version + 1;
  const firstPublishedAt = shouldPublish ? current.article.firstPublishedAt ?? now : current.article.firstPublishedAt;
  const lastPublishedAt = shouldPublish ? now : current.article.lastPublishedAt;
  const nextSlug = shouldPublish ? payload.slug?.trim() || (payload.title === undefined ? current.article.slug : readableSlug(nextTitle, id.slice(0, 8))) : current.article.slug;
  const update = isDelete
    ? { status: "deleted" as const, deletedAt: now, deletedBy: user.id, draftTitle: null, draftBodyMarkdown: null }
    : isRestore
      ? { title: nextTitle, bodyMarkdown: nextBody, status: nextStatus, firstPublishedAt, lastPublishedAt, deletedAt: null, deletedBy: null, draftTitle: null, draftBodyMarkdown: null }
      : shouldPublish
        ? { slug: nextSlug, title: nextTitle, bodyMarkdown: nextBody, status: "published" as const, firstPublishedAt, lastPublishedAt, draftTitle: null, draftBodyMarkdown: null, deletedAt: null, deletedBy: null }
        : { draftTitle: nextTitle, draftBodyMarkdown: nextBody, status: current.article.status, deletedAt: null, deletedBy: null };
  const db = getDb();
  let updated;
  try {
    [updated] = await db.update(articles).set({ ...update, version: nextVersion, updatedAt: now }).where(and(eq(articles.id, id), eq(articles.version, current.article.version))).returning();
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return Response.json({ error: "文章地址已被占用" }, { status: 409 });
    throw error;
  }
  if (!updated) return Response.json({ error: "检测到内容冲突", currentVersion: current.article.version }, { status: 409 });

  if (shouldPublish && nextSlug !== current.article.slug) {
    try {
      await db.insert(slugHistory).values({ id: crypto.randomUUID(), resourceType: "article", resourceId: id, slug: current.article.slug, createdAt: now });
    } catch (error) {
      if (!(error instanceof Error && error.message.includes("UNIQUE"))) throw error;
    }
  }
  const kind = isDelete ? "delete" : shouldPublish ? "publish" : "autosave";
  await db.insert(articleVersions).values({ id: crypto.randomUUID(), articleId: id, version: nextVersion, title: nextTitle, bodyMarkdown: nextBody, savedBy: user.id, kind, createdAt: now });
  if (kind === "autosave") await trimAutosaves(id);
  if (isDelete || shouldPublish) await refreshColumnLatestPublishedAt(current.article.columnId, now);
  await recordAudit(user.id, kind === "publish" ? "publish_article" : kind === "delete" ? "delete_article" : "autosave_article", "article", id);
  return Response.json({ article: editorArticle(updated) });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const { id } = await context.params;
  const user = await requireArticleEditor(id);
  if (!user) return Response.json({ error: "没有文章编辑权限" }, { status: 403 });
  const current = await findArticle(id);
  if (!current) return Response.json({ error: "文章不存在" }, { status: 404 });
  const now = new Date().toISOString();
  const nextVersion = current.article.version + 1;
  const db = getDb();
  const [article] = await db.update(articles).set({ status: "deleted", deletedAt: now, deletedBy: user.id, draftTitle: null, draftBodyMarkdown: null, version: nextVersion, updatedAt: now }).where(and(eq(articles.id, id), eq(articles.version, current.article.version))).returning({ id: articles.id, status: articles.status, deletedAt: articles.deletedAt, version: articles.version });
  if (!article) return Response.json({ error: "检测到内容冲突" }, { status: 409 });
  await db.insert(articleVersions).values({ id: crypto.randomUUID(), articleId: id, version: nextVersion, title: current.article.title, bodyMarkdown: current.article.bodyMarkdown, savedBy: user.id, kind: "delete", createdAt: now });
  await refreshColumnLatestPublishedAt(current.article.columnId, now);
  await recordAudit(user.id, "delete_article", "article", id);
  return Response.json({ article });
}
