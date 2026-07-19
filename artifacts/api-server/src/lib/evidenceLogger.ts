import { db } from "@workspace/db";
import { evidenceLogTable } from "@workspace/db";

export interface LogEventOptions {
  projectId: number;
  userId: string;
  actionType: string;
  entityType?: string;
  entityId?: number;
  summary: string;
  metadata?: Record<string, unknown>;
}

export async function logEvent(opts: LogEventOptions): Promise<void> {
  try {
    await db.insert(evidenceLogTable).values({
      projectId: opts.projectId,
      userId: opts.userId,
      actionType: opts.actionType,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
      summary: opts.summary,
      metadataJson: opts.metadata ? JSON.stringify(opts.metadata) : null,
    });
  } catch {
    // Evidence log failures should never block the main operation
  }
}
