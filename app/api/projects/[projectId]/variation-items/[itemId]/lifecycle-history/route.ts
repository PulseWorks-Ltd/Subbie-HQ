import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getLifecycleHistory } from "@/lib/record-lifecycle-log";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

// The full close/reactivate/close... timeline for one record — what
// answers "why was this reopened three weeks later."
export async function GET(request: Request, context: { params: { projectId: string; itemId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, itemId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const module_ = await moduleForItem(projectId, itemId);
  if (!module_) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await requireModuleAccess(projectId, userId, module_))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const history = await getLifecycleHistory("variation_item", itemId);
  return NextResponse.json({
    history: history.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      previousState: event.previousState,
      newState: event.newState,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
      userName: [event.user.firstName, event.user.lastName].filter(Boolean).join(" ") || event.user.email
    }))
  });
}
