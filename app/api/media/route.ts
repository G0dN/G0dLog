import { getDb } from "../../../db";
import { media } from "../../../db/schema";
import { requireUser } from "../../../lib/server-auth";
import { putMedia } from "../../../lib/media-storage";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "需要登录" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "请选择图片文件" }, { status: 400 });
  if (!allowedTypes.has(file.type)) return Response.json({ error: "仅支持 JPG、PNG、WebP 和 GIF" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return Response.json({ error: "图片不能超过 10 MB" }, { status: 413 });
  const id = crypto.randomUUID();
  const key = `${id}.${extensions[file.type]}`;
  if (!await putMedia(key, await file.arrayBuffer(), file.type)) return Response.json({ error: "媒体存储未配置" }, { status: 503 });
  await getDb().insert(media).values({ id, storageKey: key, originalName: file.name.slice(0, 180), contentType: file.type, sizeBytes: file.size, uploadedBy: user.id, createdAt: new Date().toISOString() });
  return Response.json({ id, key, url: `/api/media/${key}` }, { status: 201 });
}
