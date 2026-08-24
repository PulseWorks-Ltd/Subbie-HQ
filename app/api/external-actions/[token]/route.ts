import { NextResponse } from "next/server";
import { z } from "zod";
import { getExternalActionForToken, submitExternalActionResponse } from "@/lib/external-action";
import {
  getClientIp,
  isExternalActionLookupRateLimited,
  recordFailedExternalActionLookup
} from "@/lib/external-action-rate-limit";

// Genuinely public — no auth of any kind. Both handlers below are the
// ENTIRE public surface for this feature (Task 3.3): a valid token
// resolves to exactly one record's own reference/title/description (or
// sheet filename) and nothing else — no projectId, no other items, no
// organisation data. Rate-limited per source IP on failed lookups, on top
// of the token's own 256 bits of randomness already making guessing
// infeasible.
export async function GET(request: Request, context: { params: { token: string } }) {
  const ip = getClientIp(request);
  if (await isExternalActionLookupRateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const result = await getExternalActionForToken(context.params.token);
  if (!result.ok) {
    await recordFailedExternalActionLookup(ip);
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ context: result.context });
}

const responseSchema = z.object({
  choice: z.enum(["approved", "rejected"]).optional(),
  name: z.string().min(1),
  comment: z.string().optional()
});

export async function POST(request: Request, context: { params: { token: string } }) {
  const ip = getClientIp(request);
  if (await isExternalActionLookupRateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const payload = responseSchema.parse(await request.json());
  const result = await submitExternalActionResponse(context.params.token, payload);

  if (!result.ok) {
    await recordFailedExternalActionLookup(ip);
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
