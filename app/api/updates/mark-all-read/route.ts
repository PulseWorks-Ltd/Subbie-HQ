import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { markAllUpdatesRead } from "@/lib/updates-feed";

export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const markedCount = await markAllUpdatesRead(userId);
  return NextResponse.json({ ok: true, markedCount });
}
