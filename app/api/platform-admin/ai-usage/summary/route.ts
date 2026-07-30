import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { getUsageSummary, type UsagePeriod } from "@/lib/ai-usage-queries";

const VALID_PERIODS: UsagePeriod[] = ["this_month", "last_30_days", "all_time"];

// Same 404 (not 401/403) as the page itself — never confirm to a
// non-platform-admin, even via a direct API call, that this route exists.
export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId || !(await isPlatformAdmin(userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period");
  const period: UsagePeriod = VALID_PERIODS.includes(periodParam as UsagePeriod) ? (periodParam as UsagePeriod) : "this_month";

  const summary = await getUsageSummary(period);
  return NextResponse.json({ period, ...summary });
}
