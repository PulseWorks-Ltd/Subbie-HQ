import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MobileUpdatesView } from "@/components/mobile/mobile-updates-view";

export default async function MobileProjectUpdatesPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId: session!.user.id } } }
  });

  if (!project) {
    notFound();
  }

  const [updates, siteInstructions] = await Promise.all([
    prisma.update.findMany({
      where: { projectId, parentId: null },
      include: {
        author: { select: { id: true, name: true, email: true } },
        siteInstruction: { select: { id: true, reference: true, title: true } },
        attachments: true,
        replies: {
          include: {
            author: { select: { id: true, name: true, email: true } },
            attachments: true
          },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.siteInstruction.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <a href="/m" className="text-xs font-medium text-[#4c739a] dark:text-slate-400">
          &larr; Your Projects
        </a>
        <h1 className="text-lg font-bold">{project.name}</h1>
      </div>
      <MobileUpdatesView projectId={projectId} updates={updates} siteInstructions={siteInstructions} />
    </div>
  );
}
