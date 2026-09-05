import { getMedia } from "../../../../lib/media-storage";

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!/^[a-f0-9-]+\.(jpg|png|webp|gif)$/i.test(key)) return new Response("Not found", { status: 404 });
  const object = await getMedia(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body as unknown as BodyInit, { headers });
}
