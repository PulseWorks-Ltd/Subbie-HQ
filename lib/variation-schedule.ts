import type { ContractTerms, VariationScheduleRun } from "@prisma/client";
import { prisma } from "./prisma";
import { rollBackToWorkingDay, subtractWorkingDays } from "./working-days";
import { generateAndStoreVariationPackage } from "./variation-package-generation";
import { computeValueSnapshot, createAndSendExternalAction } from "./external-action";
import { draftPackageApprovalMessage } from "./grok";
import { AiSpendCapExceededError } from "./ai-usage";
import { sendReminderEmail } from "./email";
import { sendPushToUser } from "./push";
import { getRecipients, type RecipientTarget } from "./reminders";
import type { ModuleKey } from "./permissions";

const WARNING_WORKING_DAYS_BEFORE = 2;

function baseUrl() {
  return process.env.AUTH_URL ?? "";
}

function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function cycleMonthKey(year: number, monthIndex0: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;
}

// Computes the real, contract-derived deadline for a given target month
// (the calendar month this cycle's schedule applies to — NOT necessarily
// the month the resulting date falls in: a fixed day near month-start can
// roll back into the previous month if it lands on a weekend). Returns
// null when no schedule is configured yet (manual entry required) — the
// automation simply never fires for a project until Contract Terms has a
// confirmed schedule.
export function computeScheduledSendDate(
  contractTerms: Pick<ContractTerms, "variationScheduleType" | "variationScheduleValue">,
  year: number,
  monthIndex0: number
): Date | null {
  if (!contractTerms.variationScheduleType || contractTerms.variationScheduleValue == null) {
    return null;
  }

  if (contractTerms.variationScheduleType === "fixed_date") {
    const daysInMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
    const day = Math.min(Math.max(contractTerms.variationScheduleValue, 1), daysInMonth);
    return rollBackToWorkingDay(new Date(Date.UTC(year, monthIndex0, day)));
  }

  // working_days_before_month_end — subtractWorkingDays already only lands
  // on working days, so no separate rollback is needed for this branch.
  const monthEnd = new Date(Date.UTC(year, monthIndex0 + 1, 0));
  return subtractWorkingDays(monthEnd, contractTerms.variationScheduleValue);
}

// The 2-working-day warning fires BEFORE the real deadline — the deadline
// itself (scheduledSendAt) is never moved to make room for the warning.
// This is the one function that computes the warning date, so there's
// exactly one place this critical direction (before, not after) can be
// gotten wrong.
export function computeWarningDate(scheduledSendAt: Date): Date {
  return subtractWorkingDays(scheduledSendAt, WARNING_WORKING_DAYS_BEFORE);
}

async function resolveScheduleRecipients(
  projectId: string
): Promise<{ to: { contactId?: string; email?: string }[]; cc: string[] }> {
  const recipients = await prisma.variationScheduleRecipient.findMany({
    where: { projectId },
    include: { contact: { select: { email: true } } }
  });

  const to = recipients
    .filter((r) => r.role === "to")
    .map((r) =>
      r.mainContractorContactId ? { contactId: r.mainContractorContactId } : { email: r.email }
    )
    .filter((r) => r.contactId || r.email);

  const cc = recipients
    .filter((r) => r.role === "cc")
    .map((r) => r.contact?.email ?? r.email)
    .filter((email): email is string => Boolean(email));

  return { to, cc };
}

async function getEligibleOpenItems(projectId: string) {
  return prisma.variationItem.findMany({
    where: { projectId, status: { not: "complete" } },
    orderBy: { createdAt: "asc" }
  });
}


export type ScheduleSweepSummary = {
  checkedProjects: number;
  runsCreated: number;
  warningsSent: number;
  sent: number;
  skippedNoItems: number;
  details: string[];
};

