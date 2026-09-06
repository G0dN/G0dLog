import crypto from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

if (!process.env.BLOG_DATA_DIR?.trim()) throw new Error("BLOG_DATA_DIR is required for deployment audit");
if (!process.env.G0DLOG_IMAGE?.trim()) throw new Error("G0DLOG_IMAGE is required for deployment audit");
const dataDir = path.resolve(process.env.BLOG_DATA_DIR);
const database = new DatabaseSync(path.join(dataDir, "blog.sqlite"));
const metadata = JSON.stringify({ ref: process.env.RELEASE_VERSION || process.env.GITHUB_REF_NAME || null, image: process.env.G0DLOG_IMAGE });
database.prepare("INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, metadata, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), "deploy", "deployment", process.env.GITHUB_SHA || null, metadata, new Date().toISOString());
console.log("Deployment audit record written.");
