import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { CorrespondenceView, type CorrespondenceRow } from "@/components/correspondence/correspondence-view";

export default async function CorrespondencePage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { projectId } = await params;
  const { q } = await searchParams;

  const session = await auth();
  const userId = session?.user?.id;
  const canAccess = userId ? await requireModuleAccess(projectId, userId, "correspondence") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const canSeeVariations = userId ? await requireModuleAccess(projectId, userId, "variations") : false;
  const canSeeSiteInstructions = userId ? await requireModuleAccess(projectId, userId, "site_instructions") : false;
  const visibleTypes: ("variation" | "site_instruction")[] = [
    ...(canSeeVariations ? (["variation"] as const) : []),
    ...(canSeeSiteInstructions ? (["site_instruction"] as const) : [])
  ];

  // Note: no separate InboundEmail query here — a filed inbound email is
  // already represented by its own Correspondence row (source:
  // inbound_email, see lib/inbound-email.ts's fileInboundEmail). Emails
  // still awaiting review live in the org-wide Incoming Emails queue
  // instead, not here (see app/(app)/incoming-emails).
  const [correspondence, taggableItems] = await Promise.all([
    prisma.correspondence.findMany({
      where: {
        projectId,
        ...(q?.trim()
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { bodyText: { contains: q, mode: "insensitive" as const } },
                { category: { contains: q, mode: "insensitive" as const } },
                { variationItem: { reference: { contains: q, mode: "insensitive" as const } } }
              ]
            }
          : {})
      },
      include: { variationItem: { select: { id: true, reference: true, title: true } } },
      orderBy: { createdAt: "desc" }
    }),
    visibleTypes.length > 0
      ? prisma.variationItem.findMany({
          where: { projectId, type: { in: visibleTypes }, status: { not: "complete" }, closedAt: null },
          orderBy: { createdAt: "desc" }
        })
      : Promise.resolve([])
  ]);

  const rows: CorrespondenceRow[] = correspondence
    .map((item) => ({
      id: item.id,
      kind:
        item.source === "response_letter_draft"
          ? ("letter_draft" as const)
          : item.source === "inbound_email"
            ? ("email" as const)
            : ("upload" as const),
      title: item.title,
      subtitle: item.fileName,
      body: item.bodyText,
      category: item.category,
      fileHref: item.storageKey
        ? `/api/projects/${projectId}/correspondence/${item.id}/file`
        : item.sourceInsuranceCertificateId
          ? `/api/organisation/insurance-certificates/${item.sourceInsuranceCertificateId}/file`
          : null,
      linkedItem: item.variationItem,
      date: item.createdAt,
      deletable: true,
      outcomeNote: item.outcomeNote,
      hasOutcome: Boolean(item.outcomeNote || item.outcomeContractDocumentId)
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return <CorrespondenceView projectId={projectId} rows={rows} taggableItems={taggableItems} initialQuery={q ?? ""} />;
}
