import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";
import { dismissInboundEmail, fileInboundEmail } from "@/lib/inbound-email";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("file"),
    projectId: z.string().min(1),
    category: z.string().min(1),
    variationItemId: z.string().optional()
  }),
  z.object({ action: z.literal("dismiss") })
]);

export async function PATCH(request: Request, context: { params: { emailId: string } }) {
  const userId = await requireUserId(request);
  const { emailId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await getOrganisationMembership(userId);
  if (!hasModuleAccess(membership, "incoming_emails")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = await prisma.inboundEmail.findFirst({
    where: { id: emailId, organisationId: membership!.organisationId }
  });
  if (!email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = patchSchema.parse(await request.json());

  if (payload.action === "dismiss") {
    const result = await dismissInboundEmail(emailId, userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  // action === "file" — the target project must belong to this same
  // organisation (never trust a client-supplied projectId on its own).
  const project = await prisma.project.findFirst({
    where: { id: payload.projectId, organisationId: membership!.organisationId }
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 400 });
  }
  if (payload.variationItemId) {
    const variationItem = await prisma.variationItem.findFirst({
      where: { id: payload.variationItemId, projectId: project.id }
    });
    if (!variationItem) {
      return NextResponse.json({ error: "Variation/Site Instruction not found on this project." }, { status: 400 });
    }
  }

  const result = await fileInboundEmail({
    emailId,
    projectId: project.id,
    category: payload.category,
    variationItemId: payload.variationItemId,
    reviewerUserId: userId
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
