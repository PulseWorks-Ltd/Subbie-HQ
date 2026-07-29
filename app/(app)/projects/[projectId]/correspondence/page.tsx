import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { CorrespondenceView, type CorrespondenceRow } from "@/components/correspondence/correspondence-view";

export default async function CorrespondencePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

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

  const [inboundEmails, correspondence, taggableItems] = await Promise.all([
    prisma.inboundEmail.findMany({ where: { projectId }, orderBy: { receivedAt: "desc" } }),
    prisma.correspondence.findMany({
      where: { projectId },
      include: { variationItem: { select: { id: true, reference: true, title: true } } },
      orderBy: { createdAt: "desc" }
    }),
    visibleTypes.length > 0
      ? prisma.variationItem.findMany({ where: { projectId, type: { in: visibleTypes } }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([])
  ]);

  const rows: CorrespondenceRow[] = [
    ...inboundEmails.map((email) => ({
      id: email.id,
      kind: "email" as const,
      title: email.subject,
      subtitle: email.sender,
      body: email.body,
      fileHref: null,
      linkedItem: null,
      date: email.receivedAt,
      deletable: false,
      outcomeNote: null,
      hasOutcome: false
    })),
    ...correspondence.map((item) => ({
      id: item.id,
      kind: item.source === "response_letter_draft" ? ("letter_draft" as const) : ("upload" as const),
      title: item.title,
      subtitle: item.fileName,
      body: item.bodyText,
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
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return <CorrespondenceView projectId={projectId} rows={rows} taggableItems={taggableItems} />;
}
