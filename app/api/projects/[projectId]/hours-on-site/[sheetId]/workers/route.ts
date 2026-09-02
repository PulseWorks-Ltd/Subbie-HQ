import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { addWorkerToSheet, removeWorkerFromSheet, findOrCreateWorker, getSheetWithDetail } from "@/lib/hours-on-site";

const addSchema = z.object({
  // Either an existing worker's id (picked from the type-ahead list) or a
  // brand-new name (creates it, then adds it) — never both.
  workerId: z.string().optional(),
  name: z.string().optional()
});
const removeSchema = z.object({ workerId: z.string() });

export async function POST(request: Request, context: { params: { projectId: string; sheetId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, sheetId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sheet = await prisma.hoursOnSiteSheet.findFirst({ where: { id: sheetId, projectId } });
  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = addSchema.parse(await request.json());
  if (!payload.workerId && !payload.name) {
    return NextResponse.json({ error: "Select a worker or enter a name." }, { status: 400 });
  }

  let workerId = payload.workerId;
  if (!workerId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
    if (!project?.organisationId) {
      return NextResponse.json({ error: "This project has no worker directory to add a new name to." }, { status: 400 });
    }
    const worker = await findOrCreateWorker(project.organisationId, payload.name!);
    workerId = worker.id;
  }

  await addWorkerToSheet({ sheetId, workerId });
  const updated = await getSheetWithDetail(sheetId);
  return NextResponse.json({ sheet: updated }, { status: 201 });
}

export async function DELETE(request: Request, context: { params: { projectId: string; sheetId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, sheetId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sheet = await prisma.hoursOnSiteSheet.findFirst({ where: { id: sheetId, projectId } });
  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = removeSchema.parse(await request.json());
  await removeWorkerFromSheet({ sheetId, workerId: payload.workerId });
  const updated = await getSheetWithDetail(sheetId);
  return NextResponse.json({ sheet: updated });
}
