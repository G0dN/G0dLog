import assert from "node:assert/strict";
import fs from "node:fs";

// Explicitly targets a deployed instance and creates one acceptance article/image.
// Keep credentials and the resulting state file outside version control.
const [credentialsPath, statePath, mode = "create"] = process.argv.slice(2);
if (!credentialsPath || !statePath) throw new Error("Usage: node scripts/test-nas-lan.mjs <credentials.json> <state.json> [create|verify]");
const { url, username, password } = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
const base = new URL(url).origin;
let cookie = "";
async function request(path, { method = "GET", json, body, authenticated = true } = {}) {
  const headers = { Origin: base };
  if (authenticated && cookie) headers.Cookie = cookie;
  if (json) headers["Content-Type"] = "application/json";
  return fetch(base + path, { method, headers, body: json ? JSON.stringify(json) : body, redirect: "manual", signal: AbortSignal.timeout(20000) });
}
for (const path of ["/", "/api/health", "/rss.xml", "/sitemap.xml", "/robots.txt"]) {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  const content = await response.text();
  if (path === "/") {
    assert.match(content, /G0dLog/);
    for (const pattern of [/\/_next\/static\/[^"'<>]+\.css/, /\/_next\/static\/[^"'<>]+\.js/]) {
      const asset = content.match(pattern)?.[0];
      assert.ok(asset, "Missing static asset");
      assert.equal((await request(asset)).status, 200, asset);
    }
  }
  if (path === "/api/health") assert.equal(JSON.parse(content).ok, true);
  if (["/robots.txt", "/sitemap.xml"].includes(path)) assert.ok(content.includes(base), "Canonical LAN origin");
  console.log("PASS", path);
}
const login = await request("/api/auth/login", { method: "POST", json: { username, password } });
assert.equal(login.status, 200, "Owner login");
cookie = login.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie);
console.log("PASS Owner login");
let state;
if (mode === "create") {
  const form = new FormData();
  form.set("file", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")], { type: "image/png" }), "nas-acceptance.png");
  const upload = await request("/api/media", { method: "POST", body: form });
  assert.equal(upload.status, 201, "Image upload");
  const media = await upload.json();
  const draft = await request("/api/articles", { method: "POST", json: { title: "NAS 局域网部署验收", bodyMarkdown: `数据库与图片已持久化到 NAS。\n\n![验收图片](${media.url})` } });
  assert.equal(draft.status, 201, "Create draft");
  const { article } = await draft.json();
  assert.equal((await request(`/api/articles/${article.id}`, { authenticated: false })).status, 403, "Private draft");
  const publish = await request(`/api/articles/${article.id}`, { method: "PATCH", json: { version: article.version, title: article.title, bodyMarkdown: article.bodyMarkdown, status: "published", saveKind: "publish" } });
  assert.equal(publish.status, 200, "Publish");
  state = { base, article: (await publish.json()).article, media };
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log("PASS create draft, upload image and publish");
} else {
  assert.equal(mode, "verify");
  state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(state.base, base);
}
const articlePath = `/articles/${state.article.id}/${encodeURIComponent(state.article.slug)}`;
const page = await request(articlePath, { authenticated: false });
assert.equal(page.status, 200);
assert.ok((await page.text()).includes("数据库与图片已持久化到 NAS"));
for (const path of [state.media.url, state.media.variants.avifUrl]) {
  assert.ok(path);
  assert.equal((await request(path, { authenticated: false })).status, 200, path);
}
assert.equal((await request(state.media.originalUrl, { authenticated: false })).status, 401);
assert.equal((await request(state.media.originalUrl)).status, 200);
console.log("PASS published article, WebP/AVIF, original image permissions");
console.log("Article:", base + articlePath);
