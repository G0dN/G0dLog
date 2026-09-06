import { getPublicArticles } from "../../lib/content";
import { siteOrigin } from "../../lib/site-config";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] ?? character);
}

function publicText(value: string) {
  return value.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[邮箱已隐藏]").replace(/\s+/g, " ").trim();
}

export async function GET(request: Request) {
  const articles = await getPublicArticles();
  const origin = siteOrigin(request);
  const items = articles.slice(0, 100).map((article) => {
    const url = `${origin}/articles/${encodeURIComponent(article.id)}/${encodeURIComponent(article.slug)}`;
    const description = publicText(article.bodyMarkdown).slice(0, 280);
    return `<item><title>${escapeXml(article.title)}</title><link>${escapeXml(url)}</link><guid isPermaLink="true">${escapeXml(url)}</guid><description>${escapeXml(description)}</description><author>${escapeXml(article.authorName ?? "")}</author><pubDate>${new Date(article.lastPublishedAt ?? article.firstPublishedAt ?? Date.now()).toUTCString()}</pubDate></item>`;
  }).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml("G0dLog")}</title><link>${escapeXml(origin)}</link><description>${escapeXml("站主与受邀作者的公开写作空间。")}</description>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
