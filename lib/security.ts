const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function enforceSameOrigin(request: Request): Response | null {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host") || requestUrl.host;
  const trustedHost = requestHost.toLowerCase();
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (origin) {
    try {
      if (new URL(origin).host.toLowerCase() !== trustedHost) return Response.json({ error: "请求来源不受信任" }, { status: 403 });
    } catch {
      return Response.json({ error: "请求来源不受信任" }, { status: 403 });
    }
  }
  if (!origin && referer) {
    try {
      if (new URL(referer).host.toLowerCase() !== trustedHost) return Response.json({ error: "请求来源不受信任" }, { status: 403 });
    } catch {
      return Response.json({ error: "请求来源不受信任" }, { status: 403 });
    }
  }
  return null;
}

function requestAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function loginRateKey(request: Request, username: string) {
  return `${requestAddress(request)}:${username.toLowerCase()}`;
}

export function isLoginRateLimited(key: string) {
  const entry = loginAttempts.get(key);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    loginAttempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function noteLoginFailure(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= now) loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
}

export function clearLoginFailures(key: string) {
  loginAttempts.delete(key);
}

export function passwordError(password: string) {
  if (password.length < 12) return "密码至少 12 位";
  let classes = 0;
  if (/[a-z]/.test(password)) classes += 1;
  if (/[A-Z]/.test(password)) classes += 1;
  if (/\d/.test(password)) classes += 1;
  if (/[^A-Za-z\d]/.test(password)) classes += 1;
  return classes >= 3 ? null : "密码需同时包含大小写字母、数字或符号中的至少三类";
}

export function safeJsonMetadata(value: Record<string, unknown> | undefined) {
  if (!value) return null;
  return JSON.stringify(value, (_key, item) => typeof item === "string" && item.length > 200 ? `${item.slice(0, 200)}…` : item);
}
