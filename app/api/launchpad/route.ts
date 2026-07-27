import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getLaunchpadProjects } from "@/lib/launchpad";

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await getLaunchpadProjects(userId);

  return NextResponse.json({ projects });
}
