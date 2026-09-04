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

export type DelayEventDisplayColor = DelayEventStatus | "responded";
export type DelayEventDisplayStatus = { label: string; colorKey: DelayEventDisplayColor };

// The one place that decides what status text/color actually shows for a
// delay event — used by BOTH the list page's summary badge and the detail
// page's own top badge, so the two can never disagree the way they used
// to (a genuine bug report: the detail page's Notice History correctly
// showed a recipient's response, but both badges kept reading the plain
// DelayEventStatus enum, which only advances to "awarded"/"rejected" once
// the subbie manually resolves it — days awarded can differ from what was
// claimed or from the response itself, so that manual step is real and
// stays required, but a badge frozen on "awaiting response" after a
// response has actually arrived is misleading, not just incomplete).
//
// A genuinely resolved event (awarded/rejected) always wins and spells
// out the outcome (days granted, if any) rather than the plain enum label
// — this is the "Approved - 1 Day EOT Granted"-style summary. Short of
// that, a "notice_sent" event whose most recent notice has a recorded
// response surfaces that response instead of a stale "awaiting response".
export function getDelayEventDisplayStatus(
  delayEvent: { status: DelayEventStatus; daysAwarded: number | null },
  externalActions: { status: string; responseChoice: string | null; respondedAt: Date | null }[]
): DelayEventDisplayStatus {
  if (delayEvent.status === "awarded") {
    const days = delayEvent.daysAwarded ?? 0;
    return { label: `Approved — ${days} day${days === 1 ? "" : "s"} EOT granted`, colorKey: "awarded" };
  }
  if (delayEvent.status === "rejected") {
    return { label: "Rejected", colorKey: "rejected" };
  }
  if (delayEvent.status === "notice_sent") {
    const mostRecentResponse = [...externalActions]
      .filter((action) => action.status === "responded" && action.respondedAt)
      .sort((a, b) => (b.respondedAt as Date).getTime() - (a.respondedAt as Date).getTime())[0];
    if (mostRecentResponse) {
      const choiceLabel = mostRecentResponse.responseChoice === "approved" ? "Approved" : "Rejected";
      return { label: `${choiceLabel} by recipient — awaiting your resolution`, colorKey: "responded" };
    }
  }
  return { label: DELAY_EVENT_STATUS_LABELS[delayEvent.status], colorKey: delayEvent.status };
}

// Shared by the list page's badge and the detail page's own top badge —
// one color mapping, so the two can't drift into using different colors
// for what's supposed to be the same status.
export const DELAY_EVENT_STATUS_COLORS: Record<DelayEventDisplayColor, string> = {
  open: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  notice_sent: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
  responded: "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  awarded: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300",
  rejected: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
  closed: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
};
