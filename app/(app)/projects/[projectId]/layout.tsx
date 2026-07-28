import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";
import { ProjectNav } from "@/components/project-nav";

export default async function ProjectLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { projectId } = await params;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    notFound();
  }

  const hasAccess = await requireProjectAccess(projectId, session.user.id);
  if (!hasAccess) {
    notFound();
  }

  const membership = project.organisationId ? await getOrganisationMembership(session.user.id) : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 border-b border-[#e7edf3] dark:border-slate-800 pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[#4c739a] dark:text-slate-400">
          {project.code ?? "Project"}
        </p>
        <h1 className="text-2xl font-bold">{project.name}</h1>
      </header>

      <div className="flex gap-8">
        <ProjectNav
          projectId={project.id}
          unrestricted={!project.organisationId}
          isAdmin={membership?.isAdmin ?? false}
          modules={(membership?.modules as Record<string, boolean> | undefined) ?? {}}
        />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
