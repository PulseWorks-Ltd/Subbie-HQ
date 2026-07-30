import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { getUsageLogs, getUsageFilterOptions } from "@/lib/ai-usage-queries";

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId || !(await isPlatformAdmin(userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const feature = url.searchParams.get("feature") || undefined;
  const organisationId = url.searchParams.get("organisationId") || undefined;
  const successParam = url.searchParams.get("success");
  const success = successParam === "true" ? true : successParam === "false" ? false : undefined;
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const pageParam = Number(url.searchParams.get("page") ?? "1");

  const [result, filterOptions] = await Promise.all([
    getUsageLogs({
      feature,
      organisationId,
      success,
      from: fromParam ? new Date(fromParam) : undefined,
      to: toParam ? new Date(toParam) : undefined,
      page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
    }),
    getUsageFilterOptions()
  ]);

  return NextResponse.json({ ...result, filterOptions });
}
