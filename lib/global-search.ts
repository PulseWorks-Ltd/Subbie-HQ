import { prisma } from "./prisma";
import { requireModuleAccess } from "./auth";

export type GlobalSearchResult = {
  recordType: "site_instruction" | "variation" | "task" | "claim" | "project_diary" | "correspondence";
  id: string;
  reference: string | null;
  title: string;
  href: string;
  closed: boolean;
};

// Searches active AND closed/historical records in one project — the
// "search 'cabinet' and get back the SI, the Variation, the Diary entries,
// the Day Works, and the Claim" requirement. Each record type is filtered
// through the SAME module check requireModuleAccess already enforces
// elsewhere for that record type, so this never surfaces something the
// caller couldn't already see via the normal module UI — it's a wider net
// over time (active + historical), not a wider net over permissions.
// Tasks have no dedicated permission module (a cross-cutting, optional-
// link entity) — gated by the caller's existing project access only, same
// as the Dashboard's project-wide feed.
export async function searchProjectHistory(
  projectId: string,
  userId: string,
  query: string
): Promise<GlobalSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [canVariations, canSiteInstructions, canPaymentClaims, canDiary, canCorrespondence] = await Promise.all([
    requireModuleAccess(projectId, userId, "variations"),
    requireModuleAccess(projectId, userId, "site_instructions"),
    requireModuleAccess(projectId, userId, "payment_claims"),
    requireModuleAccess(projectId, userId, "updates"),
    requireModuleAccess(projectId, userId, "correspondence")
  ]);

  const results: GlobalSearchResult[] = [];
  const contains = { contains: q, mode: "insensitive" as const };

  if (canVariations || canSiteInstructions) {
    const items = await prisma.variationItem.findMany({
      where: {
        projectId,
        OR: [{ reference: contains }, { title: contains }, { description: contains }]
      },
      select: { id: true, type: true, reference: true, title: true, closedAt: true },
      take: 50
    });
    for (const item of items) {
      const allowed = item.type === "variation" ? canVariations : canSiteInstructions;
      if (!allowed) continue;
      results.push({
        recordType: item.type === "variation" ? "variation" : "site_instruction",
        id: item.id,
        reference: item.reference,
        title: item.title,
        href: `/projects/${projectId}/variations/${item.id}`,
        closed: item.closedAt != null
      });
    }
  }

  {
    const tasks = await prisma.task.findMany({
      where: { projectId, OR: [{ title: contains }, { description: contains }] },
      select: { id: true, title: true, status: true },
      take: 50
    });
    for (const task of tasks) {
      results.push({
        recordType: "task",
        id: task.id,
        reference: null,
        title: task.title,
        href: `/projects/${projectId}/tasks#${task.id}`,
        closed: task.status === "closed"
      });
    }
  }

  if (canPaymentClaims) {
    const claimNumber = Number(q.replace(/[^\d]/g, ""));
    const claims = await prisma.paymentClaim.findMany({
      where: { projectId, ...(Number.isFinite(claimNumber) && claimNumber > 0 ? { claimNumber } : { claimNumber: -1 }) },
      select: { id: true, claimNumber: true, status: true },
      take: 50
    });
    for (const claim of claims) {
      results.push({
        recordType: "claim",
        id: claim.id,
        reference: `Claim #${claim.claimNumber}`,
        title: `Claim #${claim.claimNumber}`,
        href: `/projects/${projectId}/payment-claims#${claim.id}`,
        closed: claim.status === "responded"
      });
    }
  }

  if (canDiary) {
    const entries = await prisma.update.findMany({
      where: { projectId, parentId: null, OR: [{ body: contains }, { externalSubject: contains }, { externalBody: contains }] },
      select: { id: true, body: true },
      take: 50
    });
    for (const entry of entries) {
      results.push({
        recordType: "project_diary",
        id: entry.id,
        reference: null,
        title: entry.body.length > 80 ? `${entry.body.slice(0, 80)}...` : entry.body || "(no text)",
        href: `/projects/${projectId}/updates#${entry.id}`,
        closed: false
      });
    }
  }

  if (canCorrespondence) {
    const correspondence = await prisma.correspondence.findMany({
      where: { projectId, title: contains },
      select: { id: true, title: true, variationItemId: true },
      take: 50
    });
    for (const item of correspondence) {
      results.push({
        recordType: "correspondence",
        id: item.id,
        reference: null,
        title: item.title,
        href: item.variationItemId ? `/projects/${projectId}/variations/${item.variationItemId}` : `/projects/${projectId}/correspondence`,
        closed: false
      });
    }
  }

  return results;
}
