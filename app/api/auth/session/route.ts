import { getCurrentUser } from "../../../../lib/server-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ user: null });
  return Response.json({ user: { id: user.id, username: user.username, slug: user.slug, displayName: user.displayName, avatarUrl: user.avatarUrl, signature: user.signature, role: user.role, mustChangePassword: user.mustChangePassword } });
}
