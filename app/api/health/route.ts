import { getDb } from "../../../db";

export async function GET() {
  try {
    getDb();
    return Response.json({ ok: true, service: "g0dlog" });
  } catch {
    return Response.json({ ok: false, service: "g0dlog" }, { status: 503 });
  }
}
