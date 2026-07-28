import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireModuleAccess } from "@/lib/auth";
import { PlaceholderSection } from "@/components/placeholder-section";

export default async function EvidencePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const canAccess = session?.user?.id ? await requireModuleAccess(projectId, session.user.id, "evidence") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  return (
    <PlaceholderSection
      title="Evidence"
      description="The evidence vault and inbound feed are coming in the next build phase."
    />
  );
}
