import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { startSheet, listSheetsForProject, getActiveSheet } from "@/lib/hours-on-site";

// No dedicated permission module — same call as Tasks (a cross-cutting
// feature, gated by plain project access rather than adding a new module
// every existing org's permission presets would need updating for).
const startSchema = z.object({
  variationItemId: z.string().optional(),
  comments: z.string().optional()
});

export async function GET(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [sheets, activeSheet] = await Promise.all([listSheetsForProject(projectId), getActiveSheet(projectId, userId)]);
  return NextResponse.json({ sheets, activeSheet });
}

export async function POST(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = startSchema.parse(await request.json());

  if (payload.variationItemId) {
    const item = await prisma.variationItem.findFirst({
      where: { id: payload.variationItemId, projectId, type: "site_instruction" }
    });
    if (!item) return NextResponse.json({ error: "Site Instruction not found in this project." }, { status: 400 });
  }

  // One active session per user per project at a time — starting again
  // while one's already running just resumes it rather than creating a
  // second, confusing, overlapping sheet.
  const existingActive = await getActiveSheet(projectId, userId);
  if (existingActive) {
    return NextResponse.json({ sheet: existingActive }, { status: 200 });
  }

  const sheet = await startSheet({
    projectId,
    variationItemId: payload.variationItemId,
    comments: payload.comments,
    userId
  });
  return NextResponse.json({ sheet }, { status: 201 });
}
