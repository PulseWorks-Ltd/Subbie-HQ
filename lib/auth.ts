import { auth } from "@/auth";
import { prisma } from "./prisma";

export async function getUserIdFromRequest(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireUserId(request: Request): Promise<string | null> {
  void request;
  return getUserIdFromRequest();
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
