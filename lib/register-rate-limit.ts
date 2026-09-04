import { prisma } from "./prisma";

// Anti-abuse throttle for the public /api/auth/register endpoint. Deliberately
// different from lib/login-rate-limit.ts and lib/public-token-rate-limit.ts,
// both of which only record FAILED attempts so a legitimate user's own retry
// never spends their budget — there's no equivalent "legitimate retry" here:
// a genuine signup only ever submits this form once, so every call is
// recorded regardless of outcome. Checked on two independent axes — an
// attacker probing many email addresses from one IP is capped by the IP
// bound, and one hammering a single email (e.g. to trigger repeated welcome
// emails, or just to burn bcrypt-hashing cost) is capped by the email bound,
// each with its own window/limit rather than sharing one counter.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS_PER_IP = 10;
const RATE_LIMIT_MAX_ATTEMPTS_PER_EMAIL = 5;

export async function isRegisterRateLimited(ipAddress: string, email: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const [ipCount, emailCount] = await Promise.all([
    prisma.registerAttempt.count({ where: { ipAddress, createdAt: { gte: since } } }),
    prisma.registerAttempt.count({ where: { email, createdAt: { gte: since } } })
  ]);
  return ipCount >= RATE_LIMIT_MAX_ATTEMPTS_PER_IP || emailCount >= RATE_LIMIT_MAX_ATTEMPTS_PER_EMAIL;
}

export async function recordRegisterAttempt(ipAddress: string, email: string): Promise<void> {
  await prisma.registerAttempt.create({ data: { ipAddress, email } });
}
