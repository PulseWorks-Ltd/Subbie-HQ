import { prisma } from "./prisma";

// Anti-abuse throttle for the /get-app "Send Download Link" feature — every
// call recorded, not just failures, same reasoning as lib/register-rate-
// limit.ts: a genuine user only ever needs to invite a handful of real
// teammates, so there's no "legitimate retry" case to protect the way
// login/token rate limiting does. Keyed by the sender's userId (this
// requires a logged-in sender — see the route) rather than IP, which is
// both a more accurate signal (no shared-office-IP false positives) and a
// stronger one (directly caps what a single account can do, including a
// compromised one). email is bounded separately so one recipient can't be
// hammered with repeats even from several different sender accounts.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_PER_USER = 10;
const RATE_LIMIT_MAX_PER_EMAIL = 3;

export async function isDownloadLinkRateLimited(userId: string, email: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const [userCount, emailCount] = await Promise.all([
    prisma.downloadLinkRequest.count({ where: { userId, createdAt: { gte: since } } }),
    prisma.downloadLinkRequest.count({ where: { email, createdAt: { gte: since } } })
  ]);
  return userCount >= RATE_LIMIT_MAX_PER_USER || emailCount >= RATE_LIMIT_MAX_PER_EMAIL;
}

export async function recordDownloadLinkRequest(userId: string, email: string): Promise<void> {
  await prisma.downloadLinkRequest.create({ data: { userId, email } });
}
