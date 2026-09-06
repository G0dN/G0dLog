import { cookies } from "next/headers";
import { SESSION_COOKIE } from "../../../../lib/server-auth";
import { enforceSameOrigin } from "../../../../lib/security";

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
