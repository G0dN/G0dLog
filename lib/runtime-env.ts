export type RuntimeEnv = {
  DB?: D1Database;
  MEDIA?: R2Bucket;
};

declare global {
  // The Worker entry point populates this before dispatching a request. Keeping the
  // binding behind a global also lets the Node production preview load public APIs.
  var __YIYE_ENV: RuntimeEnv | undefined;
}

export function getRuntimeEnv() {
  return globalThis.__YIYE_ENV ?? {};
}
