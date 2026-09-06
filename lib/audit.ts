import { getDb } from "../db";
import { auditLogs } from "../db/schema";
import { safeJsonMetadata } from "./security";

export async function recordAudit(actorId: string | null, action: string, resourceType: string, resourceId?: string, metadata?: Record<string, unknown>) {
  try {
    await getDb().insert(auditLogs).values({
      id: crypto.randomUUID(),
      actorId,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      metadata: safeJsonMetadata(metadata),
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Auditing must not turn a successful content operation into a data-loss path.
  }
}
