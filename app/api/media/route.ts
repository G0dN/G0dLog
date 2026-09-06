import { getDb } from "../../../db";
import { media } from "../../../db/schema";
import { requireUser } from "../../../lib/server-auth";
import { putMedia } from "../../../lib/media-storage";
import { enforceSameOrigin } from "../../../lib/security";
import { recordAudit } from "../../../lib/audit";
import sharp from "sharp";

const MAX_BYTES = 10 * 1024 * 1024;
function detectType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "image/png";
  const header = bytes.length >= 6 ? new TextDecoder().decode(bytes.slice(0, 6)) : "";
  if (header === "GIF87a" || header === "GIF89a") return "image/gif";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

function stripJpegMetadata(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const output = [0xff, 0xd8];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) { output.push(...bytes.slice(offset)); break; }
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) { output.push(...bytes.slice(offset)); break; }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) { output.push(...bytes.slice(offset)); break; }
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xe2;
    if (!drop) output.push(...bytes.slice(offset, offset + 2 + length));
    offset += 2 + length;
  }
  return new Uint8Array(output);
}

async function sanitizeAndMakeDisplay(bytes: Uint8Array, contentType: string, displayId: string) {
  if (contentType === "image/gif") return { original: bytes, display: { data: bytes, key: displayId + ".gif", contentType }, avif: null };
  try {
    const original = await sharp(bytes).rotate().toBuffer();
    const [display, avif] = await Promise.all([
      sharp(original).webp({ quality: 84 }).toBuffer(),
      sharp(original).avif({ quality: 50 }).toBuffer(),
    ]);
    return { original, display: { data: display, key: displayId + ".webp", contentType: "image/webp" }, avif: { data: avif, key: displayId + ".avif", contentType: "image/avif" } };
  } catch {
    if (contentType === "image/jpeg") {
      try {
        const original = stripJpegMetadata(bytes);
        const [display, avif] = await Promise.all([
          sharp(original).webp({ quality: 84 }).toBuffer(),
          sharp(original).avif({ quality: 50 }).toBuffer(),
        ]);
        return { original, display: { data: display, key: displayId + ".webp", contentType: "image/webp" }, avif: { data: avif, key: displayId + ".avif", contentType: "image/avif" } };
      } catch {
        // Fall through to the common invalid-image response.
      }
    }
    return null;
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const user = await requireUser();
  if (!user) return Response.json({ error: "需要登录" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "请选择图片文件" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "图片不能超过 10 MB" }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectType(bytes);
  if (!detected) return Response.json({ error: "文件内容不是支持的图片格式" }, { status: 400 });
  if (file.type && file.type !== detected) return Response.json({ error: "文件类型声明与实际内容不一致" }, { status: 400 });
  const id = crypto.randomUUID();
  const extension = detected === "image/jpeg" ? "jpg" : detected.slice(6);
  const originalKey = id + "-original." + extension;
  const processed = await sanitizeAndMakeDisplay(bytes, detected, id);
  if (!processed) return Response.json({ error: "图片无法解码或生成展示版本" }, { status: 400 });
  if (!await putMedia(originalKey, processed.original) || !await putMedia(processed.display.key, processed.display.data) || (processed.avif && !await putMedia(processed.avif.key, processed.avif.data))) return Response.json({ error: "媒体存储不可用" }, { status: 503 });
  await getDb().insert(media).values({ id, storageKey: originalKey, displayKey: processed.display.key, avifKey: processed.avif?.key ?? null, originalName: file.name.slice(0, 180), contentType: detected, sizeBytes: processed.original.byteLength, uploadedBy: user.id, createdAt: new Date().toISOString() });
  await recordAudit(user.id, "upload_media", "media", id, { contentType: detected, sizeBytes: file.size });
  return Response.json({ id, key: processed.display.key, url: "/api/media/" + processed.display.key, variants: { webpUrl: "/api/media/" + processed.display.key, avifUrl: processed.avif ? "/api/media/" + processed.avif.key : null }, originalUrl: "/api/media/original/" + originalKey }, { status: 201 });
}
