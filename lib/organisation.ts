import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function getOrganisationMembership(userId: string) {
  return prisma.organisationMember.findFirst({
    where: { userId },
    include: { organisation: true, user: true }
  });
}

export async function requireOrganisationAdmin(userId: string) {
  const membership = await getOrganisationMembership(userId);
  if (!membership?.isAdmin) return null;
  return membership;
}

/**
 * A user can see a project if it belongs to their organisation, or — for
 * legacy projects with no organisation — if they're an explicit ProjectMember.
 */
export async function getVisibleProjectsWhere(userId: string): Promise<Prisma.ProjectWhereInput> {
  const membership = await prisma.organisationMember.findFirst({ where: { userId }, select: { organisationId: true } });

  return {
    OR: [
      ...(membership ? [{ organisationId: membership.organisationId }] : []),
      { organisationId: null, members: { some: { userId } } }
    ]
  };
}
