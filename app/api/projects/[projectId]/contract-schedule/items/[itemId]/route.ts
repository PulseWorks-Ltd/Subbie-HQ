import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { itemUpdateInputSchema, validateComponents, type ComponentUpdateInput } from "@/app/api/projects/[projectId]/contract-schedule/items/route";

// Full replace, not a diff-and-patch: an item's components/phases are one
// small nested form the user edits and re-submits as a whole (see
// contract-item-form-dialog.tsx), so deleting and recreating the component/
// phase rows is far simpler and just as correct as reconciling field-by-
// field — the one thing this deliberately does NOT touch is progress
// checkpoints, which live independently against phase/component ids and
// would be silently orphaned if those ids were destroyed and recreated on
// every edit. To keep checkpoints intact across an edit, phases/components
// whose id is passed back unchanged are updated in place; anything new is
// created; anything removed (and its checkpoints with it) is deleted.
export async function PATCH(request: Request, context: { params: { projectId: string; itemId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, itemId } = context.params;
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

  const existing = await prisma.contractItem.findFirst({
    where: { id: itemId, schedule: { projectId } }
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = itemUpdateInputSchema.parse(await request.json());
  const validationError = validateComponents(payload.components);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const existingComponents = await prisma.contractItemComponent.findMany({
    where: { contractItemId: itemId },
    include: { phases: true }
  });
  const incomingComponentIds = new Set(payload.components.map((component) => component.id).filter(Boolean) as string[]);
  const componentsToDelete = existingComponents.filter((component) => !incomingComponentIds.has(component.id));

  await prisma.$transaction(async (tx) => {
    await tx.contractItem.update({
      where: { id: itemId },
      data: { description: payload.description, sectionLabel: payload.sectionLabel || null, sortOrder: payload.sortOrder ?? 0 }
    });

    for (const component of componentsToDelete) {
      await tx.contractItemProgressEntry.deleteMany({ where: { componentId: component.id } });
      await tx.contractItemProgressEntry.deleteMany({ where: { phaseId: { in: component.phases.map((phase) => phase.id) } } });
      await tx.contractItemComponentPhase.deleteMany({ where: { componentId: component.id } });
      await tx.contractItemComponent.delete({ where: { id: component.id } });
    }

    for (let index = 0; index < payload.components.length; index++) {
      const component: ComponentUpdateInput = payload.components[index];
      const existingComponent = component.id ? existingComponents.find((c) => c.id === component.id) : undefined;

      const componentData = {
        kind: component.kind,
        label: component.label,
        sortOrder: component.sortOrder ?? index,
        amount: component.kind === "fixed" ? component.amount : null,
        weeklyRate: component.kind === "weekly_hire" ? component.weeklyRate : null,
        quotedDurationWeeks: component.kind === "weekly_hire" ? component.quotedDurationWeeks : null
      };

      const componentId = existingComponent
        ? (await tx.contractItemComponent.update({ where: { id: existingComponent.id }, data: componentData })).id
        : (await tx.contractItemComponent.create({ data: { ...componentData, contractItemId: itemId } })).id;

      const incomingPhases = component.kind === "fixed" ? component.phases ?? [] : [];
      const incomingPhaseIds = new Set(incomingPhases.map((phase) => phase.id).filter(Boolean) as string[]);
      const existingPhases = existingComponent?.phases ?? [];
      const phasesToDelete = existingPhases.filter((phase) => !incomingPhaseIds.has(phase.id));
      for (const phase of phasesToDelete) {
        await tx.contractItemProgressEntry.deleteMany({ where: { phaseId: phase.id } });
        await tx.contractItemComponentPhase.delete({ where: { id: phase.id } });
      }

      for (let phaseIndex = 0; phaseIndex < incomingPhases.length; phaseIndex++) {
        const phase = incomingPhases[phaseIndex];
        const existingPhase = phase.id ? existingPhases.find((p) => p.id === phase.id) : undefined;
        const phaseData = { label: phase.label, sharePercent: phase.sharePercent, sortOrder: phase.sortOrder ?? phaseIndex };
        if (existingPhase) {
          await tx.contractItemComponentPhase.update({ where: { id: existingPhase.id }, data: phaseData });
        } else {
          await tx.contractItemComponentPhase.create({ data: { ...phaseData, componentId } });
        }
      }

      // kind changed away from fixed on an existing component that had
      // phases — clear them out (a weekly_hire component has none).
      if (existingComponent && component.kind === "weekly_hire" && existingPhases.length > 0) {
        await tx.contractItemProgressEntry.deleteMany({ where: { phaseId: { in: existingPhases.map((p) => p.id) } } });
        await tx.contractItemComponentPhase.deleteMany({ where: { componentId } });
      }
    }
  });

  const item = await prisma.contractItem.findUnique({
    where: { id: itemId },
    include: { components: { include: { phases: true } } }
  });

  return NextResponse.json({ item });
}

export async function DELETE(request: Request, context: { params: { projectId: string; itemId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, itemId } = context.params;
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

  const existing = await prisma.contractItem.findFirst({ where: { id: itemId, schedule: { projectId } } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const components = await prisma.contractItemComponent.findMany({ where: { contractItemId: itemId }, include: { phases: true } });
  await prisma.$transaction(async (tx) => {
    for (const component of components) {
      await tx.contractItemProgressEntry.deleteMany({ where: { componentId: component.id } });
      await tx.contractItemProgressEntry.deleteMany({ where: { phaseId: { in: component.phases.map((phase) => phase.id) } } });
      await tx.contractItemComponentPhase.deleteMany({ where: { componentId: component.id } });
    }
    await tx.contractItemComponent.deleteMany({ where: { contractItemId: itemId } });
    await tx.contractItem.delete({ where: { id: itemId } });
  });

  return NextResponse.json({ ok: true });
}
