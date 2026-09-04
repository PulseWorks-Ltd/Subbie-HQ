import { prisma } from "./prisma";

// Same per-key, DB-row-count-in-a-sliding-window throttle as
// lib/login-rate-limit.ts, keyed by source IP rather than email — there's
// no email being submitted at token-lookup time, so IP is the only
// available signal for "someone trying many different token guesses."
// Shared by every public, no-login token-lookup route (external actions
// AND organisation invites): only FAILED lookups are recorded by each
// caller, so a legitimate recipient opening their own valid link never
// spends this budget. `scope` keeps each token type's attempt count
// independent — a burst of failed invite guesses must never eat into the
// external-action budget, or vice versa.
export type PublicTokenScope = "external-action" | "invite";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

export async function isPublicTokenLookupRateLimited(scope: PublicTokenScope, ipAddress: string): Promise<boolean> {
  const recentCount = await prisma.publicTokenLookupAttempt.count({
    where: { scope, ipAddress, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } }
  });
  return recentCount >= RATE_LIMIT_MAX_ATTEMPTS;
}

export async function recordFailedPublicTokenLookup(scope: PublicTokenScope, ipAddress: string): Promise<void> {
  await prisma.publicTokenLookupAttempt.create({ data: { scope, ipAddress } });
}

// Next.js doesn't expose a first-class "client IP" API for server
// components/route handlers behind a proxy — this reads the same header
// every reverse proxy (Railway included) sets, falling back to a shared
// "unknown" bucket if it's ever missing so the rate limit still applies
// to something rather than silently not applying at all.
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}
