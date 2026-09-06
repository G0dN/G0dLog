import { getPublicArticles, getPublicColumns, getPublicAuthor, articleCanonicalPath, authorCanonicalPath, columnCanonicalPath } from "../../lib/content";
import { siteOrigin } from "../../lib/site-config";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] ?? character);
}

export async function GET(request: Request) {
  const [articles, columns] = await Promise.all([getPublicArticles(), getPublicColumns()]);
  const authorIds = [...new Set(articles.map((article) => article.authorId))];
  const authors = (await Promise.all(authorIds.map((id) => getPublicAuthor(id)))).filter((author): author is NonNullable<Awaited<ReturnType<typeof getPublicAuthor>>> => Boolean(author));
  const origin = siteOrigin(request);
  const urls = [
    `<url><loc>${escapeXml(`${origin}/`)}</loc></url>`,
    ...columns.map((column) => `<url><loc>${escapeXml(`${origin}${columnCanonicalPath(column)}`)}</loc><lastmod>${escapeXml(column.updatedAt)}</lastmod></url>`),
    ...authors.map((author) => `<url><loc>${escapeXml(`${origin}${authorCanonicalPath(author.author)}`)}</loc><lastmod>${escapeXml(author.author.updatedAt)}</lastmod></url>`),
    ...articles.map((article) => `<url><loc>${escapeXml(`${origin}${articleCanonicalPath(article)}`)}</loc><lastmod>${escapeXml(article.lastPublishedAt ?? article.firstPublishedAt ?? "")}</lastmod></url>`),
  ].join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
