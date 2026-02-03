import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

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

  const evidence = await prisma.evidence.findMany({
    where: { projectId },
    include: {
      inboundEmail: true,
      scopeLinks: true,
      programmeLinks: true,
      paymentClaimLinks: true
    },
    orderBy: { uploadedAt: "desc" }
  });

  return NextResponse.json({ evidence });
}
