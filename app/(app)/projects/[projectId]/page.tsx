import { prisma } from "@/lib/prisma";

export default async function ProjectOverviewPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Overview</h2>
      <dl className="grid grid-cols-2 gap-4 max-w-md text-sm">
        <div>
          <dt className="text-[#4c739a] dark:text-slate-400">Status</dt>
          <dd className="font-medium capitalize">{project.status}</dd>
        </div>
        <div>
          <dt className="text-[#4c739a] dark:text-slate-400">Risk level</dt>
          <dd className="font-medium capitalize">{project.riskLevel}</dd>
        </div>
        <div>
          <dt className="text-[#4c739a] dark:text-slate-400">Next claim date</dt>
          <dd className="font-medium">
            {project.nextClaimDate ? project.nextClaimDate.toDateString() : "Not set"}
          </dd>
        </div>
      </dl>
      <p className="text-sm text-[#4c739a] dark:text-slate-400">
        A fuller overview summary is coming as Contract, Scope, Programme and Payment Claims are built out.
      </p>
    </div>
  );
}