// The daily scheduling sweep — triggered by app/api/cron/variation-schedule.
// For every project with automation enabled and a confirmed Contract Terms
// schedule, ensures this month's VariationScheduleRun exists, then advances
// it exactly one stage if today has reached the relevant date:
//   pending_warning -> warned            (automatic_with_approval, at warningAt)
//   warned          -> sent              (automatic_with_approval, at scheduledSendAt)
//   pending_warning -> sent              (fully_automatic, at scheduledSendAt;
//                                          also the catch-up path if a run somehow
//                                          reaches its send date without ever
//                                          having been warned)
// A run already "sent"/"cancelled"/"skipped_no_items" is left untouched —
// this makes the sweep safe to run more than once on the same day.
export async function runVariationScheduleSweep(now: Date = new Date()): Promise<ScheduleSweepSummary> {
  const today = startOfUTCDay(now);
  const summary: ScheduleSweepSummary = {
    checkedProjects: 0,
    runsCreated: 0,
    warningsSent: 0,
    sent: 0,
    skippedNoItems: 0,
    details: []
  };

  const projects = await prisma.project.findMany({
    where: { variationAutomationMode: { not: "manual" } },
    select: {
      id: true,
      name: true,
      organisationId: true,
      variationAutomationMode: true,
      variationAutomationSetByUserId: true,
      contractTerms: true
    }
  });

  for (const project of projects) {
    summary.checkedProjects++;
    if (!project.contractTerms || !project.variationAutomationSetByUserId) continue;

    const attributionUserId = project.variationAutomationSetByUserId;
    const run = await resolveOrCreateRun(project, project.contractTerms, today, summary);
    if (!run) continue;

    if (run.status === "cancelled" || run.status === "sent" || run.status === "skipped_no_items") {
      continue;
    }

    const mode = project.variationAutomationMode;
    const reachedWarning = run.warningAt != null && today.getTime() >= startOfUTCDay(run.warningAt).getTime();
    const reachedSend = today.getTime() >= startOfUTCDay(run.scheduledSendAt).getTime();

    if (mode === "automatic_with_approval" && run.status === "pending_warning" && reachedWarning && !reachedSend) {
      await processWarningStage(project, run, attributionUserId, summary);
      continue;
    }

    if (reachedSend) {
      // Covers: automatic_with_approval already "warned" and now at/after
      // scheduledSendAt; fully_automatic reaching scheduledSendAt directly;
      // and the catch-up case where a run is still "pending_warning" past
      // its own scheduledSendAt (e.g. the cron didn't run for a few days) —
      // in that last case there was never a chance to warn, so this
      // generates and sends in one step rather than getting stuck.
      await processSendStage(project, run, attributionUserId, summary);
    }
  }

  console.log(
    `[variation-schedule] checked ${summary.checkedProjects} automated projects; ${summary.runsCreated} runs created, ${summary.warningsSent} warnings sent, ${summary.sent} cycles sent, ${summary.skippedNoItems} skipped (no eligible items)`
  );
  for (const line of summary.details) {
    console.log(`[variation-schedule] ${line}`);
  }

  return summary;
}

async function resolveOrCreateRun(
  project: { id: string; variationAutomationMode: string },
  contractTerms: ContractTerms,
  today: Date,
  summary: ScheduleSweepSummary
): Promise<VariationScheduleRun | null> {
  let year = today.getUTCFullYear();
  let monthIndex0 = today.getUTCMonth();

  for (let attempt = 0; attempt < 2; attempt++) {
    const cycleMonth = cycleMonthKey(year, monthIndex0);
    const existing = await prisma.variationScheduleRun.findUnique({
      where: { projectId_cycleMonth: { projectId: project.id, cycleMonth } }
    });
    if (existing) {
      return existing;
    }

    const scheduledSendAt = computeScheduledSendDate(contractTerms, year, monthIndex0);
    if (!scheduledSendAt) {
      return null;
    }

    // If this target month's deadline has already passed and no run was
    // ever created for it, automation was turned on (or a schedule was
    // first configured) too late to catch it — move on to next month's
    // cycle rather than immediately firing a stale, backdated send.
    if (scheduledSendAt.getTime() < today.getTime()) {
      monthIndex0 += 1;
      if (monthIndex0 > 11) {
        monthIndex0 = 0;
        year += 1;
      }
      continue;
    }

    const warningAt =
      project.variationAutomationMode === "automatic_with_approval" ? computeWarningDate(scheduledSendAt) : null;

    const created = await prisma.variationScheduleRun.create({
      data: { projectId: project.id, cycleMonth, scheduledSendAt, warningAt, status: "pending_warning" }
    });
    summary.runsCreated++;
    return created;
  }

  return null;
}

