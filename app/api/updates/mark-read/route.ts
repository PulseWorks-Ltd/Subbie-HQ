import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { markUpdatesRead } from "@/lib/updates-feed";

const requestSchema = z.object({ updateIds: z.array(z.string().min(1)).min(1) });

// Handles both a single-item and a bulk "mark read" action — the Dashboard
// row action just sends a one-element array.
export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = requestSchema.parse(await request.json());
  await markUpdatesRead(userId, payload.updateIds);

  return NextResponse.json({ ok: true });
}
