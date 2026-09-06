import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { media } from "../../../../../db/schema";
import { requireUser } from "../../../../../lib/server-auth";
import { getMedia } from "../../../../../lib/media-storage";

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { key } = await context.params;
  if (!/^[a-f0-9-]+-original\.(jpg|png|webp|gif)$/i.test(key)) return new Response("Not found", { status: 404 });
  const [record] = await getDb().select({ storageKey: media.storageKey, contentType: media.contentType }).from(media).where(eq(media.storageKey, key)).limit(1);
  if (!record) return new Response("Not found", { status: 404 });
  const object = await getMedia(record.storageKey);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", record.contentType);
  headers.set("Cache-Control", "private, no-store");
  return new Response(object.body as unknown as BodyInit, { headers });
}
