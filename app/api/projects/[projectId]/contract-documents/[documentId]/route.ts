import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

const updateDocumentSchema = z.object({
  status: z.enum(["draft", "parsed", "confirmed"])
});

export async function PATCH(
  request: Request,
  context: { params: { projectId: string; documentId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, documentId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = updateDocumentSchema.parse(await request.json());

  const document = await prisma.contractDocument.update({
    where: { id: documentId, projectId },
    data: { status: payload.status }
  });

  return NextResponse.json({ document });
}
