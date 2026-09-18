import { NextResponse } from "next/server";
import { sweepUnenrichedCommercialReviewItems } from "@/lib/commercial-review";

// Triggered nightly by a Railway Cron Job service running:
//   curl -fsS -X POST "$APP_URL/api/cron/detect-commercial-items" -H "Authorization: Bearer $CRON_SECRET"
// Same shared-secret, cron-hitting-HTTP-endpoint pattern as
// app/api/cron/classify-inbound-emails. A nightly interval is enough here
// (unlike the 2-minute grace period on that email sweep) — Commercial
// Review items already show on the dashboard the instant they're created
// (see lib/commercial-review.ts's evaluateUpdateForCommercialReview,
// awaited synchronously at Update create/PATCH time); this sweep only
// retries AI enrichment (the plain-English rationale) for rows whose
// fire-and-forget attempt never completed, which is lower urgency.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sweepUnenrichedCommercialReviewItems();
  return NextResponse.json(result);
}
