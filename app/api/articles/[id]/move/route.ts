import { eq } from "drizzle-orm";
import { getDb, withLocalTransaction } from "../../../../../db";
import { articles } from "../../../../../db/schema";
import { requireUser } from "../../../../../lib/server-auth";
import { enforceSameOrigin } from "../../../../../lib/security";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const user = await requireUser();
  if (!user) return Response.json({ error: "需要登录" }, { status: 401 });
  const { id } = await context.params;
  const payload = await request.json() as { columnId?: string; version?: number };
  if (!payload.columnId || !Number.isInteger(payload.version)) return Response.json({ error: "请选择目标专栏并提供文章版本号" }, { status: 400 });
  const result = withLocalTransaction((database) => {
    const current = database.prepare("SELECT a.*, c.creator_id AS creatorId, c.deleted_at AS columnDeleted FROM articles a JOIN columns c ON c.id=a.column_id WHERE a.id=?").get(id) as { column_id: string; creatorId: string; columnDeleted: string | null; deleted_at: string | null; status: string; version: number } | undefined;
    if (!current) return { error: "文章不存在", status: 404 };
    if (user.role !== "owner" && current.creatorId !== user.id) return { error: "只有来源专栏管理员可以移动文章", status: 403 };
    if (current.deleted_at || current.status === "deleted" || current.columnDeleted) return { error: "请先恢复文章及所属专栏", status: 409 };
    if (current.version !== payload.version) return { error: "文章已更新，请加载最新版本后重试", status: 409 };
    const target = database.prepare("SELECT creator_id FROM columns WHERE id=? AND deleted_at IS NULL").get(payload.columnId) as { creator_id: string } | undefined;
    if (!target) return { error: "目标专栏不存在或已删除", status: 404 };
    const member = database.prepare("SELECT 1 FROM column_members WHERE column_id=? AND user_id=? AND status='active'").get(payload.columnId, user.id);
    if (user.role !== "owner" && target.creator_id !== user.id && !member) return { error: "没有目标专栏的写作权限", status: 403 };
    if (current.column_id === payload.columnId) return { error: "请选择其他专栏", status: 400 };
    const now = new Date().toISOString();
    database.prepare("UPDATE articles SET column_id=?, sort_order=(SELECT COALESCE(MAX(sort_order),-1)+1 FROM articles WHERE column_id=? AND deleted_at IS NULL AND status<>'deleted'), version=version+1, updated_at=? WHERE id=? AND version=?").run(payload.columnId, payload.columnId, now, id, payload.version);
    for (const columnId of [current.column_id, payload.columnId]) database.prepare("UPDATE columns SET latest_published_at=(SELECT MAX(last_published_at) FROM articles WHERE column_id=? AND status='published' AND deleted_at IS NULL), updated_at=? WHERE id=?").run(columnId, now, columnId);
    database.prepare("INSERT INTO audit_logs (id,actor_id,action,resource_type,resource_id,metadata,created_at) VALUES (?,?,?,?,?,?,?)").run(crypto.randomUUID(), user.id, "move_article", "article", id, JSON.stringify({ fromColumnId: current.column_id, toColumnId: payload.columnId }), now);
    return null;
  });
  if (result) return Response.json({ error: result.error }, { status: result.status });
  const [article] = await getDb().select().from(articles).where(eq(articles.id, id)).limit(1);
  return Response.json({ article: { ...article, title: article.draftTitle ?? article.title, bodyMarkdown: article.draftBodyMarkdown ?? article.bodyMarkdown } });
}
