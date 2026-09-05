/** Cloudflare Worker entry point for 一页 YiYe Notes. */
import handler from "vinext/server/app-router-entry";
import type { RuntimeEnv } from "../lib/runtime-env";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  MEDIA?: R2Bucket;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    globalThis.__YIYE_ENV = env as RuntimeEnv;
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
