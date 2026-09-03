import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";

export async function DELETE(request: Request, context: { params: { projectId: string; entryId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, entryId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "payment_claims");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entry = await prisma.contractItemProgressEntry.findFirst({
    where: {
      id: entryId,
      OR: [
        { phase: { component: { contractItem: { schedule: { projectId } } } } },
        { component: { contractItem: { schedule: { projectId } } } }
      ]
    }
  });
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.contractItemProgressEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ ok: true });
}
