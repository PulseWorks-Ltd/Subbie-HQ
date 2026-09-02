import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { searchWorkers } from "@/lib/hours-on-site";

// The type-ahead search behind "Add additional workers" — scoped to the
// project's own organisation (a subbie's crew, reusable across all its
// projects, same reuse story as MainContractorContact). A legacy org-less
// project simply has no directory to search (empty result) rather than
// erroring — nothing about the rest of the flow depends on this.
export async function GET(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
  if (!project?.organisationId) return NextResponse.json({ workers: [] });

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const workers = await searchWorkers(project.organisationId, query);
  return NextResponse.json({ workers });
}