async function draftMessage(
  projectId: string,
  item: { id: string; reference: string; title: string; type: string },
  variationPackageId: string,
  organisationId: string | null,
  attributionUserId: string
): Promise<string> {
  const snapshot = await computeValueSnapshot({
    projectId,
    variationItemId: item.id,
    variationPackageId
  }).catch(() => null);

  const cumulativeTotal = snapshot?.combinedTotal ?? 0;
  const newSinceLastTotal = snapshot?.previousPackage ? cumulativeTotal - snapshot.previousPackage.grandTotal : null;

  try {
    const drafted = await draftPackageApprovalMessage(
      {
        itemReference: item.reference,
        itemTitle: item.title,
        isSiteInstruction: item.type === "site_instruction",
        cumulativeTotal,
        newSinceLastTotal
      },
      { organisationId, userId: attributionUserId }
    );
    return drafted.messageBody;
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      console.warn(`[variation-schedule] AI drafting spend-capped for ${item.reference}, using fallback message.`);
    } else {
      console.error(`[variation-schedule] AI drafting failed for ${item.reference}, using fallback message:`, error);
    }
    const totalLabel = `$${cumulativeTotal.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}`;
    return newSinceLastTotal != null
      ? `Please find attached the latest Variation Package for ${item.reference} — ${item.title}. Cumulative recorded value to date is ${totalLabel}, of which $${newSinceLastTotal.toLocaleString("en-NZ", { minimumFractionDigits: 2 })} is new since the last approval request. This was generated automatically as part of this project's scheduled submission cycle.`
      : `Please find attached the Variation Package for ${item.reference} — ${item.title}. Recorded value to date is ${totalLabel}. This was generated automatically as part of this project's scheduled submission cycle.`;
  }
}

async function generatePackagesForRun(
  project: { id: string },
  run: VariationScheduleRun,
  attributionUserId: string,
  summary: ScheduleSweepSummary
): Promise<{ itemId: string; packageId: string }[] | null> {
  const items = await getEligibleOpenItems(project.id);
  if (items.length === 0) {
    await prisma.variationScheduleRun.update({ where: { id: run.id }, data: { status: "skipped_no_items" } });
    summary.skippedNoItems++;
    summary.details.push(`Project ${project.id}, cycle ${run.cycleMonth}: no eligible open Variation/SI — skipped.`);
    return null;
  }

  const generated: { itemId: string; packageId: string }[] = [];
  for (const item of items) {
    const pkg = await generateAndStoreVariationPackage({
      projectId: project.id,
      itemId: item.id,
      generatedByUserId: attributionUserId
    });
    if (!pkg) continue;
    await prisma.variationPackage.update({ where: { id: pkg.id }, data: { scheduleRunId: run.id } });
    generated.push({ itemId: item.id, packageId: pkg.id });
  }
  return generated;
}

async function warnInternalRecipients(
  project: { id: string; name: string; organisationId: string | null },
  run: VariationScheduleRun,
  itemCount: number
) {
  const recipientsByEmail = new Map<string, RecipientTarget>();
  for (const moduleKey of ["variations", "site_instructions"] as ModuleKey[]) {
    for (const recipient of await getRecipients(project, moduleKey)) {
      recipientsByEmail.set(recipient.email, recipient);
    }
  }

  const sendDateLabel = run.scheduledSendAt.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
  const itemUrl = `${baseUrl()}/projects/${project.id}/settings`;
  const subject = `Variation Package auto-send scheduled — ${project.name}`;
  const detail = `${itemCount} Variation Package${itemCount === 1 ? "" : "s"} generated and ready — will be sent for approval automatically on ${sendDateLabel} unless cancelled`;

  await Promise.all(
    Array.from(recipientsByEmail.values()).map(async (recipient) => {
      await sendReminderEmail({ to: recipient.email, subject, headline: subject, detail, projectName: project.name, itemUrl });
      await sendPushToUser(recipient.userId, { title: subject, body: detail, url: itemUrl });
    })
  );
}

