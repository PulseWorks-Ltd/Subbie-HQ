import { NextResponse } from "next/server";
import { sweepUnclassifiedInboundEmails } from "@/lib/inbound-email";

// Triggered every few minutes by a Railway Cron Job service running:
//   curl -fsS -X POST "$APP_URL/api/cron/classify-inbound-emails" -H "Authorization: Bearer $CRON_SECRET"
// Same shared secret and cron-hitting-HTTP-endpoint approach as
// app/api/cron/reminders (see that file's comment for why) — this one needs
// a much shorter interval than the daily reminders cron, since it exists to
// promptly catch inbound emails whose fire-and-forget classification attempt
// (see lib/inbound-email.ts's classifyAndSuggest call in the webhook route)
// never completed.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sweepUnclassifiedInboundEmails();
  return NextResponse.json(result);
}
