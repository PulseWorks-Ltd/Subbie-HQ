import { NextResponse } from "next/server";
import { runReminderCheck } from "@/lib/reminders";

// Triggered once daily by a Railway Cron Job service running:
//   curl -fsS -X POST "$APP_URL/api/cron/reminders" -H "Authorization: Bearer $CRON_SECRET"
// A cron-hitting-HTTP-endpoint approach (rather than an in-process node-cron
// timer) was chosen deliberately: this app can run multiple web replicas, and
// an in-process timer would fire once per replica — duplicating every
// reminder. Railway's Cron service runs the command exactly once regardless
// of how many web replicas exist, with no new infrastructure dependency.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runReminderCheck();
  return NextResponse.json(summary);
}
