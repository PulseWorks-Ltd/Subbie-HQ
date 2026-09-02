import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { finishSheet } from "@/lib/hours-on-site";

export async function POST(request: Request, context: { params: { projectId: string; sheetId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, sheetId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.hoursOnSiteSheet.findFirst({ where: { id: sheetId, projectId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sheet = await finishSheet(sheetId);
  return NextResponse.json({ sheet });
}
