import { siteOrigin } from "../../lib/site-config";

export function GET(request: Request) {
  const origin = siteOrigin(request);
  return new Response(`User-agent: *\nAllow: /\nDisallow: /studio\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
