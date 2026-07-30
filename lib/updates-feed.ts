import { prisma } from "./prisma";
import { getOrganisationMembership, getVisibleProjectsWhere } from "./organisation";
import { hasModuleAccess } from "./permissions";
import { formatUserName } from "./user-display";

const PREVIEW_LENGTH = 120;

function truncate(text: string, length: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= length) return collapsed;
  return `${collapsed.slice(0, length).trimEnd()}…`;
}

export type UnreadUpdateItem = {
  id: string;
  projectId: string;
  projectName: string;
  authorName: string;
  bodyPreview: string;
  createdAt: Date;
  variationItem: { id: string; reference: string } | null;
  href: string;
};

// Same cross-project visibility rule as lib/dashboard.ts's canSeeType: an
// org-scoped project only counts if the user has Updates module access;
// a legacy org-less project is always visible.
async function getVisibleProjectIdsForUpdates(userId: string): Promise<{ id: string; name: string }[]> {
  const membership = await getOrganisationMembership(userId);
  const canSeeUpdates = hasModuleAccess(membership, "updates");

  const projects = await prisma.project.findMany({
    where: await getVisibleProjectsWhere(userId),
    select: { id: true, name: true, organisationId: true }
  });

  return projects.filter((project) => !project.organisationId || canSeeUpdates);
}

export async function getUnreadUpdates(userId: string): Promise<UnreadUpdateItem[]> {
  const projects = await getVisibleProjectIdsForUpdates(userId);
  if (projects.length === 0) return [];
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));

  const updates = await prisma.update.findMany({
    where: {
      projectId: { in: projects.map((project) => project.id) },
      reads: { none: { userId } }
    },
    include: {
      author: { select: { firstName: true, lastName: true, email: true } },
      variationItem: { select: { id: true, reference: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return updates.map((update) => ({
    id: update.id,
    projectId: update.projectId,
    projectName: projectNameById.get(update.projectId) ?? "",
    authorName: formatUserName(update.author) ?? update.author.email,
    bodyPreview: truncate(update.body, PREVIEW_LENGTH),
    createdAt: update.createdAt,
    variationItem: update.variationItem,
    href: `/projects/${update.projectId}/updates?update=${update.id}`
  }));
}

// Lightweight version of the above for frequent polling (see the tab-title
// indicator) — skips fetching author/body/variationItem entirely.
export async function getUnreadUpdateCount(userId: string): Promise<number> {
  const projects = await getVisibleProjectIdsForUpdates(userId);
  if (projects.length === 0) return 0;

  return prisma.update.count({
    where: {
      projectId: { in: projects.map((project) => project.id) },
      reads: { none: { userId } }
    }
  });
}

// Client-supplied ids, so re-derive visibility rather than trusting the
// caller — an id for an update on a project this user can't see is just
// silently skipped rather than erroring.
export async function markUpdatesRead(userId: string, updateIds: string[]): Promise<void> {
  if (updateIds.length === 0) return;

  const visibleUpdates = await prisma.update.findMany({
    where: { id: { in: updateIds }, project: await getVisibleProjectsWhere(userId) },
    select: { id: true }
  });
  if (visibleUpdates.length === 0) return;

  await prisma.updateRead.createMany({
    data: visibleUpdates.map((update) => ({ userId, updateId: update.id })),
    skipDuplicates: true
  });
}

export async function markAllUpdatesRead(userId: string): Promise<number> {
  const projects = await getVisibleProjectIdsForUpdates(userId);
  if (projects.length === 0) return 0;

  const unread = await prisma.update.findMany({
    where: {
      projectId: { in: projects.map((project) => project.id) },
      reads: { none: { userId } }
    },
    select: { id: true }
  });
  if (unread.length === 0) return 0;

  await prisma.updateRead.createMany({
    data: unread.map((update) => ({ userId, updateId: update.id })),
    skipDuplicates: true
  });
  return unread.length;
}

// Visiting a project's Updates page already renders every Update on it in
// full (there's no separate list/detail split, see updates-view.tsx) — so
// "viewed the full detail" (Task 1.3) is satisfied by marking every Update
// on that project read as a side effect of loading the page. Also covers
// the Dashboard row's "click preview to navigate" case, since that
// navigates straight to this same page.
export async function markProjectUpdatesRead(projectId: string, userId: string): Promise<void> {
  const updates = await prisma.update.findMany({ where: { projectId }, select: { id: true } });
  if (updates.length === 0) return;

  await prisma.updateRead.createMany({
    data: updates.map((update) => ({ userId, updateId: update.id })),
    skipDuplicates: true
  });
}
