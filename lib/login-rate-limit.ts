import { prisma } from "./prisma";

// Same per-email, DB-row-count-in-a-sliding-window throttle as
// lib/password-reset.ts's requestPasswordReset — counting rows created in
// the last N minutes rather than an in-memory counter, since serverless
// invocations don't reliably share memory anyway.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

// Coarser secondary bound, keyed by source IP instead of email — added
// alongside the per-email limiter above, not instead of it. The per-email
// bound alone never notices a single IP spraying many different addresses
// (each one only ever accumulates a couple of failures, well under 5), so
// this catches that pattern with a much higher threshold tuned to normal
// office/site Wi-Fi (several people can genuinely share one IP and
// occasionally mistype a password within the same window).
const IP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const IP_RATE_LIMIT_MAX_ATTEMPTS = 30;

export async function isLoginRateLimited(email: string): Promise<boolean> {
  const recentCount = await prisma.loginAttempt.count({
    where: { email, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } }
  });
  return recentCount >= RATE_LIMIT_MAX_ATTEMPTS;
}

export async function isLoginRateLimitedByIp(ipAddress: string): Promise<boolean> {
  const recentCount = await prisma.loginAttempt.count({
    where: { ipAddress, createdAt: { gte: new Date(Date.now() - IP_RATE_LIMIT_WINDOW_MS) } }
  });
  return recentCount >= IP_RATE_LIMIT_MAX_ATTEMPTS;
}

export async function recordFailedLoginAttempt(email: string, ipAddress?: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { email, ipAddress } });
}
