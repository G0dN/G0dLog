import { getRuntimeEnv } from "./runtime-env";

type LocalFs = {
  mkdirSync(path: string, options: { recursive: boolean }): void;
  writeFileSync(path: string, data: Uint8Array): void;
  readFileSync(path: string): Uint8Array;
  existsSync(path: string): boolean;
};

type LocalPath = {
  resolve(...parts: string[]): string;
  join(...parts: string[]): string;
};

function getLocalMedia() {
  if (typeof process === "undefined") return null;
  const getBuiltinModule = (process as unknown as { getBuiltinModule?: (name: string) => unknown }).getBuiltinModule;
  if (!getBuiltinModule) return null;
  const fs = getBuiltinModule("node:fs") as LocalFs;
  const path = getBuiltinModule("node:path") as LocalPath;
  const directory = path.resolve(process.env.BLOG_MEDIA_DIR ?? ".media");
  fs.mkdirSync(directory, { recursive: true });
  return { fs, path, directory };
}

export async function putMedia(key: string, data: ArrayBuffer, contentType: string) {
  const bucket = getRuntimeEnv().MEDIA;
  if (bucket) {
    await bucket.put(key, data, { httpMetadata: { contentType } });
    return true;
  }
  const local = getLocalMedia();
  if (!local) return false;
  local.fs.writeFileSync(local.path.join(local.directory, key), new Uint8Array(data));
  return true;
}

export async function getMedia(key: string) {
  const bucket = getRuntimeEnv().MEDIA;
  if (bucket) {
    const object = await bucket.get(key);
    return object ? { body: object.body, writeHttpMetadata: (headers: Headers) => object.writeHttpMetadata(headers) } : null;
  }
  const local = getLocalMedia();
  if (!local) return null;
  const path = local.path.join(local.directory, key);
  if (!local.fs.existsSync(path)) return null;
  return { body: local.fs.readFileSync(path), writeHttpMetadata: (headers: Headers) => headers.set("Content-Type", `image/${key.split(".").pop() ?? "png"}`) };
}
