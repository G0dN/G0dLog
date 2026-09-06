import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

const port = Number(process.env.WEBHOOK_PORT || 8787);
const secret = process.env.G0DLOG_WEBHOOK_SECRET?.trim();
const imageRepository = (process.env.IMAGE_REPOSITORY || "ghcr.io/g0dn/g0dlog").toLowerCase();
const workdir = path.resolve(process.env.DEPLOY_WORKDIR || process.cwd());
const maxBodyBytes = 1024 * 1024;
if (!secret) throw new Error("G0DLOG_WEBHOOK_SECRET is required");

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function verifiedSignature(body, value) {
  if (!value?.startsWith("sha256=")) return false;
  const actual = Buffer.from(value.slice("sha256=".length), "hex");
  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(new Error("request body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/deploy") return send(response, 404, { error: "not found" });
  try {
    const body = await readBody(request);
    if (!verifiedSignature(body, request.headers["x-hub-signature-256"])) return send(response, 401, { error: "invalid signature" });
    const payload = JSON.parse(body.toString("utf8"));
    const ref = typeof payload.ref === "string" ? payload.ref : "";
    if (!/^(?:v)?[0-9]+(?:\.[0-9]+){2}(?:[-+][0-9A-Za-z.-]+)?$/.test(ref)) return send(response, 400, { error: "ref must be a release version" });
    const expectedImage = `${imageRepository}:${ref}`;
    const image = typeof payload.image === "string" && payload.image.trim() ? payload.image.trim().toLowerCase() : expectedImage;
    if (image !== expectedImage) return send(response, 400, { error: "image must match the release version and repository" });
    const script = path.join(workdir, "scripts", "deploy-nas.sh");
    const child = spawn("sh", [script], { cwd: workdir, detached: true, stdio: "ignore", env: { ...process.env, RELEASE_VERSION: ref, GITHUB_REF_NAME: ref, G0DLOG_IMAGE: image } });
    child.unref();
    return send(response, 202, { accepted: true, ref });
  } catch (error) {
    return send(response, 400, { error: error instanceof Error ? error.message : "invalid request" });
  }
});

server.listen(port, "127.0.0.1", () => console.log(`G0dLog release webhook listening on 127.0.0.1:${port}`));
