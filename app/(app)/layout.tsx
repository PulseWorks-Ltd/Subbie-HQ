import { auth } from "@/auth";
import { TopNav } from "@/components/top-nav";
import { AccessBanner } from "@/components/access-banner";
import { FeatureAccessGate } from "@/components/feature-access-gate";
import { getOrganisationMembership } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";
import { UnreadUpdatesIndicator } from "@/components/dashboard/unread-updates-indicator";

const ACCESS_GRANTED_STATUSES = new Set(["pilot", "trialing", "active"]);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const membership = session?.user?.id ? await getOrganisationMembership(session.user.id) : null;

  // Central access gate (Task 4.1 originally; restructured per a later
  // bug fix — see FeatureAccessGate) — computed once here, since session +
  // membership + accessStatus are already known. `isGated` deliberately
  // false when there's no session (covers /login, /signup,
  // /forgot-password, /reset-password, which all live under this same
  // route group but have no session yet) or no organisation membership
  // (nothing to gate) — same cases the old hard redirect also skipped.
  //
  // Previously this redirected away from the ENTIRE app to /activate,
  // which left a locked user with no nav, no way to log out, and no way
  // to reach billing to fix the problem — a real dead end when the
  // webhook granting access was even slightly delayed. Now the nav always
  // renders and only actual feature content gets swapped for a friendly
  // message (FeatureAccessGate), so /activate, /settings, and logout stay
  // reachable at all times regardless of access status.
  //
  // Known trade-off, unchanged from before: this also applies to
  // /invite/[token] (accepting an invite to a DIFFERENT organisation) — a
  // user whose own existing org is gated sees the locked message before
  // they can accept an invite elsewhere. The invite link itself doesn't
  // expire because of this.
  const isGated = Boolean(
    session?.user?.id && membership && !ACCESS_GRANTED_STATUSES.has(membership.organisation.accessStatus)
  );

  return (
    <>
      {session?.user && (
        <>
          <UnreadUpdatesIndicator />
          <TopNav
            userName={session.user.name ?? null}
            userEmail={session.user.email ?? ""}
            canSeeInsurance={hasModuleAccess(membership, "insurance")}
            canSeeMainContractors={hasModuleAccess(membership, "main_contractors")}
            canSeeIncomingEmails={hasModuleAccess(membership, "incoming_emails")}
          />
          {isGated && <AccessBanner />}
        </>
      )}
      <FeatureAccessGate isGated={isGated} isAdmin={membership?.isAdmin ?? false}>
        {children}
      </FeatureAccessGate>
    </>
  );
}