async function processWarningStage(
  project: { id: string; name: string; organisationId: string | null },
  run: VariationScheduleRun,
  attributionUserId: string,
  summary: ScheduleSweepSummary
) {
  const generated = await generatePackagesForRun(project, run, attributionUserId, summary);
  if (!generated) return;

  await warnInternalRecipients(project, run, generated.length);
  await prisma.variationScheduleRun.update({ where: { id: run.id }, data: { status: "warned", warnedAt: new Date() } });
  summary.warningsSent++;
  summary.details.push(
    `Project ${project.id}, cycle ${run.cycleMonth}: warned (${generated.length} package(s) generated), send due ${run.scheduledSendAt.toISOString().slice(0, 10)}.`
  );
}

async function processSendStage(
  project: { id: string; name: string; organisationId: string | null },
  run: VariationScheduleRun,
  attributionUserId: string,
  summary: ScheduleSweepSummary
) {
  // Reuse already-generated packages from the warning stage (frozen at
  // that moment, so what gets sent is exactly what the team was warned
  // about and had the chance to review/cancel) — only generate fresh ones
  // here for fully_automatic (no warning stage) or the pending_warning
  // catch-up case, where nothing exists yet.
  let toSend = await prisma.variationPackage.findMany({
    where: { scheduleRunId: run.id },
    include: { variationItem: true }
  });

  if (toSend.length === 0) {
    const generated = await generatePackagesForRun(project, run, attributionUserId, summary);
    if (!generated) return;
    toSend = await prisma.variationPackage.findMany({ where: { scheduleRunId: run.id }, include: { variationItem: true } });
  }

  const { to, cc } = await resolveScheduleRecipients(project.id);
  if (to.length === 0) {
    summary.details.push(
      `Project ${project.id}, cycle ${run.cycleMonth}: no "To" recipients configured — packages generated but nothing sent. Add recipients in Settings.`
    );
    return;
  }

  for (const pkg of toSend) {
    const message = await draftMessage(project.id, pkg.variationItem, pkg.id, project.organisationId, attributionUserId);
    for (const recipient of to) {
      await createAndSendExternalAction({
        projectId: project.id,
        variationItemId: pkg.variationItemId,
        variationPackageId: pkg.id,
        type: "approve",
        message,
        recipient,
        ccEmails: cc,
        sentByUserId: attributionUserId,
        baseUrl: baseUrl()
      });
    }
  }

  await prisma.variationScheduleRun.update({ where: { id: run.id }, data: { status: "sent", sentAt: new Date() } });
  summary.sent++;
  summary.details.push(`Project ${project.id}, cycle ${run.cycleMonth}: sent ${toSend.length} package(s) to ${to.length} recipient(s).`);
}

// The cancellation mechanism (Task 3) — the one, unambiguous way to stop an
// upcoming automatic send. Only valid before the cycle has actually sent;
// cancelling after send would be misleading (the email is already gone).
export async function cancelVariationScheduleRun(
  runId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const run = await prisma.variationScheduleRun.findUnique({ where: { id: runId } });
  if (!run) {
    return { ok: false, error: "Not found." };
  }
  if (run.status === "sent") {
    return { ok: false, error: "This cycle has already been sent — it's too late to cancel." };
  }
  if (run.status === "cancelled") {
    return { ok: true };
  }
  await prisma.variationScheduleRun.update({
    where: { id: runId },
    data: { status: "cancelled", cancelledAt: new Date(), cancelledByUserId: userId }
  });
  return { ok: true };
}
