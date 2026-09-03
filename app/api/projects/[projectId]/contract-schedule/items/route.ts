import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { validatePhaseShares, buildContractItemCreateData } from "@/lib/contract-schedule";

// Shared by both create (this route) and full-replace edit (the [itemId]
// route) — an item's components/phases are edited as one whole form, not
// piecemeal, so both routes accept the same nested shape and replace
// whatever existed before rather than diffing it. Progress checkpoints are
// the one thing that accumulates independently of this (see the separate
// /progress route) and is deliberately untouched by either of these.
export const componentInputSchema = z.object({
  kind: z.enum(["fixed", "weekly_hire"]),
  label: z.string().min(1),
  sortOrder: z.number().int().optional(),
  amount: z.number().min(0).nullable().optional(),
  weeklyRate: z.number().min(0).nullable().optional(),
  quotedDurationWeeks: z.number().min(0).nullable().optional(),
  phases: z
    .array(
      z.object({
        label: z.string().min(1),
        sharePercent: z.number().min(0).max(100),
        sortOrder: z.number().int().optional()
      })
    )
    .optional()
});

export const itemInputSchema = z.object({
  description: z.string().min(1),
  sectionLabel: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  components: z.array(componentInputSchema).min(1)
});

// Same shapes, but every component/phase may carry back its own existing
// id — used only by the [itemId] PATCH route so an edit can update rows in
// place (preserving their progress checkpoints) rather than deleting and
// recreating everything on every save. A row with no id is a new one.
const componentUpdateInputSchema = componentInputSchema.extend({
  id: z.string().optional(),
  phases: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        sharePercent: z.number().min(0).max(100),
        sortOrder: z.number().int().optional()
      })
    )
    .optional()
});
export const itemUpdateInputSchema = itemInputSchema.extend({
  components: z.array(componentUpdateInputSchema).min(1)
});
export type ComponentUpdateInput = z.infer<typeof componentUpdateInputSchema>;

// A "fixed" component needs its phase shares to sum to 100; a
// "weekly_hire" component has no phases at all (its progress attaches
// directly to the component, see lib/contract-schedule.ts).
export function validateComponents(components: z.infer<typeof componentInputSchema>[]): string | null {
  for (const component of components) {
    if (component.kind === "fixed") {
      const error = validatePhaseShares(component.phases ?? []);
      if (error) return `"${component.label}": ${error}`;
    }
  }
  return null;
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
  const canAccessModule = await requireModuleAccess(projectId, userId, "payment_claims");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = itemInputSchema.parse(await request.json());
  const validationError = validateComponents(payload.components);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const schedule = await prisma.contractSchedule.upsert({
    where: { projectId },
    update: {},
    create: { projectId }
  });

  const item = await prisma.contractItem.create({
    data: buildContractItemCreateData(schedule.id, payload, 0),
    include: { components: { include: { phases: true } } }
  });

  return NextResponse.json({ item }, { status: 201 });
}
