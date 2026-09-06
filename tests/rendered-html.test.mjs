import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";

const root = new URL("../", import.meta.url);
let server;
let baseUrl;
const testDataDir = `.test-data-${process.pid}`;
const testMediaDir = `.test-media-${process.pid}`;
const testBackupDir = `.test-backups-${process.pid}`;
const testExportDir = `.test-export-${process.pid}`;
const testRestoreDataDir = `.test-restore-data-${process.pid}`;
const testRestoreMediaDir = `.test-restore-media-${process.pid}`;

async function waitForServer(url) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.status === 200) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Next server did not start");
}

test.before(async () => {
  await rm(testDataDir, { recursive: true, force: true });
  await rm(testMediaDir, { recursive: true, force: true });
  await rm(testBackupDir, { recursive: true, force: true });
  await rm(testExportDir, { recursive: true, force: true });
  await rm(testRestoreDataDir, { recursive: true, force: true });
  await rm(testRestoreMediaDir, { recursive: true, force: true });
  const port = 3100 + (process.pid % 500);
  baseUrl = `http://127.0.0.1:${port}`;
  const testEnv = { ...process.env, BLOG_DATA_DIR: fileURLToPath(new URL(`./${testDataDir}/`, root)), BLOG_MEDIA_DIR: fileURLToPath(new URL(`./${testMediaDir}/`, root)), BLOG_BACKUP_DIR: fileURLToPath(new URL(`./${testBackupDir}/`, root)) };
  execFileSync(process.execPath, ["scripts/bootstrap-owner.mjs", "owner", "站主", "Strong-Owner9!Pass"], { env: testEnv, stdio: "ignore" });
  server = spawn(process.execPath, [".next/standalone/server.js"], { cwd: process.cwd(), env: { ...testEnv, HOSTNAME: "127.0.0.1", PORT: String(port), PUBLIC_SITE_URL: baseUrl }, stdio: "ignore" });
  await waitForServer(baseUrl);
});

test.after(async () => {
  server?.kill();
  await new Promise((resolve) => setTimeout(resolve, 100));
  await rm(testDataDir, { recursive: true, force: true }).catch(() => undefined);
  await rm(testMediaDir, { recursive: true, force: true }).catch(() => undefined);
  await rm(testBackupDir, { recursive: true, force: true }).catch(() => undefined);
  await rm(testExportDir, { recursive: true, force: true }).catch(() => undefined);
  await rm(testRestoreDataDir, { recursive: true, force: true }).catch(() => undefined);
  await rm(testRestoreMediaDir, { recursive: true, force: true }).catch(() => undefined);
});

async function api(path, options = {}, cookie = "") {
  const headers = new Headers(options.headers);
  headers.set("origin", baseUrl);
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers, redirect: "manual" });
  const setCookie = response.headers.get("set-cookie");
  const nextCookie = setCookie?.split(";")[0] || cookie;
  return { response, cookie: nextCookie };
}

async function json(response) {
  return response.json();
}

test("server-renders the public G0dLog homepage", async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html[^>]*lang="zh-CN"/i);
  assert.match(html, /G0dLog/);
  assert.match(html, /公开写作与教程/);
  assert.match(html, /搜索文章、专栏或作者/);
  assert.match(html, /GitHub 项目/);
  assert.doesNotMatch(html, /YiYe|Your site is taking shape|codex-preview/);
  const cssPath = html.match(/\/_next\/static\/(?:css|chunks)\/[^"']+\.css/)?.[0];
  const jsPath = html.match(/\/_next\/static\/chunks\/[^"']+\.js/)?.[0];
  assert.ok(cssPath, "standalone HTML should reference a CSS asset");
  assert.ok(jsPath, "standalone HTML should reference a JavaScript asset");
  const css = await fetch(`${baseUrl}${cssPath}`);
  const js = await fetch(`${baseUrl}${jsPath}`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get("content-type") ?? "", /text\/css/);
  assert.equal(js.status, 200);
});

test("public metadata endpoints and health check are available", async () => {
  const [health, robots, rss, sitemap] = await Promise.all(["/api/health", "/robots.txt", "/rss.xml", "/sitemap.xml"].map((path) => fetch(`${baseUrl}${path}`)));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, service: "g0dlog" });
  assert.match(await robots.text(), /Sitemap: http:\/\/127\.0\.0\.1/);
  assert.match(await rss.text(), /<rss version="2\.0">/);
  assert.match(await sitemap.text(), /urlset/);
});

