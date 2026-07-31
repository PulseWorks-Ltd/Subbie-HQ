import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { sendPasswordResetEmail } from "./email";
import { formatUserName } from "./user-display";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, per the task brief
// Per-email throttle, not per-IP — the actual threat this guards against
// ("can't be used to spam an inbox with reset emails") is scoped to one
// mailbox regardless of source IP, and it naturally only ever applies to a
// REAL account: an email with no matching user never creates a row here at
// all, so there's nothing to count or throttle for it.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 3;

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// Always resolves and never throws or returns anything that would let a
// caller distinguish "email matched a real account" from "it didn't" —
// callers (app/api/auth/request-password-reset/route.ts) must show the
// exact same response either way. The actual SendGrid send is fired
// unawaited on purpose: awaiting it here would make a real-account request
// measurably slower than a non-existent one (SendGrid's network round
// trip), leaking account existence via response timing even with identical
// response bodies.
export async function requestPasswordReset(rawEmail: string, baseUrl: string): Promise<void> {
  const email = rawEmail.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, lastName: true }
  });
  if (!user) return;

  const recentCount = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } }
  });
  if (recentCount >= RATE_LIMIT_MAX_REQUESTS) return;

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) }
  });

  const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
  void sendPasswordResetEmail({ to: user.email, name: formatUserName(user) ?? user.email, resetUrl }).catch((error) => {
    console.error(`Failed to send password reset email to user ${user.id}:`, error);
  });
}

export type ResetPasswordResult = { ok: true } | { ok: false; error: string };

const INVALID_TOKEN_MESSAGE = "This reset link is no longer valid. Please request a new one.";

// One generic message covers "never existed," "expired," and "already
// used" alike — same don't-leak-more-than-necessary principle as
// requestPasswordReset, just lower stakes here since the raw token itself
// (not an email address) is the only thing an attacker could be probing.
export async function resetPassword(rawToken: string, newPassword: string): Promise<ResetPasswordResult> {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: INVALID_TOKEN_MESSAGE };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash, passwordChangedAt: now } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: now } })
  ]);

  return { ok: true };
}
