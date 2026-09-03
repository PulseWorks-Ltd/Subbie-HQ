import { prisma } from "./prisma";
import { getOrganisationMembership } from "./organisation";
import { hasModuleAccess, type ModuleKey } from "./permissions";
import { getRetentionSummary } from "./retention";

const MODULE_FOR_TYPE: Record<DashboardItemType, ModuleKey> = {
  programme: "programme",
  variation: "variations",
  "site-instruction": "site_instructions",
  "payment-claim": "payment_claims",
  "safety-document": "health_safety",
  retention: "payment_claims"
};

export type DashboardItemType = "programme" | "variation" | "site-instruction" | "payment-claim" | "safety-document" | "retention";
export type DashboardRescheduleField =
  | "startDate"
  | "endDate"
  | "dueAt"
  | "nextClaimDate"
  | "expiresAt"
  | "tranche1ExpectedDate"
  | "tranche2ExpectedDate";

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
      variationItems: { where: { status: { not: "complete" }, dueAt: { not: null } } },
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
    const canSeeVariations = canSeeType(project, "variation");
    const canSeeSiteInstructions = canSeeType(project, "site-instruction");
    const canSeePaymentClaims = canSeeType(project, "payment-claim");
    const canSeeSafetyDocuments = canSeeType(project, "safety-document");
    const canSeeRetention = canSeeType(project, "retention");

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
        href: `/projects/${project.id}/scope-programme?tab=programme`,
        canComplete: true,
        rescheduleField: phase === "starting" ? "startDate" : "endDate"
      });
    }

    for (const variationItem of project.variationItems) {
      const isVariation = variationItem.type === "variation";
      if (isVariation && !canSeeVariations) continue;
      if (!isVariation && !canSeeSiteInstructions) continue;

      const anchor = variationItem.dueAt!;
      const anchorDay = startOfDay(anchor);
      if (!inWindow(anchorDay)) continue;

      items.push({
        id: variationItem.id,
        type: isVariation ? "variation" : "site-instruction",
        projectId: project.id,
        projectName: project.name,
        headline: `${variationItem.reference} — ${variationItem.title}`,
        detail: `${isVariation ? "Due" : "Response due"} ${formatShortDate(anchor, today)}`,
        date: anchor,
        isOverdue: anchorDay.getTime() < today.getTime(),
        href: `/projects/${project.id}/variations/${variationItem.id}`,
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

    // Retention isn't a plain findMany-able list like the other sections
    // above — its expected dates can be DEFAULTS computed from
    // Project.completedAt/ContractTerms (see getRetentionSummary), not
    // always a value stored on the Retention row itself, so this calls
    // the same summary the Payment Claims page's Retention card uses
    // rather than re-deriving that default logic here a second time. Only
    // called for projects that could plausibly need it (retention module
    // visible at all) to avoid the extra queries for every other project.
    if (canSeeRetention) {
      const retentionSummary = await getRetentionSummary(project.id);
      const tranches: { key: "tranche1" | "tranche2"; label: string; rescheduleField: DashboardRescheduleField }[] = [
        { key: "tranche1", label: "Retention — Practical Completion release due", rescheduleField: "tranche1ExpectedDate" },
        { key: "tranche2", label: "Retention — Defects Liability Period release due", rescheduleField: "tranche2ExpectedDate" }
      ];
      for (const { key, label, rescheduleField } of tranches) {
        const tranche = retentionSummary[key];
        if (!tranche.expectedDate || tranche.releasedAt) continue;
        const anchorDay = startOfDay(tranche.expectedDate);
        if (!inWindow(anchorDay)) continue;

        const isOverdue = anchorDay.getTime() < today.getTime();
        items.push({
          id: `retention-${key}-${project.id}`,
          type: "retention",
          projectId: project.id,
          projectName: project.name,
          headline: label,
          detail: `${isOverdue ? "Overdue" : "Due"} ${formatShortDate(tranche.expectedDate, today)}`,
          date: tranche.expectedDate,
          isOverdue,
          href: `/projects/${project.id}/payment-claims`,
          canComplete: false,
          rescheduleField
        });
      }
    }
  }

  items.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return a.date.getTime() - b.date.getTime();
  });

  return items;
}
