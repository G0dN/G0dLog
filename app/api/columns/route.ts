import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { articles, columnMembers, columns, users } from "../../../db/schema";
import { requireUser } from "../../../lib/server-auth";

function serializeColumn(row: { id: string; slug: string; title: string; description: string; creatorId: string; creatorName: string; createdAt: string; updatedAt: string; latestPublishedAt: string | null; deletedAt: string | null; articleCount: number }) {
  return { ...row, articleCount: Number(row.articleCount) };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const managed = url.searchParams.get("scope") === "managed";
  const includeDeleted = url.searchParams.get("includeDeleted") === "1";
  const db = getDb();

  if (!managed) {
    const rows = await db.select({
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
      .where(isNull(columns.deletedAt))
      .groupBy(columns.id, columns.slug, columns.title, columns.description, columns.creatorId, users.displayName, columns.createdAt, columns.updatedAt, columns.latestPublishedAt, columns.deletedAt)
      .orderBy(desc(columns.latestPublishedAt), desc(columns.createdAt));
    return Response.json({ columns: rows.map(serializeColumn).filter((column) => column.articleCount > 0) });
  }

  const user = await requireUser();
  if (!user) return Response.json({ error: "需要登录" }, { status: 401 });
  const membership = and(eq(columnMembers.userId, user.id), eq(columnMembers.status, "active"));
  const rows = await db.select({
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
    .leftJoin(columnMembers, membership)
    .leftJoin(articles, and(eq(articles.columnId, columns.id), isNull(articles.deletedAt)))
    .where(and(
      includeDeleted ? undefined : isNull(columns.deletedAt),
      user.role === "admin" ? undefined : or(eq(columns.creatorId, user.id), eq(columnMembers.userId, user.id)),
    ))
    .groupBy(columns.id, columns.slug, columns.title, columns.description, columns.creatorId, users.displayName, columns.createdAt, columns.updatedAt, columns.latestPublishedAt, columns.deletedAt)
    .orderBy(desc(columns.updatedAt));
  return Response.json({ columns: rows.map(serializeColumn) });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "需要登录" }, { status: 401 });
  const payload = (await request.json()) as { title?: string; description?: string };
  const title = payload.title?.trim() ?? "";
  if (!title) return Response.json({ error: "专栏标题不能为空" }, { status: 400 });
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const [column] = await getDb().insert(columns).values({
    id,
    slug: `column-${id.slice(0, 8)}`,
    title,
    description: payload.description?.trim() ?? "",
    creatorId: user.id,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return Response.json({ column }, { status: 201 });
}
