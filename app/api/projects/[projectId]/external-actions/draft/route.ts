import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { computeValueSnapshot, moduleForExternalActionTarget, requiresValueSnapshot } from "@/lib/external-action";
import { draftExternalActionRequestMessage, draftPackageApprovalMessage } from "@/lib/grok";
import { AiSpendCapExceededError } from "@/lib/ai-usage";
import { EXTERNAL_ACTION_TYPES } from "@/lib/external-action-types";

const requestSchema = z
  .object({
    variationItemId: z.string().optional(),
    dayWorksSheetId: z.string().optional(),
    // Only valid alongside variationItemId, and only with type: "approve" —
    // Request Approval on a package is always an approval ask, never the
    // other five generic types.
    variationPackageId: z.string().optional(),
    type: z.enum(EXTERNAL_ACTION_TYPES as [string, ...string[]])
  })
  .refine((data) => Boolean(data.variationItemId) !== Boolean(data.dayWorksSheetId), {
    message: "Exactly one of a Variation/SI or a Day Works Sheet must be set."
  })
  .refine((data) => !data.variationPackageId || data.type === "approve", {
    message: "A package approval request must be type: approve."
  });

// Drafts the message shown to the recipient — reused fresh every time the
// composer's type changes, so the sender reviews and can edit it before
// anything sends (Task 1.3). The value snapshot computed here is a
// PREVIEW only; the actual send route (see ../route.ts) recomputes and
// freezes its own copy at the moment of sending, never trusting this
// route's figures.
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

  const payload = requestSchema.parse(await request.json());
  const type = payload.type as (typeof EXTERNAL_ACTION_TYPES)[number];

  if (!requiresValueSnapshot(type)) {
    return NextResponse.json({ error: "This action type doesn't need a drafted message." }, { status: 400 });
  }

  const module_ = await moduleForExternalActionTarget(projectId, payload);
  if (!module_) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, module_);
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let itemReference: string;
  let itemTitle: string;
  let isSiteInstruction: boolean;
  let variationItemId: string;

  if (payload.dayWorksSheetId) {
    const sheet = await prisma.dayWorksSheet.findFirst({
      where: { id: payload.dayWorksSheetId, variationItem: { projectId } },
      include: { variationItem: { select: { id: true, reference: true, title: true, type: true } } }
    });
    if (!sheet) {
      return NextResponse.json({ error: "Day Works Sheet not found." }, { status: 404 });
    }
    variationItemId = sheet.variationItem.id;
    itemReference = sheet.variationItem.reference;
    itemTitle = sheet.variationItem.title;
    isSiteInstruction = sheet.variationItem.type === "site_instruction";
  } else {
    const item = await prisma.variationItem.findFirst({ where: { id: payload.variationItemId, projectId } });
    if (!item) {
      return NextResponse.json({ error: "Variation/Site Instruction not found." }, { status: 404 });
    }
    variationItemId = item.id;
    itemReference = item.reference;
    itemTitle = item.title;
    isSiteInstruction = item.type === "site_instruction";
  }

  if (payload.variationPackageId) {
    const pkg = await prisma.variationPackage.findFirst({
      where: { id: payload.variationPackageId, variationItemId }
    });
    if (!pkg) {
      return NextResponse.json({ error: "Variation Package not found on this item." }, { status: 404 });
    }
  }

  const [snapshot, project] = await Promise.all([
    computeValueSnapshot({
      projectId,
      variationItemId,
      dayWorksSheetId: payload.dayWorksSheetId,
      variationPackageId: payload.variationPackageId
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } })
  ]);

  try {
    if (payload.variationPackageId) {
      const drafted = await draftPackageApprovalMessage(
        {
          itemReference,
          itemTitle,
          isSiteInstruction,
          cumulativeTotal: snapshot.combinedTotal,
          newSinceLastTotal: snapshot.previousPackage ? snapshot.combinedTotal - snapshot.previousPackage.grandTotal : null
        },
        { organisationId: project?.organisationId, userId }
      );
      return NextResponse.json({ messageBody: drafted.messageBody });
    }

    const valueContextLabel = payload.dayWorksSheetId
      ? "this Day Works Sheet's recorded labour"
      : snapshot.dayWorksSheets.length > 0
        ? `${snapshot.dayWorksSheets.length} Day Works Sheet${snapshot.dayWorksSheets.length === 1 ? "" : "s"}, materials, and plant recorded against this item`
        : "materials and plant recorded against this item";

    const drafted = await draftExternalActionRequestMessage(
      {
        actionTypeLabel: type.charAt(0).toUpperCase() + type.slice(1),
        itemReference,
        itemTitle,
        isSiteInstruction,
        recordedValue: snapshot.combinedTotal > 0 ? snapshot.combinedTotal : null,
        valueContextLabel
      },
      { organisationId: project?.organisationId, userId }
    );
    return NextResponse.json({ messageBody: drafted.messageBody });
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
