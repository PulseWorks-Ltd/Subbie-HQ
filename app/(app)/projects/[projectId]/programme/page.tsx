import { redirect } from "next/navigation";

// Programme was merged into the combined Scope & Programme nav item/page —
// keep this route alive as a redirect so old links/bookmarks don't 404.
export default async function ProgrammeRedirectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/scope-programme?tab=programme`);
}
