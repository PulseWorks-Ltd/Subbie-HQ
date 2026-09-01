import type { RecordLifecycleEntityType, RecordLifecycleEventType } from "@prisma/client";
import { prisma } from "./prisma";

// Single source of truth for logging a close/reactivate/complete transition
// on a VariationItem/Task/Project — one shared table across all three
// entity types (see RecordLifecycleEvent's schema comment), mirroring the
// OrganisationAccessEvent/recordAccessStatusChange pattern already used for
// organisation billing-status history. Deliberately a real audit trail:
// previousState/newState capture the actual transition (plain strings,
// since the 3 entity types have 3 different state vocabularies), and note
// carries either a user-supplied reason or an auto-composed summary of
// whatever closure-review warnings were overridden — this is what lets
// someone later reconstruct "why was this reopened three weeks later"
// rather than just seeing a bare status flag.
export async function recordLifecycleEvent(params: {
  entityType: RecordLifecycleEntityType;
  entityId: string;
  eventType: RecordLifecycleEventType;
  userId: string;
  previousState?: string | null;
  newState?: string | null;
  note?: string | null;
}): Promise<void> {
  await prisma.recordLifecycleEvent.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      eventType: params.eventType,
      userId: params.userId,
      previousState: params.previousState ?? null,
      newState: params.newState ?? null,
      note: params.note ?? null
    }
  });
}

// Full history for one record, newest first — the "why was this reopened
// three weeks later" view, and what a VariationItem/Task/Project detail
// page renders as its lifecycle timeline.
export async function getLifecycleHistory(entityType: RecordLifecycleEntityType, entityId: string) {
  return prisma.recordLifecycleEvent.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { firstName: true, lastName: true, email: true } } }
  });
}
