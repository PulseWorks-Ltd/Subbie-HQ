import { prisma } from "./prisma";

// Single source of truth for the platform-admin gate — used by the
// /platform-admin page AND every API route under it, so the check is never
// duplicated (and never silently drifts) across the three places that need
// it. Always re-reads from the database rather than trusting the session/JWT
// — isPlatformAdmin is only ever set via a direct DB write (never through
// any UI), so a session issued before that write must still see the
// up-to-date value without requiring a fresh login.
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isPlatformAdmin: true } });
  return user?.isPlatformAdmin ?? false;
}
