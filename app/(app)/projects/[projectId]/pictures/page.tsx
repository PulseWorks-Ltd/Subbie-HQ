import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { PicturesView, type PictureItem } from "@/components/pictures/pictures-view";

export default async function PicturesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const canAccess = userId ? await requireModuleAccess(projectId, userId, "pictures") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const [canSeeVariations, canSeeSiteInstructions] = userId
    ? await Promise.all([
        requireModuleAccess(projectId, userId, "variations"),
        requireModuleAccess(projectId, userId, "site_instructions")
      ])
    : [false, false];
  const taggableTypes: ("variation" | "site_instruction")[] = [
    ...(canSeeVariations ? (["variation"] as const) : []),
    ...(canSeeSiteInstructions ? (["site_instruction"] as const) : [])
  ];

  const [updateAttachments, variationPhotos, taggableItems, contractTerms] = await Promise.all([
    prisma.updateAttachment.findMany({
      where: { update: { projectId } },
      include: { update: { select: { id: true, createdAt: true, variationItemId: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.variationPhoto.findMany({
      where: { variationItem: { projectId } },
      include: { variationItem: { select: { id: true, reference: true, title: true } } },
      orderBy: { createdAt: "desc" }
    }),
    taggableTypes.length > 0
      ? prisma.variationItem.findMany({
          where: { projectId, type: { in: taggableTypes }, status: { not: "complete" } },
          orderBy: { createdAt: "desc" }
        })
      : Promise.resolve([]),
    prisma.contractTerms.findUnique({ where: { projectId } })
  ]);

  // Same "Use as Day Works Sheet" pre-fill as the "+Upload" flow on a
  // Variation/SI's own page — ContractTerms is one row per project.
  const defaultRatePerHour =
    contractTerms?.dayWorksRateNormal != null ? String(Number(contractTerms.dayWorksRateNormal)) : "";

  const items: PictureItem[] = [
    ...updateAttachments.map((attachment) => ({
      id: attachment.id,
      source: "update" as const,
      href: `/api/projects/${projectId}/attachments/${attachment.id}/file`,
      linkedLabel: `Update — ${new Date(attachment.update.createdAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}`,
      linkedHref: `/projects/${projectId}/updates`,
      createdAt: attachment.createdAt,
      // The Update this photo came from might already be tagged to an
      // SI/Variation — pre-select that as the default, still changeable.
      defaultVariationItemId: attachment.update.variationItemId
    })),
    ...variationPhotos.map((photo) => ({
      id: photo.id,
      source: "variation-photo" as const,
      href: `/api/projects/${projectId}/variation-items/${photo.variationItemId}/photos/${photo.id}/file`,
      linkedLabel: `${photo.variationItem.reference} — ${photo.variationItem.title}`,
      linkedHref: `/projects/${projectId}/variations/${photo.variationItemId}`,
      createdAt: photo.createdAt,
      // Already inherently tagged to this exact item (it's uploaded
      // straight to the item's own Photos section) — pre-select it too.
      defaultVariationItemId: photo.variationItemId
    }))
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return <PicturesView items={items} projectId={projectId} taggableItems={taggableItems} defaultRatePerHour={defaultRatePerHour} />;
}
