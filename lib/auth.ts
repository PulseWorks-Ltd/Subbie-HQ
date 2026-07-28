import { auth } from "@/auth";
import { prisma } from "./prisma";
import { hasModuleAccess, type ModuleKey } from "./permissions";

export async function getUserIdFromRequest(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireUserId(request: Request): Promise<string | null> {
  void request;
  return getUserIdFromRequest();
}

/**
 * A project belonging to an organisation is visible to any member of that
 * organisation (subject to per-module permissions checked separately via
 * requireModuleAccess) — ProjectMember is only consulted for legacy projects
 * with no organisation, where it remains the sole, unrestricted gate.
 */
export async function requireProjectAccess(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
  if (!project) return false;

  if (project.organisationId) {
    const membership = await prisma.organisationMember.findUnique({
      where: { organisationId_userId: { organisationId: project.organisationId, userId } }
    });
    return Boolean(membership);
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } }
  });
  return Boolean(membership);
}

/**
 * Finer-grained than requireProjectAccess: for projects with no organisation
 * (legacy/personal), access is unrestricted once requireProjectAccess passes.
 * For org-owned projects, the user additionally needs module access (or to
 * be an org Admin) via their OrganisationMember row.
 */
export async function requireModuleAccess(projectId: string, userId: string, module: ModuleKey): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
  if (!project) return false;
  if (!project.organisationId) return true;

  const membership = await prisma.organisationMember.findUnique({
    where: { organisationId_userId: { organisationId: project.organisationId, userId } }
  });
  return hasModuleAccess(membership, module);
}
