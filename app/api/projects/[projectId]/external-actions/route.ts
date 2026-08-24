import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { createAndSendExternalAction } from "@/lib/external-action";
import { EXTERNAL_ACTION_TYPES } from "@/lib/external-action-types";

const requestSchema = z
  .object({
    variationItemId: z.string().optional(),
    dayWorksSheetId: z.string().optional(),
    type: z.enum(EXTERNAL_ACTION_TYPES as [string, ...string[]]),
    message: z.string().optional(),
    contactId: z.string().optional(),
    email: z.string().email().optional()
  })
  .refine((data) => Boolean(data.variationItemId) !== Boolean(data.dayWorksSheetId), {
    message: "Exactly one of a Variation/SI or a Day Works Sheet must be set."
  })
  .refine((data) => Boolean(data.contactId) || Boolean(data.email), {
    message: "Select a contact or enter an email address."
  });

async function moduleForRequest(projectId: string, payload: { variationItemId?: string; dayWorksSheetId?: string }) {
  const itemId = payload.variationItemId
    ? payload.variationItemId
    : (await prisma.dayWorksSheet.findFirst({ where: { id: payload.dayWorksSheetId, variationItem: { projectId } }, select: { variationItemId: true } }))
        ?.variationItemId;
  if (!itemId) return null;
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

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

  const module_ = await moduleForRequest(projectId, payload);
  if (!module_) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, module_);
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const baseUrl = process.env.AUTH_URL ?? "";
  const result = await createAndSendExternalAction({
    projectId,
    variationItemId: payload.variationItemId,
    dayWorksSheetId: payload.dayWorksSheetId,
    type: payload.type as (typeof EXTERNAL_ACTION_TYPES)[number],
    message: payload.message?.trim() || undefined,
    recipient: { contactId: payload.contactId, email: payload.email },
    sentByUserId: userId,
    baseUrl
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
