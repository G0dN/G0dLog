import { and, asc, count, desc, eq, isNull, like, or } from "drizzle-orm";
import { getDb } from "../db";
import { articles, columns, slugHistory, users } from "../db/schema";

export async function getPublicColumns() {
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
    .where(isNull(columns.deletedAt))
    .groupBy(columns.id, columns.slug, columns.title, columns.description, columns.creatorId, users.displayName, columns.createdAt, columns.updatedAt, columns.latestPublishedAt, columns.deletedAt)
    .orderBy(desc(columns.latestPublishedAt), desc(columns.createdAt));
  return rows.filter((row) => Number(row.articleCount) > 0).map((row) => ({ ...row, articleCount: Number(row.articleCount) }));
}

export async function getPublicArticles(options: { columnId?: string; query?: string } = {}) {
  const query = options.query?.trim();
  const conditions = [eq(articles.status, "published"), isNull(articles.deletedAt), isNull(columns.deletedAt)];
  if (options.columnId) conditions.push(eq(articles.columnId, options.columnId));
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(or(like(articles.title, pattern), like(articles.bodyMarkdown, pattern), like(users.displayName, pattern), like(columns.title, pattern))!);
  }
  const rows = await getDb().select({
    id: articles.id,
    slug: articles.slug,
    columnId: articles.columnId,
    columnSlug: columns.slug,
    columnTitle: columns.title,
    authorId: articles.authorId,
    authorSlug: users.slug,
    authorName: users.displayName,
    title: articles.title,
    bodyMarkdown: articles.bodyMarkdown,
    firstPublishedAt: articles.firstPublishedAt,
    lastPublishedAt: articles.lastPublishedAt,
    sortOrder: articles.sortOrder,
    status: articles.status,
    version: articles.version,
  }).from(articles)
    .innerJoin(columns, eq(articles.columnId, columns.id))
    .innerJoin(users, eq(articles.authorId, users.id))
    .where(and(...conditions))
    .orderBy(...(options.columnId ? [asc(articles.sortOrder), asc(articles.firstPublishedAt), desc(articles.lastPublishedAt)] : [desc(articles.firstPublishedAt), desc(articles.lastPublishedAt)]));
  return rows;
}

async function publicLocator(resourceType: "article" | "column" | "author", id: string, slug?: string) {
  const normalizedSlug = slug ? decodeSlug(slug) : undefined;
  if (!normalizedSlug) return { current: true };
  const [history] = await getDb().select({ resourceId: slugHistory.resourceId }).from(slugHistory).where(and(eq(slugHistory.resourceType, resourceType), eq(slugHistory.resourceId, id), eq(slugHistory.slug, normalizedSlug))).limit(1);
  return history ? { current: false } : { current: true };
}

function decodeSlug(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export async function getPublicArticle(id: string, requestedSlug?: string) {
  const rows = await getDb().select({ article: articles, column: columns, author: users }).from(articles)
    .innerJoin(columns, eq(articles.columnId, columns.id))
    .innerJoin(users, eq(articles.authorId, users.id))
    .where(and(eq(articles.id, id), eq(articles.status, "published"), isNull(articles.deletedAt), isNull(columns.deletedAt))).limit(1);
  const row = rows[0];
  if (!row) return null;
  const normalizedSlug = requestedSlug ? decodeSlug(requestedSlug) : undefined;
  const locator = await publicLocator("article", id, normalizedSlug);
  if (normalizedSlug && normalizedSlug !== row.article.slug && locator.current) return null;
  return { ...row, legacySlug: Boolean(normalizedSlug && normalizedSlug !== row.article.slug) };
}

export async function getPublicColumn(id: string, requestedSlug?: string) {
  const rows = await getDb().select({ column: columns, creator: users }).from(columns)
    .innerJoin(users, eq(columns.creatorId, users.id))
    .where(and(eq(columns.id, id), isNull(columns.deletedAt))).limit(1);
  const row = rows[0];
  if (!row) return null;
  const publicArticles = await getPublicArticles({ columnId: id });
  if (!publicArticles.length) return null;
  const normalizedSlug = requestedSlug ? decodeSlug(requestedSlug) : undefined;
  const locator = await publicLocator("column", id, normalizedSlug);
  if (normalizedSlug && normalizedSlug !== row.column.slug && locator.current) return null;
  return { ...row, articles: publicArticles, legacySlug: Boolean(normalizedSlug && normalizedSlug !== row.column.slug) };
}

export async function getPublicAuthor(id: string, requestedSlug?: string) {
  const rows = await getDb().select({ author: users }).from(users).where(eq(users.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const publicArticles = await getPublicArticles();
  const authorArticles = publicArticles.filter((article) => article.authorId === id);
  if (!authorArticles.length) return null;
  const normalizedSlug = requestedSlug ? decodeSlug(requestedSlug) : undefined;
  const locator = await publicLocator("author", id, normalizedSlug);
  if (normalizedSlug && normalizedSlug !== row.author.slug && locator.current) return null;
  return { ...row, articles: authorArticles, legacySlug: Boolean(normalizedSlug && normalizedSlug !== row.author.slug) };
}

export function articleCanonicalPath(article: { id: string; slug: string }) {
  return `/articles/${encodeURIComponent(article.id)}/${encodeURIComponent(article.slug)}`;
}

export function columnCanonicalPath(column: { id: string; slug: string }) {
  return `/columns/${encodeURIComponent(column.id)}/${encodeURIComponent(column.slug)}`;
}

export function authorCanonicalPath(author: { id: string; slug: string }) {
  return `/authors/${encodeURIComponent(author.id)}/${encodeURIComponent(author.slug)}`;
}
