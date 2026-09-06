import { getPublicAuthor } from "../../../../lib/content";
import { publicAvatarUrl } from "../../../../lib/site-config";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const author = await getPublicAuthor(id, new URL(request.url).searchParams.get("slug") ?? undefined);
  if (!author) return Response.json({ error: "作者不存在" }, { status: 404 });
  return Response.json({ author: { id: author.author.id, slug: author.author.slug, displayName: author.author.displayName, avatarUrl: publicAvatarUrl(author.author.avatarUrl), signature: author.author.signature }, articles: author.articles });
}
