import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { PicturesView, type PictureItem } from "@/components/pictures/pictures-view";

export default async function PicturesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const canAccess = session?.user?.id ? await requireModuleAccess(projectId, session.user.id, "pictures") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const [updateAttachments, variationPhotos] = await Promise.all([
    prisma.updateAttachment.findMany({
      where: { update: { projectId } },
      include: { update: { select: { id: true, createdAt: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.variationPhoto.findMany({
      where: { variationItem: { projectId } },
      include: { variationItem: { select: { id: true, reference: true, title: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const items: PictureItem[] = [
    ...updateAttachments.map((attachment) => ({
      id: attachment.id,
      source: "update" as const,
      href: `/api/projects/${projectId}/attachments/${attachment.id}/file`,
      linkedLabel: `Update — ${new Date(attachment.update.createdAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}`,
      linkedHref: `/projects/${projectId}/updates`,
      createdAt: attachment.createdAt
    })),
    ...variationPhotos.map((photo) => ({
      id: photo.id,
      source: "variation-photo" as const,
      href: `/api/projects/${projectId}/variation-items/${photo.variationItemId}/photos/${photo.id}/file`,
      linkedLabel: `${photo.variationItem.reference} — ${photo.variationItem.title}`,
      linkedHref: `/projects/${projectId}/variations/${photo.variationItemId}`,
      createdAt: photo.createdAt
    }))
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return <PicturesView items={items} />;
}
