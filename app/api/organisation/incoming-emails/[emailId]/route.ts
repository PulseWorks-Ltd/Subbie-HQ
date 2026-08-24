import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireUserId } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";
import { classifyAndSuggest, dismissInboundEmail, fileInboundEmail } from "@/lib/inbound-email";

const createVariationItemSchema = z.object({
  type: z.enum(["variation", "site_instruction"]),
  reference: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  notifiedAt: z.string().date().optional(),
  dueAt: z.string().date().optional()
});

const createQaRecordSchema = z.object({
  stage: z.string().min(1),
  // Project-level (no item) when omitted — see QARecord's schema comment.
  variationItemId: z.string().optional()
});

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("file"),
    projectId: z.string().min(1),
    category: z.string().min(1),
    // Mutually exclusive: link to an existing item, or (once the reviewer
    // has confirmed the AI-extracted details) create a brand-new one, or
    // file straight to a QA record instead of Correspondence-only.
    variationItemId: z.string().optional(),
    createVariationItem: createVariationItemSchema.optional(),
    createQaRecord: createQaRecordSchema.optional()
  }),
  z.object({ action: z.literal("dismiss") }),
  z.object({ action: z.literal("reclassify") })
]);

function moduleForType(type: "variation" | "site_instruction") {
  return type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

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

  if (payload.action === "reclassify") {
    // Awaited here (unlike the webhook's fire-and-forget call) — this is a
    // deliberate user action clicking "Retry," so the response should
    // reflect the actual outcome rather than returning immediately.
    await classifyAndSuggest(emailId, userId);
    const updated = await prisma.inboundEmail.findUnique({ where: { id: emailId } });
    if (updated?.classificationError) {
      return NextResponse.json({ error: updated.classificationError }, { status: 422 });
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
  if (payload.createVariationItem) {
    // Being able to see the org-wide Incoming Emails queue doesn't imply
    // having Variations/Site Instructions access on this specific project —
    // re-check before letting this action create anything there.
    const canCreateItem = await requireModuleAccess(project.id, userId, moduleForType(payload.createVariationItem.type));
    if (!canCreateItem) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (payload.createQaRecord) {
    // Same re-check as createVariationItem above, gated on Quality
    // Assurance instead.
    const canCreateQaRecord = await requireModuleAccess(project.id, userId, "quality_assurance");
    if (!canCreateQaRecord) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (payload.createQaRecord.variationItemId) {
      const item = await prisma.variationItem.findFirst({
        where: { id: payload.createQaRecord.variationItemId, projectId: project.id }
      });
      if (!item) {
        return NextResponse.json({ error: "Variation/Site Instruction not found on this project." }, { status: 400 });
      }
    }
  }

  const result = await fileInboundEmail({
    emailId,
    projectId: project.id,
    category: payload.category,
    variationItemId: payload.variationItemId,
    createVariationItem: payload.createVariationItem,
    createQaRecord: payload.createQaRecord,
    reviewerUserId: userId
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
