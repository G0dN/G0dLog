import path from "node:path";

if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") process.exit(0);

const required = ["PUBLIC_SITE_URL", "BLOG_DATA_DIR", "BLOG_MEDIA_DIR", "BLOG_BACKUP_DIR"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(", ")}`);

let siteUrl;
try {
  siteUrl = new URL(process.env.PUBLIC_SITE_URL);
} catch {
  throw new Error("PUBLIC_SITE_URL must be a valid absolute URL");
}
const localOverride = process.env.ALLOW_INSECURE_LOCAL === "1" && ["localhost", "127.0.0.1", "::1"].includes(siteUrl.hostname);
const octets = siteUrl.hostname.split(".").map(Number);
const privateIPv4 = octets.length === 4 && octets.every((value) => Number.isInteger(value) && value >= 0 && value <= 255) &&
  (octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168));
const lanOverride = process.env.ALLOW_INSECURE_LAN === "1" && privateIPv4 && siteUrl.protocol === "http:";
if (siteUrl.protocol !== "https:" && !localOverride && !lanOverride) throw new Error("PUBLIC_SITE_URL must use HTTPS in production (private LAN HTTP requires ALLOW_INSECURE_LAN=1)");
if (siteUrl.hostname === "your-public-domain.example") throw new Error("PUBLIC_SITE_URL must be replaced with the real public domain");

for (const name of ["BLOG_DATA_DIR", "BLOG_MEDIA_DIR", "BLOG_BACKUP_DIR"]) {
  if (!path.isAbsolute(process.env[name])) throw new Error(`${name} must be an absolute persistent path in production`);
}
