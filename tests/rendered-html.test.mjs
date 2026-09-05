import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the public blog homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="zh-CN"/i);
  assert.match(html, /一页 YiYe Notes/);
  assert.match(html, /公开写作与教程/);
  assert.match(html, /专栏/);
  assert.match(html, /系统与秩序/);
  assert.match(html, /专注的形状/);
  assert.match(html, /搜索文章、专栏或作者/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview|Building your site/);
});

test("core blog surfaces and persistence wiring are present", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  const schema = await readFile(new URL("db/schema.ts", root), "utf8");
  const hosting = await readFile(new URL(".openai/hosting.json", root), "utf8");
  const compose = await readFile(new URL("docker-compose.yml", root), "utf8");
  const columnApi = await readFile(new URL("app/api/columns/[id]/members/route.ts", root), "utf8");
  const authApi = await readFile(new URL("app/api/auth/login/route.ts", root), "utf8");
  const authLib = await readFile(new URL("lib/server-auth.ts", root), "utf8");
  const articleApi = await readFile(new URL("app/api/articles/[id]/route.ts", root), "utf8");

  for (const label of ["搜索结果", "在本专栏中搜索", "文章目录", "版本历史", "检测到内容冲突", "上传图片", "parseMarkdown", "成员与权限", "协作者", "首次登录改密", "新建作者"]) {
    assert.match(page, new RegExp(label));
  }
  for (const selector of ["@media (max-width: 680px)", ".reader-sidebar.open", ".article-body", ".studio-page"]) {
    assert.match(styles, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const table of ["users", "columns", "columnMembers", "articles", "articleVersions", "media"]) {
    assert.match(schema, new RegExp(`export const ${table}`));
  }
  assert.match(hosting, /"d1"\s*:\s*"DB"/);
  assert.match(hosting, /"r2"\s*:\s*"MEDIA"/);
  assert.match(compose, /BLOG_DATA_DIR/);
  assert.match(compose, /BLOG_MEDIA_DIR/);
  for (const label of ["requireColumnManager", "status: \"removed\"", "removedAt", "columnMembers"]) assert.match(columnApi, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const label of ["verifyPassword", "createSession", "mustChangePassword"]) assert.match(authApi, new RegExp(label));
  for (const label of ["hashPassword", "PBKDF2", "SESSION_COOKIE"]) assert.match(authLib, new RegExp(label));
  for (const label of ["检测到内容冲突", "articleVersions", "deletedAt"]) assert.match(articleApi, new RegExp(label));
});
