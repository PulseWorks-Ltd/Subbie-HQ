import { prisma } from "./prisma";
import { getOrganisationMembership } from "./organisation";
import { hasModuleAccess, type ModuleKey } from "./permissions";

const MODULE_FOR_TYPE: Record<DashboardItemType, ModuleKey> = {
  programme: "programme",
  "site-instruction": "site_instructions",
  "payment-claim": "payment_claims",
  "safety-document": "health_safety"
};

export type DashboardItemType = "programme" | "site-instruction" | "payment-claim" | "safety-document";
export type DashboardRescheduleField = "startDate" | "endDate" | "dueAt" | "nextClaimDate" | "expiresAt";

export type DashboardItem = {
  id: string;
  type: DashboardItemType;
  projectId: string;
  projectName: string;
  headline: string;
  detail: string;
  date: Date;
  isOverdue: boolean;
  href: string;
  canComplete: boolean;
  rescheduleField: DashboardRescheduleField;
};

const WINDOW_DAYS = 7;

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatShortDate(date: Date, today: Date) {
  const day = startOfDay(date);
  const diffDays = Math.round((day.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  return new Date(date).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
}

export async function getDashboardFeed(userId: string): Promise<DashboardItem[]> {
  const today = startOfDay(new Date());
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + WINDOW_DAYS);

  const membership = await getOrganisationMembership(userId);

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        ...(membership ? [{ organisationId: membership.organisationId }] : []),
        { organisationId: null, members: { some: { userId } } }
      ]
    },
    include: {
      programmeItems: { where: { completedAt: null } },
      siteInstructions: { where: { status: "open", dueAt: { not: null } } },
      safetyDocuments: { where: { expiresAt: { not: null } } }
    }
  });

  const items: DashboardItem[] = [];

  function inWindow(day: Date) {
    return day.getTime() <= windowEnd.getTime();
  }

  function canSeeType(project: { organisationId: string | null }, type: DashboardItemType) {
    if (!project.organisationId) return true;
    return hasModuleAccess(membership, MODULE_FOR_TYPE[type]);
  }

  for (const project of projects) {
    const canSeeProgramme = canSeeType(project, "programme");
    const canSeeSiteInstructions = canSeeType(project, "site-instruction");
    const canSeePaymentClaims = canSeeType(project, "payment-claim");
    const canSeeSafetyDocuments = canSeeType(project, "safety-document");

    for (const item of canSeeProgramme ? project.programmeItems : []) {
      if (!item.startDate && !item.endDate) continue;

      let anchor: Date;
      let phase: "starting" | "due";
      if (item.startDate && startOfDay(item.startDate).getTime() >= today.getTime()) {
        anchor = item.startDate;
        phase = "starting";
      } else {
        anchor = item.endDate ?? item.startDate!;
        phase = "due";
      }

      const anchorDay = startOfDay(anchor);
      if (!inWindow(anchorDay)) continue;

      items.push({
        id: item.id,
        type: "programme",
        projectId: project.id,
        projectName: project.name,
        headline: item.title,
        detail: `${phase === "starting" ? "Starting" : "Due"} ${formatShortDate(anchor, today)}`,
        date: anchor,
        isOverdue: phase === "due" && anchorDay.getTime() < today.getTime(),
        href: `/projects/${project.id}/programme`,
        canComplete: true,
        rescheduleField: phase === "starting" ? "startDate" : "endDate"
      });
    }

    for (const siteInstruction of canSeeSiteInstructions ? project.siteInstructions : []) {
      const anchor = siteInstruction.dueAt!;
      const anchorDay = startOfDay(anchor);
      if (!inWindow(anchorDay)) continue;

      items.push({
        id: siteInstruction.id,
        type: "site-instruction",
        projectId: project.id,
        projectName: project.name,
        headline: `${siteInstruction.reference} — ${siteInstruction.title}`,
        detail: `Response due ${formatShortDate(anchor, today)}`,
        date: anchor,
        isOverdue: anchorDay.getTime() < today.getTime(),
        href: `/projects/${project.id}/updates`,
        canComplete: true,
        rescheduleField: "dueAt"
      });
    }

    if (project.nextClaimDate && canSeePaymentClaims) {
      const anchor = project.nextClaimDate;
      const anchorDay = startOfDay(anchor);
      if (inWindow(anchorDay)) {
        items.push({
          id: `claim-${project.id}`,
          type: "payment-claim",
          projectId: project.id,
          projectName: project.name,
          headline: "Payment Claim due",
          detail: `Due ${formatShortDate(anchor, today)}`,
          date: anchor,
          isOverdue: anchorDay.getTime() < today.getTime(),
          href: `/projects/${project.id}/payment-claims`,
          canComplete: false,
          rescheduleField: "nextClaimDate"
        });
      }
    }

    for (const document of canSeeSafetyDocuments ? project.safetyDocuments : []) {
      const anchor = document.expiresAt!;
      const anchorDay = startOfDay(anchor);
      if (!inWindow(anchorDay)) continue;

      const isOverdue = anchorDay.getTime() < today.getTime();
      items.push({
        id: document.id,
        type: "safety-document",
        projectId: project.id,
        projectName: project.name,
        headline: document.title,
        detail: `${isOverdue ? "Expired" : "Expiring"} ${formatShortDate(anchor, today)}`,
        date: anchor,
        isOverdue,
        href: `/projects/${project.id}/health-safety`,
        canComplete: false,
        rescheduleField: "expiresAt"
      });
    }
  }

  items.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return a.date.getTime() - b.date.getTime();
  });

  return items;
}
