import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { sendExternalUpdateAndLog } from "@/lib/external-update";

// Retries sending an external update whose initial send failed — the
// update, its recipients, and its final subject/body were already
// persisted when it was created, so nothing needs to be re-entered.
export async function POST(request: Request, context: { params: { projectId: string; updateId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, updateId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "updates");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update = await prisma.update.findFirst({ where: { id: updateId, projectId } });
  if (!update) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await sendExternalUpdateAndLog(updateId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
