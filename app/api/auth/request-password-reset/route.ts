import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/password-reset";

const requestSchema = z.object({ email: z.string().email() });

// Same generic message shown to the user regardless of whether the email
// matched a real account — see lib/password-reset.ts's requestPasswordReset
// for why that email/no-email distinction is invisible in both the
// response body AND response timing (a min-response-time pad below).
const GENERIC_MESSAGE = "If an account exists for that email, we've sent a reset link.";

// Deliberately not gated by requireUserId — this is the unauthenticated
// "I forgot my password" entry point.
export async function POST(request: Request) {
  const startedAt = Date.now();
  const payload = requestSchema.parse(await request.json());

  const baseUrl = process.env.AUTH_URL || new URL(request.url).origin;
  await requestPasswordReset(payload.email, baseUrl);

  // Pads the response to a fixed minimum so a real-account request (extra
  // DB writes, though never the SendGrid call itself — see
  // requestPasswordReset) can't be timed apart from a non-existent one.
  const MIN_RESPONSE_MS = 300;
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
  }

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
