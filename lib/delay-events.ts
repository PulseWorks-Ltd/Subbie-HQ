import type { DelayEventStatus } from "@prisma/client";
import { prisma } from "./prisma";

// ============================================================
// Delay / Extension of Time tracking (SA-2017 clause 10) — the same
// "log, notify, remind, evidence" mechanism this session's Retention
// feature already established for clause 9's cousin. Deliberately scoped
// to exactly that: no adjudication/dispute-resolution tracking here.
// ============================================================

// The notice deadline is a DEFAULT (in application code, not the
// database), same pattern as Retention's tranche2ExpectedDate — computed
// from ContractTerms.delayNoticePeriodDays, but stored and editable on the
// row itself since it can genuinely be adjusted independently of the
// contract's stated terms (e.g. an agreed extension of the notice period
// itself).
export function computeNoticeDeadline(startDate: Date, delayNoticePeriodDays: number | null | undefined): Date | null {
  if (delayNoticePeriodDays == null) return null;
  const deadline = new Date(startDate);
  deadline.setDate(deadline.getDate() + delayNoticePeriodDays);
  return deadline;
}

export async function createDelayEvent(params: {
  projectId: string;
  variationItemId?: string | null;
  cause: string;
  clauseReference?: string | null;
  startDate: Date;
  endDate?: Date | null;
  daysClaimed?: number | null;
  noticeDeadlineOverride?: Date | null;
  createdByUserId: string;
}) {
  const contractTerms = await prisma.contractTerms.findUnique({
    where: { projectId: params.projectId },
    select: { delayNoticePeriodDays: true }
  });
  const noticeDeadline = params.noticeDeadlineOverride ?? computeNoticeDeadline(params.startDate, contractTerms?.delayNoticePeriodDays);

  return prisma.delayEvent.create({
    data: {
      projectId: params.projectId,
      variationItemId: params.variationItemId || null,
      cause: params.cause,
      clauseReference: params.clauseReference || null,
      startDate: params.startDate,
      endDate: params.endDate || null,
      daysClaimed: params.daysClaimed ?? null,
      noticeDeadline,
      createdByUserId: params.createdByUserId
    }
  });
}

// Called once the notice's ExternalAction actually sends (see
// lib/external-action.ts's createAndSendExternalAction, mirroring how
// that same function sends the request email BEFORE persisting anything
// — this is only ever invoked after a successful send).
export async function markNoticeSent(delayEventId: string) {
  return prisma.delayEvent.update({
    where: { id: delayEventId },
    data: { noticeSentAt: new Date(), status: "notice_sent" }
  });
}

// The subbie's own manual resolution, after reading the Main Contractor/
// Contract Administrator's response (see the DelayEvent schema comment for
// why daysAwarded isn't auto-captured from the response itself). A status
// of "closed" — administratively closed (superseded, withdrawn) — is set
// directly via the generic PATCH route instead, since it needs no
// daysAwarded/rejected distinction.
export async function resolveDelayEvent(params: { delayEventId: string; status: "awarded" | "rejected"; daysAwarded?: number | null }) {
  return prisma.delayEvent.update({
    where: { id: params.delayEventId },
    data: {
      status: params.status,
      daysAwarded: params.status === "awarded" ? (params.daysAwarded ?? null) : null,
      resolvedAt: new Date()
    }
  });
}

export type DelayEventListItem = Awaited<ReturnType<typeof prisma.delayEvent.findMany>>[number];

export const DELAY_EVENT_STATUS_LABELS: Record<DelayEventStatus, string> = {
  open: "Open — notice not yet sent",
  notice_sent: "Notice sent — awaiting response",
  awarded: "Awarded",
  rejected: "Rejected",
  closed: "Closed"
};
