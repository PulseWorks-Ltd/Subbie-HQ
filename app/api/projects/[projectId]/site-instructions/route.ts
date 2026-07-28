import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";

const createSiteInstructionSchema = z.object({
  reference: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  notifiedAt: z.string().date().optional(),
  dueAt: z.string().date().optional(),
  fileName: z.string().optional(),
  storageKey: z.string().optional()
});

export async function GET(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canAccessModule = await requireModuleAccess(projectId, userId, "site_instructions");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const siteInstructions = await prisma.siteInstruction.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ siteInstructions });
}

export async function POST(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canAccessModule = await requireModuleAccess(projectId, userId, "site_instructions");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = createSiteInstructionSchema.parse(await request.json());

  const siteInstruction = await prisma.siteInstruction.create({
    data: {
      projectId,
      reference: payload.reference,
      title: payload.title,
      description: payload.description,
      notifiedAt: payload.notifiedAt ? new Date(payload.notifiedAt) : undefined,
      dueAt: payload.dueAt ? new Date(payload.dueAt) : undefined,
      fileName: payload.fileName,
      storageKey: payload.storageKey
    }
  });

  return NextResponse.json({ siteInstruction }, { status: 201 });
}
