import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { HoursOnSiteApprovedError, getSheetWithDetail, updateSheet } from "@/lib/hours-on-site";

// Hours stay fully editable (a missed lunch deduction, a forgotten start
// time, someone who left and came back) right up until the sheet is
// approved via its secure external-action link — updateSheet() itself
// refuses once approvedAt is set, surfaced below as a 409.
const updateSchema = z.object({
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
  totalHours: z.number().min(0).nullable().optional(),
  comments: z.string().nullable().optional()
});

export async function GET(request: Request, context: { params: { projectId: string; sheetId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, sheetId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sheet = await getSheetWithDetail(sheetId);
  if (!sheet || sheet.projectId !== projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ sheet });
}

export async function PATCH(request: Request, context: { params: { projectId: string; sheetId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, sheetId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.hoursOnSiteSheet.findFirst({ where: { id: sheetId, projectId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = updateSchema.parse(await request.json());
  try {
    const sheet = await updateSheet(sheetId, {
      startedAt: payload.startedAt ? new Date(payload.startedAt) : undefined,
      finishedAt: payload.finishedAt === undefined ? undefined : payload.finishedAt ? new Date(payload.finishedAt) : null,
      totalHours: payload.totalHours,
      comments: payload.comments
    });
    return NextResponse.json({ sheet });
  } catch (error) {
    if (error instanceof HoursOnSiteApprovedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
