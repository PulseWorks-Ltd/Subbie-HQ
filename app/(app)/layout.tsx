import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TopNav } from "@/components/top-nav";
import { getOrganisationMembership } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";
import { UnreadUpdatesIndicator } from "@/components/dashboard/unread-updates-indicator";

const ACCESS_GRANTED_STATUSES = new Set(["pilot", "trialing", "active"]);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const membership = session?.user?.id ? await getOrganisationMembership(session.user.id) : null;

  // Central access gate (Task 4.1) — every page under this layout is
  // covered by one check here rather than duplicated per-page. Skipped
  // entirely when there's no session (covers /login, /signup,
  // /forgot-password, /reset-password, which all live under this same
  // route group but have no session yet) or no organisation membership
  // (nothing to gate). /activate itself is a separate top-level route
  // OUTSIDE this route group specifically so redirecting there can never
  // loop back into this same check — same pattern already used for
  // /platform-admin to avoid inheriting this layout's assumptions.
  //
  // Known trade-off: this also applies to /invite/[token] (accepting an
  // invite to a DIFFERENT organisation) — a user whose own existing org is
  // gated will be sent to /activate before they can accept an invite
  // elsewhere. Next.js App Router Server Components have no clean way to
  // read the current pathname in a shared layout without middleware or a
  // route-group restructure, so this narrow edge case is accepted rather
  // than solved; the invite link itself doesn't expire because of this.
  if (session?.user?.id && membership && !ACCESS_GRANTED_STATUSES.has(membership.organisation.accessStatus)) {
    redirect("/activate");
  }

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
        </>
      )}
      {children}
    </>
  );
}
