import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";

export async function DELETE(request: Request, context: { params: { inviteId: string } }) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.organisationInvite.delete({
    where: { id: context.params.inviteId, organisationId: admin.organisationId }
  });

  return NextResponse.json({ ok: true });
}
