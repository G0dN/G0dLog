export const SITE_NAME = "G0dLog";
export const SITE_DESCRIPTION = "站主与受邀作者共同维护的公开写作空间。";
export const PROJECT_URL = "https://github.com/G0dN/G0dLog";
const PUBLIC_EMAIL_CODE = "2a4d45584e454475454c4c4349434b466a1b1c1904494547";

export function siteOrigin(request?: Request) {
  const configured = process.env.PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (request) return new URL(request.url).origin;
  throw new Error("PUBLIC_SITE_URL is required when no request URL is available");
}

export function cloudflareEmailCode(email?: string) {
  if (!email) return PUBLIC_EMAIL_CODE;
  const key = 0x2a;
  return `${key.toString(16).padStart(2, "0")}${[...email].map((character) => (character.charCodeAt(0) ^ key).toString(16).padStart(2, "0")).join("")}`;
}

export function publicEmailMarkup() {
  return { encoded: cloudflareEmailCode(), label: "联系站主" };
}

export function publicAvatarUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
