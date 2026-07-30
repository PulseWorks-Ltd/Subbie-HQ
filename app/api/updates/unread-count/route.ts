import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getUnreadUpdateCount } from "@/lib/updates-feed";

// Polled by the tab-title/favicon indicator (see
// components/dashboard/unread-updates-indicator.tsx) — deliberately
// lightweight, just a count, not the full feed.
export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await getUnreadUpdateCount(userId);
  return NextResponse.json({ count });
}
