import { prisma } from "./prisma";

// Same per-email, DB-row-count-in-a-sliding-window throttle as
// lib/password-reset.ts's requestPasswordReset — counting rows created in
// the last N minutes rather than an in-memory counter, since serverless
// invocations don't reliably share memory anyway.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

export async function isLoginRateLimited(email: string): Promise<boolean> {
  const recentCount = await prisma.loginAttempt.count({
    where: { email, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } }
  });
  return recentCount >= RATE_LIMIT_MAX_ATTEMPTS;
}

export async function recordFailedLoginAttempt(email: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { email } });
}
