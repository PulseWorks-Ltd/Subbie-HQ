import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireModuleAccess } from "@/lib/auth";
import { PlaceholderSection } from "@/components/placeholder-section";

export default async function PaymentClaimsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const canAccess = session?.user?.id ? await requireModuleAccess(projectId, session.user.id, "payment_claims") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  return (
    <PlaceholderSection
      title="Payment Claims"
      description="Payment Claims is currently under development and will be launching in a future update. In the meantime, Variation Packages and Correspondence give you a complete evidence record to support claims prepared outside the app."
    />
  );
}