test("SQLite workflow enforces roles, versions, stable URLs and private originals", async () => {
  const ownerLogin = await api("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "owner", password: "Strong-Owner9!Pass" }) });
  assert.equal(ownerLogin.response.status, 200);
  const ownerCookie = ownerLogin.cookie;
  const authorOne = await api("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "author-one", displayName: "作者一", password: "Author-One9!Pass" }) }, ownerCookie);
  const authorTwo = await api("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "author-two", displayName: "作者二", password: "Author-Two9!Pass" }) }, ownerCookie);
  assert.equal(authorOne.response.status, 201);
  assert.equal(authorTwo.response.status, 201);
  const authorOneRecord = (await json(authorOne.response)).user;
  const authorTwoRecord = (await json(authorTwo.response)).user;

  const authorOneLogin = await api("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "author-one", password: "Author-One9!Pass" }) });
  const authorTwoLogin = await api("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "author-two", password: "Author-Two9!Pass" }) });
  assert.equal(authorOneLogin.response.status, 200);
  assert.equal(authorTwoLogin.response.status, 200);
  const blockedBeforePasswordChange = await api("/api/columns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "不应创建", description: "首次改密前禁止" }) }, authorOneLogin.cookie);
  assert.equal(blockedBeforePasswordChange.response.status, 401);
  const authorOnePassword = await api("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: "Author-One9!Pass", newPassword: "Author-One9!Changed" }) }, authorOneLogin.cookie);
  const authorTwoPassword = await api("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: "Author-Two9!Pass", newPassword: "Author-Two9!Changed" }) }, authorTwoLogin.cookie);
  assert.equal(authorOnePassword.response.status, 200);
  assert.equal(authorTwoPassword.response.status, 200);
  let authorOneCookie = authorOnePassword.cookie;
  let authorTwoCookie = authorTwoPassword.cookie;
  const createdColumn = await api("/api/columns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "权限专栏", description: "测试" }) }, authorOneCookie);
  assert.equal(createdColumn.response.status, 201);
  const column = (await json(createdColumn.response)).column;
  const invite = await api(`/api/columns/${column.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: authorTwoRecord.id }) }, authorOneCookie);
  assert.equal(invite.response.status, 201);
  const firstArticleResponse = await api("/api/articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ columnId: column.id, title: "权限文章", bodyMarkdown: "正文" }) }, authorOneCookie);
  assert.equal(firstArticleResponse.response.status, 201);
  const firstArticle = (await json(firstArticleResponse.response)).article;
  const forbidden = await api(`/api/articles/${firstArticle.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: firstArticle.version, title: "越权修改" }) }, authorTwoCookie);
  assert.equal(forbidden.response.status, 403);
  const secondArticleResponse = await api("/api/articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ columnId: column.id, title: "公开文章", bodyMarkdown: "可公开内容" }) }, authorTwoCookie);
  const secondArticle = (await json(secondArticleResponse.response)).article;
  const published = await api(`/api/articles/${secondArticle.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: secondArticle.version, title: secondArticle.title, bodyMarkdown: secondArticle.bodyMarkdown, saveKind: "publish", status: "published" }) }, authorTwoCookie);
  assert.equal(published.response.status, 200);
  const publishedArticle = (await json(published.response)).article;
  const publishVersions = await api(`/api/articles/${publishedArticle.id}/versions`, {}, ownerCookie);
  assert.equal(publishVersions.response.status, 200);
  assert.ok((await json(publishVersions.response)).versions.some((version) => version.kind === "publish"));
  const publicArticleHtml = await fetch(`${baseUrl}/articles/${encodeURIComponent(publishedArticle.id)}/${encodeURIComponent(publishedArticle.slug)}`);
  assert.equal(publicArticleHtml.status, 200);
  assert.match(await publicArticleHtml.text(), /可公开内容/);
  let autosaveArticle = publishedArticle;
  const publishedAt = publishedArticle.lastPublishedAt;
  for (let index = 0; index < 23; index += 1) {
    const autosave = await api(`/api/articles/${autosaveArticle.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: autosaveArticle.version, title: "未发布编辑", bodyMarkdown: `未发布草稿 ${index}` }) }, authorTwoCookie);
    assert.equal(autosave.response.status, 200);
    autosaveArticle = (await json(autosave.response)).article;
  }
  const autosaveHistory = await api(`/api/articles/${autosaveArticle.id}/versions`, {}, ownerCookie);
  const autosaveVersions = (await json(autosaveHistory.response)).versions.filter((version) => version.kind === "autosave");
  assert.equal(autosaveVersions.length, 20);
  assert.equal((await (await fetch(`${baseUrl}/articles/${encodeURIComponent(autosaveArticle.id)}/${encodeURIComponent(autosaveArticle.slug)}`)).text()).includes("可公开内容"), true);
  assert.equal(autosaveArticle.lastPublishedAt, publishedAt);
  const publicApiArticle = await api(`/api/articles/${encodeURIComponent(autosaveArticle.id)}`);
  assert.equal(publicApiArticle.response.status, 200);
  const publicApiPayload = await json(publicApiArticle.response);
  assert.equal(publicApiPayload.article.title, "公开文章");
  assert.equal(publicApiPayload.article.bodyMarkdown, "可公开内容");
  assert.equal("draftBodyMarkdown" in publicApiPayload.article, false);
  const publishDraft = await api(`/api/articles/${autosaveArticle.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: autosaveArticle.version, title: autosaveArticle.title, bodyMarkdown: autosaveArticle.bodyMarkdown, saveKind: "publish", status: "published" }) }, authorTwoCookie);
  assert.equal(publishDraft.response.status, 200);
  const publishedDraft = (await json(publishDraft.response)).article;
  assert.equal((await (await fetch(`${baseUrl}/articles/${encodeURIComponent(publishedDraft.id)}/${encodeURIComponent(publishedDraft.slug)}`)).text()).includes("未发布草稿 22"), true);
  const removed = await api(`/api/columns/${column.id}/members`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: authorTwoRecord.id }) }, authorOneCookie);
  assert.equal(removed.response.status, 200);
  const removedAuthorEdit = await api(`/api/articles/${publishedArticle.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: publishedArticle.version, title: "不应成功" }) }, authorTwoCookie);
  assert.equal(removedAuthorEdit.response.status, 403);
  const publicSearch = await api("/api/articles?q=未发布草稿");
  assert.equal(publicSearch.response.status, 200);
  assert.equal((await json(publicSearch.response)).articles.length, 1);
  const publicAuthor = await api(`/api/authors/${authorTwoRecord.id}`);
  assert.equal(publicAuthor.response.status, 200);
  const publicAuthorPayload = await json(publicAuthor.response);
  assert.equal(publicAuthorPayload.author.displayName, "作者二");
  assert.equal(publicAuthorPayload.articles[0].id, publishedArticle.id);
  assert.equal("passwordHash" in publicAuthorPayload, false);
  const publicAuthorHtml = await fetch(`${baseUrl}/authors/${encodeURIComponent(authorTwoRecord.id)}/${encodeURIComponent(authorTwoRecord.slug)}`);
  assert.equal(publicAuthorHtml.status, 200);
  assert.match(await publicAuthorHtml.text(), /作者二/);
  const disabled = await api(`/api/admin/users/${authorTwoRecord.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "disable" }) }, ownerCookie);
  assert.equal(disabled.response.status, 200);
  const disabledLogin = await api("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "author-two", password: "Author-Two9!Changed" }) });
  assert.equal(disabledLogin.response.status, 401);
  assert.equal((await json((await api("/api/articles?q=未发布草稿")).response)).articles.length, 1);
  const enabled = await api(`/api/admin/users/${authorTwoRecord.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "enable" }) }, ownerCookie);
  assert.equal(enabled.response.status, 200);

  const deleted = await api(`/api/articles/${publishedArticle.id}`, { method: "DELETE" }, ownerCookie);
  assert.equal(deleted.response.status, 200);
  const deletedArticle = (await json(deleted.response)).article;
  const deleteVersions = await api(`/api/articles/${publishedArticle.id}/versions`, {}, ownerCookie);
  assert.ok((await json(deleteVersions.response)).versions.some((version) => version.kind === "delete"));
  assert.equal((await json((await api("/api/articles")).response)).articles.some((article) => article.id === publishedArticle.id), false);
  const restored = await api(`/api/articles/${publishedArticle.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: deletedArticle.version, action: "restore", status: "published" }) }, ownerCookie);
  assert.equal(restored.response.status, 200);
  const restoredArticle = (await json(restored.response)).article;
  const richUpdate = await api(`/api/articles/${restoredArticle.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: restoredArticle.version, title: "公式与代码文章", bodyMarkdown: "<script>alert(1)</script>\n\n$ x $\n\n$$\nx^2\n$$\n\n```js\nconst answer = 42\n```", status: "published", saveKind: "publish" }) }, ownerCookie);
  assert.equal(richUpdate.response.status, 200);
  const richArticle = (await json(richUpdate.response)).article;
  const richHtml = await fetch(`${baseUrl}/articles/${encodeURIComponent(richArticle.id)}/${encodeURIComponent(richArticle.slug)}`);
  const richText = await richHtml.text();
  assert.doesNotMatch(richText, /<script>alert\(1\)<\/script>/);
  assert.match(richText, /katex/);
  assert.match(richText, /hljs-keyword/);
  const conflict = await api(`/api/articles/${richArticle.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: restoredArticle.version, title: "并发冲突" }) }, ownerCookie);
  assert.equal(conflict.response.status, 409);
  const renamed = await api(`/api/articles/${richArticle.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: richArticle.version, title: "稳定地址文章", bodyMarkdown: richArticle.bodyMarkdown, status: "published", saveKind: "publish" }) }, ownerCookie);
  const renamedArticle = (await json(renamed.response)).article;
  const oldUrl = await fetch(`${baseUrl}/articles/${encodeURIComponent(renamedArticle.id)}/${encodeURIComponent(restoredArticle.slug)}`, { redirect: "manual" });
  assert.equal(oldUrl.status, 307);
  assert.match(decodeURIComponent(oldUrl.headers.get("location") || ""), new RegExp(renamedArticle.slug));

  const form = new FormData();
  const validPng = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  form.set("file", new Blob([validPng], { type: "image/png" }), "tiny.png");
  const upload = await api("/api/media", { method: "POST", body: form }, ownerCookie);
  assert.equal(upload.response.status, 201);
  const uploaded = await json(upload.response);
  assert.match(uploaded.key, /\.webp$/);
  assert.match(uploaded.variants?.avifUrl ?? "", /\.avif$/);
  assert.equal((await fetch(`${baseUrl}${uploaded.url}`)).status, 200);
  assert.equal((await fetch(`${baseUrl}${uploaded.variants.avifUrl}`)).status, 200);
  assert.equal((await fetch(`${baseUrl}${uploaded.originalUrl}`)).status, 401);
  const exportEnv = { ...process.env, BLOG_DATA_DIR: testDataDir, BLOG_MEDIA_DIR: testMediaDir };
  execFileSync(process.execPath, ["scripts/export.mjs", testExportDir], { env: exportEnv, stdio: "ignore" });
  execFileSync(process.execPath, ["scripts/import.mjs", testExportDir, testRestoreDataDir], { env: { ...exportEnv, BLOG_MEDIA_DIR: testRestoreMediaDir }, stdio: "ignore" });
  execFileSync(process.execPath, ["scripts/verify-restore.mjs", testRestoreDataDir, testRestoreMediaDir], { env: exportEnv, stdio: "ignore" });
  assert.equal((await api(uploaded.url, { method: "DELETE" }, ownerCookie)).response.status, 200);
  assert.equal(authorOneRecord.role, "author");
});

