import type { ReminderStage } from "@prisma/client";
import { prisma } from "./prisma";
import { sendReminderEmail } from "./email";
import { sendPushToUser } from "./push";
import { hasModuleAccess, type ModuleKey } from "./permissions";

// Stage order matters: a run only sends a reminder if the newly-computed
// stage ranks strictly higher than the last one sent, so a nightly run never
// repeats a stage (including "overdue", which would otherwise resend daily
// for as long as an item stays overdue).
const STAGE_ORDER: ReminderStage[] = ["three_day", "one_day", "due_today", "overdue"];

function stageRank(stage: ReminderStage | null): number {
  if (!stage) return -1;
  return STAGE_ORDER.indexOf(stage);
}

function stageForDaysUntil(daysUntil: number): ReminderStage | null {
  if (daysUntil === 3) return "three_day";
  if (daysUntil === 1) return "one_day";
  if (daysUntil === 0) return "due_today";
  if (daysUntil < 0) return "overdue";
  return null;
}

function stageLabel(stage: ReminderStage, kind: "due" | "expiry"): string {
  const labels: Record<"due" | "expiry", Record<ReminderStage, string>> = {
    due: { three_day: "due in 3 days", one_day: "due tomorrow", due_today: "due today", overdue: "overdue" },
    expiry: {
      three_day: "expiring in 3 days",
      one_day: "expiring tomorrow",
      due_today: "expiring today",
      overdue: "expired"
    }
  };
  return labels[kind][stage];
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function daysBetween(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / (1000 * 60 * 60 * 24));
}

function baseUrl() {
  return process.env.AUTH_URL ?? "";
}

type RecipientTarget = { userId: string; email: string };

async function getRecipients(
  project: { id: string; organisationId: string | null },
  module: ModuleKey
): Promise<RecipientTarget[]> {
  if (project.organisationId) {
    const members = await prisma.organisationMember.findMany({
      where: { organisationId: project.organisationId },
      include: { user: { select: { id: true, email: true } } }
    });
    return members.filter((member) => hasModuleAccess(member, module)).map((member) => ({
      userId: member.user.id,
      email: member.user.email
    }));
  }

  // Legacy, org-less projects: unrestricted, same as requireModuleAccess's fallback.
  const members = await prisma.projectMember.findMany({
    where: { projectId: project.id },
    include: { user: { select: { id: true, email: true } } }
  });
  return members.map((member) => ({ userId: member.user.id, email: member.user.email }));
}

async function notifyRecipients(
  recipients: RecipientTarget[],
  message: { subject: string; headline: string; detail: string; projectName: string; itemUrl: string }
) {
  await Promise.all(
    recipients.map(async (recipient) => {
      await sendReminderEmail({
        to: recipient.email,
        subject: message.subject,
        headline: message.headline,
        detail: message.detail,
        projectName: message.projectName,
        itemUrl: message.itemUrl
      });
      await sendPushToUser(recipient.userId, {
        title: message.subject,
        body: `${message.detail} — ${message.projectName}`,
        url: message.itemUrl
      });
    })
  );
}

export type ReminderRunSummary = {
  checkedVariationItems: number;
  checkedSafetyDocuments: number;
  remindersSent: number;
  details: string[];
};

export async function runReminderCheck(now: Date = new Date()): Promise<ReminderRunSummary> {
  const today = startOfDay(now);
  const summary: ReminderRunSummary = {
    checkedVariationItems: 0,
    checkedSafetyDocuments: 0,
    remindersSent: 0,
    details: []
  };

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      organisationId: true,
      // TODO: once Payment Claims is built, add a nextClaimDate stage check
      // here too, gated by the "payment_claims" module — same staged
      // 3-day/1-day/due-today/overdue pattern, needs its own
      // lastReminderStage-equivalent field on whatever tracks claim due dates.
      variationItems: {
        where: { dueAt: { not: null }, status: { not: "complete" } },
        select: { id: true, type: true, reference: true, title: true, dueAt: true, lastReminderStage: true }
      },
      safetyDocuments: {
        where: { expiresAt: { not: null } },
        select: { id: true, title: true, expiresAt: true, lastReminderStage: true }
      }
    }
  });

  const recipientCache = new Map<string, RecipientTarget[]>();
  async function recipientsFor(project: { id: string; organisationId: string | null }, module: ModuleKey) {
    const key = `${project.organisationId ?? `legacy:${project.id}`}:${module}`;
    if (!recipientCache.has(key)) {
      recipientCache.set(key, await getRecipients(project, module));
    }
    return recipientCache.get(key)!;
  }

  for (const project of projects) {
    for (const item of project.variationItems) {
      summary.checkedVariationItems++;
      if (!item.dueAt) continue;

      const stage = stageForDaysUntil(daysBetween(today, item.dueAt));
      if (!stage || stageRank(stage) <= stageRank(item.lastReminderStage)) continue;

      const module: ModuleKey = item.type === "variation" ? "variations" : "site_instructions";
      const recipients = await recipientsFor(project, module);
      const headline = `${item.reference} — ${item.title}`;
      const detail = `${item.type === "variation" ? "Variation" : "Site Instruction"} ${stageLabel(stage, "due")}`;
      const itemUrl = `${baseUrl()}/projects/${project.id}/variations/${item.id}`;

      await notifyRecipients(recipients, { subject: headline, headline, detail, projectName: project.name, itemUrl });
      await prisma.variationItem.update({ where: { id: item.id }, data: { lastReminderStage: stage } });

      summary.remindersSent += recipients.length;
      summary.details.push(`VariationItem ${item.id} (${item.reference}): stage=${stage}, recipients=${recipients.length}`);
    }

    for (const document of project.safetyDocuments) {
      summary.checkedSafetyDocuments++;
      if (!document.expiresAt) continue;

      const stage = stageForDaysUntil(daysBetween(today, document.expiresAt));
      if (!stage || stageRank(stage) <= stageRank(document.lastReminderStage)) continue;

      const recipients = await recipientsFor(project, "health_safety");
      const detail = `Safety document ${stageLabel(stage, "expiry")}`;
      const itemUrl = `${baseUrl()}/projects/${project.id}/health-safety`;

      await notifyRecipients(recipients, {
        subject: document.title,
        headline: document.title,
        detail,
        projectName: project.name,
        itemUrl
      });
      await prisma.safetyDocument.update({ where: { id: document.id }, data: { lastReminderStage: stage } });

      summary.remindersSent += recipients.length;
      summary.details.push(`SafetyDocument ${document.id} (${document.title}): stage=${stage}, recipients=${recipients.length}`);
    }
  }

  console.log(
    `[reminders] checked ${summary.checkedVariationItems} variation items, ${summary.checkedSafetyDocuments} safety documents; sent ${summary.remindersSent} notifications`
  );
  for (const line of summary.details) {
    console.log(`[reminders] ${line}`);
  }

  return summary;
}
