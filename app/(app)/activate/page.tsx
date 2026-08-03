import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrganisationMembership } from "@/lib/organisation";
import { ActivateAccessView } from "@/components/activate/activate-access-view";

const ACCESS_GRANTED_STATUSES = new Set(["pilot", "trialing", "active"]);

// Inside the (app) route group (moved here from a standalone top-level
// route) so it renders within the normal app shell — TopNav, account
// menu — rather than as a stripped-down page with no way out (Task 1.1).
// Safe now that app/(app)/layout.tsx no longer hard-redirects here; it
// used to live outside this route group specifically to avoid a redirect
// loop against that old gate, which no longer exists.
export default async function ActivatePage({
  searchParams
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await getOrganisationMembership(session.user.id);
  if (!membership) {
    // No organisation at all (shouldn't happen via normal signup, which
    // always creates one) — nothing to activate here.
    redirect("/");
  }

  if (ACCESS_GRANTED_STATUSES.has(membership.organisation.accessStatus)) {
    // Already unlocked (e.g. the webhook landed while they were sitting on
    // this page). Also the normal landing spot once ActivateAccessView's
    // post-checkout polling (Task 2) confirms access itself.
    redirect("/");
  }

  return (
    <ActivateAccessView
      accessStatus={membership.organisation.accessStatus}
      isAdmin={membership.isAdmin}
      organisationName={membership.organisation.name}
      justCompletedCheckout={checkout === "success"}
    />
  );
}
