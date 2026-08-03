import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";

const createVariationItemSchema = z.object({
  type: z.enum(["variation", "site_instruction"]),
  reference: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  notifiedAt: z.string().date().optional(),
  dueAt: z.string().date().optional(),
  fileName: z.string().optional(),
  storageKey: z.string().optional(),
  instructedByName: z.string().optional(),
  // Only meaningful for type: "variation" — see the schema comment on
  // VariationItem.variationCreatedAt for why a standalone Variation gets
  // one immediately, at creation.
  variationValue: z.number().min(0).optional()
});

function moduleForType(type: "variation" | "site_instruction") {
  return type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

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

  const canSeeVariations = await requireModuleAccess(projectId, userId, "variations");
  const canSeeSiteInstructions = await requireModuleAccess(projectId, userId, "site_instructions");

  if (!canSeeVariations && !canSeeSiteInstructions) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const visibleTypes: ("variation" | "site_instruction")[] = [
    ...(canSeeVariations ? (["variation"] as const) : []),
    ...(canSeeSiteInstructions ? (["site_instruction"] as const) : [])
  ];

  const variationItems = await prisma.variationItem.findMany({
    where: { projectId, type: { in: visibleTypes } },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ variationItems });
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

  const payload = createVariationItemSchema.parse(await request.json());

  const canAccessModule = await requireModuleAccess(projectId, userId, moduleForType(payload.type));
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const variationItem = await prisma.variationItem.create({
    data: {
      projectId,
      type: payload.type,
      reference: payload.reference,
      title: payload.title,
      description: payload.description,
      notifiedAt: payload.notifiedAt ? new Date(payload.notifiedAt) : undefined,
      dueAt: payload.dueAt ? new Date(payload.dueAt) : undefined,
      fileName: payload.fileName,
      storageKey: payload.storageKey,
      instructedByName: payload.instructedByName,
      // A standalone Variation inherently carries a Variation identity from
      // the moment it exists — a Site Instruction only gets one later, via
      // the separate "Create Variation" PATCH action (see [itemId]/route.ts).
      variationCreatedAt: payload.type === "variation" ? new Date() : undefined,
      variationValue: payload.type === "variation" ? payload.variationValue : undefined
    }
  });

  return NextResponse.json({ variationItem }, { status: 201 });
}
