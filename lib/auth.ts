import { prisma } from "./prisma";

export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  // TODO: Replace with real session-based auth (e.g., NextAuth, Clerk, custom JWT)
  return request.headers.get("x-user-id");
}

export async function requireUserId(request: Request): Promise<string | null> {
  const userId = await getUserIdFromRequest(request);
  return userId ?? null;
}

export async function requireProjectAccess(projectId: string, userId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId
      }
    }
  });

  return Boolean(membership);
}
