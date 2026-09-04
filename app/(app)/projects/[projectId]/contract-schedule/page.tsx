import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { getContractScheduleForProject, computeScheduleTotalValue, resolvePhasePercent, computeFixedComponentValue, computeRentalClaimedToDate, getLinkedDiaryEntriesForContractItems } from "@/lib/contract-schedule";
import { ContractScheduleView } from "@/components/contract-schedule/contract-schedule-view";

export default async function ContractSchedulePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const canAccess = userId ? await requireModuleAccess(projectId, userId, "payment_claims") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  // The schedule is created lazily on first real save via the API, but the
  // page itself needs something to render even before that — reading with
  // findUnique (not the GET route's upsert) keeps this a pure read.
  const schedule = await getContractScheduleForProject(projectId);
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });

  const today = new Date();
  // Precompute each component's "as of today" figures server-side, once,
  // rather than re-deriving them client-side — the view is otherwise a
  // pure display of what's already been calculated.
  const computed = schedule
    ? schedule.items.map((item) => ({
        itemId: item.id,
        components: item.components.map((component) => {
          if (component.kind === "weekly_hire") {
            const rate = Number(component.weeklyRate ?? 0);
            const checkpoints = component.progressEntries.map((entry) => ({ effectiveDate: entry.effectiveDate, percent: entry.percent }));
            return {
              componentId: component.id,
              currentPercent: checkpoints.length ? checkpoints[checkpoints.length - 1].percent : 0,
              claimedToDate: computeRentalClaimedToDate(rate, checkpoints, today)
            };
          }
          const amount = Number(component.amount ?? 0);
          const phases = component.phases.map((phase) => ({
            sharePercent: phase.sharePercent,
            checkpoints: phase.progressEntries.map((entry) => ({ effectiveDate: entry.effectiveDate, percent: entry.percent }))
          }));
          return {
            componentId: component.id,
            currentPercent: null,
            claimedToDate: computeFixedComponentValue(amount, phases, today),
            phasePercents: component.phases.map((phase) => ({
              phaseId: phase.id,
              percent: resolvePhasePercent(
                phase.progressEntries.map((entry) => ({ effectiveDate: entry.effectiveDate, percent: entry.percent })),
                today
              )
            }))
          };
        })
      }))
    : [];

  const linkedDiaryEntriesByItemId = schedule
    ? await getLinkedDiaryEntriesForContractItems(schedule.items.map((item) => item.id))
    : {};

  return (
    <ContractScheduleView
      projectId={projectId}
      projectName={project?.name ?? ""}
      schedule={schedule}
      totalValue={schedule ? computeScheduleTotalValue(schedule) : 0}
      computed={computed}
      linkedDiaryEntriesByItemId={linkedDiaryEntriesByItemId}
    />
  );
}
