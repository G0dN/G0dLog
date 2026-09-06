import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { articleVersions, articles } from "../../../../../db/schema";
import { requireArticleEditor } from "../../../../../lib/server-auth";
import { enforceSameOrigin } from "../../../../../lib/security";
import { recordAudit } from "../../../../../lib/audit";

function editorArticle(article: typeof articles.$inferSelect) {
  return { ...article, title: article.draftTitle ?? article.title, bodyMarkdown: article.draftBodyMarkdown ?? article.bodyMarkdown };
}

async function trimAutosaves(articleId: string) {
  const db = getDb();
  const autosaves = await db.select({ id: articleVersions.id }).from(articleVersions).where(and(eq(articleVersions.articleId, articleId), eq(articleVersions.kind, "autosave"))).orderBy(desc(articleVersions.version));
  for (const oldVersion of autosaves.slice(20)) await db.delete(articleVersions).where(eq(articleVersions.id, oldVersion.id));
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!await requireArticleEditor(id)) return Response.json({ error: "没有文章编辑权限" }, { status: 403 });
  const versions = await getDb().select().from(articleVersions).where(eq(articleVersions.articleId, id)).orderBy(desc(articleVersions.version));
  const permanent = versions.filter((version) => version.kind !== "autosave");
  const autosaves = versions.filter((version) => version.kind === "autosave").slice(0, 20);
  return Response.json({ versions: [...permanent, ...autosaves].sort((a, b) => b.version - a.version) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const { id } = await context.params;
  const user = await requireArticleEditor(id);
  if (!user) return Response.json({ error: "没有文章编辑权限" }, { status: 403 });
  const payload = (await request.json()) as { version?: number; currentVersion?: number };
  if (!Number.isInteger(payload.version) || !Number.isInteger(payload.currentVersion)) return Response.json({ error: "缺少版本号" }, { status: 400 });
  const requestedVersion = payload.version as number;
  const requestedCurrentVersion = payload.currentVersion as number;
  const db = getDb();
  const [source] = await db.select().from(articleVersions).where(and(eq(articleVersions.articleId, id), eq(articleVersions.version, requestedVersion))).limit(1);
  if (!source) return Response.json({ error: "历史版本不存在" }, { status: 404 });
  const [current] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  if (!current) return Response.json({ error: "文章不存在" }, { status: 404 });
  if (current.version !== requestedCurrentVersion) return Response.json({ error: "检测到内容冲突", currentVersion: current.version }, { status: 409 });
  const now = new Date().toISOString();
  const nextVersion = current.version + 1;
  const remainsPublished = current.status === "published" && !current.deletedAt;
  const update = remainsPublished
    ? { draftTitle: source.title, draftBodyMarkdown: source.bodyMarkdown, deletedAt: null, deletedBy: null }
    : { title: source.title, bodyMarkdown: source.bodyMarkdown, status: "draft" as const, draftTitle: null, draftBodyMarkdown: null, deletedAt: null, deletedBy: null };
  const [article] = await db.update(articles).set({ ...update, version: nextVersion, updatedAt: now }).where(and(eq(articles.id, id), eq(articles.version, current.version))).returning();
  if (!article) return Response.json({ error: "检测到内容冲突", currentVersion: current.version }, { status: 409 });
  await db.insert(articleVersions).values({ id: crypto.randomUUID(), articleId: id, version: nextVersion, title: source.title, bodyMarkdown: source.bodyMarkdown, savedBy: user.id, kind: "autosave", createdAt: now });
  await trimAutosaves(id);
  await recordAudit(user.id, "restore_version", "article", id, { version: requestedVersion });
  return Response.json({ article: editorArticle(article) });
}
