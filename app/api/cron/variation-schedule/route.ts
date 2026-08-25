import { NextResponse } from "next/server";
import { runVariationScheduleSweep } from "@/lib/variation-schedule";

// Triggered once daily by a Railway Cron Job service running:
//   curl -fsS -X POST "$APP_URL/api/cron/variation-schedule" -H "Authorization: Bearer $CRON_SECRET"
// Same shared secret and cron-hitting-HTTP-endpoint pattern as
// app/api/cron/reminders (see that file's comment for why — multiple web
// replicas, exactly-once via Railway's Cron service rather than an
// in-process timer). Idempotent by design (see runVariationScheduleSweep's
// VariationScheduleRun status machine), so running this more than once on
// the same day is always safe.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runVariationScheduleSweep();
  return NextResponse.json(summary);
}
