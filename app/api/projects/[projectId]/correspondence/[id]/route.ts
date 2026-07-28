import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

export async function DELETE(request: Request, context: { params: { projectId: string; id: string } }) {
  const userId = await requireUserId(request);
  const { projectId, id } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canAccessModule = await requireModuleAccess(projectId, userId, "correspondence");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const correspondence = await prisma.correspondence.findFirst({ where: { id, projectId } });
  if (!correspondence) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (correspondence.source !== "upload") {
    return NextResponse.json({ error: "Received emails can't be deleted here." }, { status: 400 });
  }

  if (correspondence.storageKey) {
    await deleteFromS3(correspondence.storageKey).catch(() => {});
  }
  await prisma.correspondence.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