test("core schema, permissions, deployment and editor surfaces are present", async () => {
  const files = {
    page: await readFile(new URL("app/page.tsx", root), "utf8"),
    styles: await readFile(new URL("app/globals.css", root), "utf8"),
    schema: await readFile(new URL("db/schema.ts", root), "utf8"),
    compose: await readFile(new URL("docker-compose.yml", root), "utf8"),
    columnApi: await readFile(new URL("app/api/columns/[id]/members/route.ts", root), "utf8"),
    authApi: await readFile(new URL("app/api/auth/login/route.ts", root), "utf8"),
    authLib: await readFile(new URL("lib/server-auth.ts", root), "utf8"),
    articleApi: await readFile(new URL("app/api/articles/[id]/route.ts", root), "utf8"),
    mediaApi: await readFile(new URL("app/api/media/route.ts", root), "utf8"),
    standalone: await readFile(new URL("scripts/prepare-standalone.mjs", root), "utf8"),
    deploy: await readFile(new URL("scripts/deploy-nas.sh", root), "utf8"),
    webhook: await readFile(new URL("scripts/release-webhook.mjs", root), "utf8"),
    workflow: await readFile(new URL(".github/workflows/release.yml", root), "utf8"),
    config: await readFile(new URL("scripts/validate-production-config.mjs", root), "utf8"),
    backup: await readFile(new URL("scripts/backup.sh", root), "utf8"),
    layout: await readFile(new URL("app/layout.tsx", root), "utf8"),
    siteConfig: await readFile(new URL("lib/site-config.ts", root), "utf8"),
    package: JSON.parse(await readFile(new URL("package.json", root), "utf8")),
  };
  for (const label of ["搜索结果", "在本专栏中搜索", "文章目录", "版本历史", "检测到内容冲突", "上传图片", "parseMarkdown", "成员与权限", "协作者", "新建作者"]) assert.match(files.page, new RegExp(label));
  for (const selector of ["@media (max-width: 680px)", ".reader-sidebar.open", ".article-body", ".studio-page"]) assert.match(files.styles, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const table of ["users", "columns", "columnMembers", "articles", "articleVersions", "media", "slugHistory", "auditLogs"]) assert.match(files.schema, new RegExp(`export const ${table}`));
  for (const label of ["requireColumnManager", "status: \"removed\"", "removedAt", "columnMembers"]) assert.match(files.columnApi, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const label of ["verifyPassword", "createSession", "mustChangePassword"]) assert.match(files.authApi, new RegExp(label));
  for (const label of ["hashPassword", "PBKDF2", "SESSION_COOKIE"]) assert.match(files.authLib, new RegExp(label));
  for (const label of ["检测到内容冲突", "articleVersions", "deletedAt"]) assert.match(files.articleApi, new RegExp(label));
  for (const label of ["detectType", "10 * 1024 * 1024", "stripJpegMetadata", "avif", "avifKey"]) assert.match(files.mediaApi, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(files.compose, /BLOG_DATA_DIR/);
  assert.match(files.compose, /BLOG_MEDIA_DIR/);
  assert.match(files.compose, /\$\{G0DLOG_IMAGE:\?/);
  assert.match(files.compose, /healthcheck/);
  assert.match(files.standalone, /\.next\/static/);
  assert.match(files.standalone, /public/);
  assert.match(files.deploy, /RELEASE_VERSION/);
  assert.match(files.deploy, /docker compose[^\n]+pull/);
  assert.match(files.deploy, /--no-build/);
  assert.match(files.webhook, /X-Hub-Signature-256|x-hub-signature-256/);
  assert.match(files.workflow, /push: true/);
  assert.match(files.workflow, /docker\/login-action/);
  assert.match(files.workflow, /NAS_DEPLOY_WEBHOOK_SECRET/);
  assert.match(files.config, /PUBLIC_SITE_URL/);
  assert.match(files.config, /Missing required production configuration/);
  assert.match(files.backup, /BLOG_DATA_DIR:\?/);
  assert.doesNotMatch(files.layout, /localhost:3000/);
  assert.doesNotMatch(files.siteConfig, /localhost:3000/);
  assert.match(files.package.scripts.start, /validate-production-config/);
});
