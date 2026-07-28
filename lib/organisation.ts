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
