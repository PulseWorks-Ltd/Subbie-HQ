import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrganisationMembership } from "@/lib/organisation";
import { ActivateAccessView } from "@/components/activate/activate-access-view";

const ACCESS_GRANTED_STATUSES = new Set(["pilot", "trialing", "active"]);

// Deliberately outside the (app) route group — this is the redirect target
// of app/(app)/layout.tsx's access gate, so it must not itself be wrapped
// by that same layout (would loop). Not part of the main app nav either —
// a blocking gate, not a page a user navigates to normally.
export default async function ActivatePage() {
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
    // this page after checkout) — send them into the real app.
    redirect("/");
  }

  return (
    <ActivateAccessView
      accessStatus={membership.organisation.accessStatus}
      isAdmin={membership.isAdmin}
      organisationName={membership.organisation.name}
    />
  );
}
