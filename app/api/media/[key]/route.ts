import { eq, or } from "drizzle-orm";
import { getDb } from "../../../../db";
import { media } from "../../../../db/schema";
import { deleteMedia, getMedia } from "../../../../lib/media-storage";
import { enforceSameOrigin } from "../../../../lib/security";
import { requireOwner } from "../../../../lib/server-auth";
import { recordAudit } from "../../../../lib/audit";

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!/^[a-f0-9-]+\.(jpg|png|webp|avif|gif)$/i.test(key)) return new Response("Not found", { status: 404 });
  const [record] = await getDb().select({ displayKey: media.displayKey, avifKey: media.avifKey }).from(media).where(or(eq(media.displayKey, key), eq(media.avifKey, key))).limit(1);
  if (!record) return new Response("Not found", { status: 404 });
  const object = await getMedia(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  const displayType = key.endsWith(".webp") ? "image/webp" : key.endsWith(".avif") ? "image/avif" : key.endsWith(".gif") ? "image/gif" : key.endsWith(".png") ? "image/png" : "image/jpeg";
  headers.set("Content-Type", displayType);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body as unknown as BodyInit, { headers });
}

export async function DELETE(request: Request, context: { params: Promise<{ key: string }> }) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const owner = await requireOwner();
  if (!owner) return Response.json({ error: "需要 Owner 权限" }, { status: 403 });
  const { key } = await context.params;
  if (!/^[a-f0-9-]+\.(jpg|png|webp|avif|gif)$/i.test(key)) return Response.json({ error: "媒体不存在" }, { status: 404 });
  const db = getDb();
  const [record] = await db.select({ id: media.id, storageKey: media.storageKey, displayKey: media.displayKey, avifKey: media.avifKey }).from(media).where(or(eq(media.displayKey, key), eq(media.avifKey, key))).limit(1);
  if (!record) return Response.json({ error: "媒体不存在" }, { status: 404 });
  await deleteMedia(record.storageKey);
  if (record.displayKey !== record.storageKey) await deleteMedia(record.displayKey);
  if (record.avifKey) await deleteMedia(record.avifKey);
  await db.delete(media).where(eq(media.id, record.id));
  await recordAudit(owner.id, "purge_media", "media", record.id, { displayKey: record.displayKey });
  return Response.json({ ok: true });
}
