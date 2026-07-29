import { auth } from "@/auth";
import { TopNav } from "@/components/top-nav";
import { getOrganisationMembership } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const membership = session?.user?.id ? await getOrganisationMembership(session.user.id) : null;

  return (
    <>
      {session?.user && (
        <TopNav
          userName={session.user.name ?? null}
          userEmail={session.user.email ?? ""}
          isOrganisationAdmin={membership?.isAdmin ?? false}
          canSeeInsurance={hasModuleAccess(membership, "insurance")}
          canSeeMainContractors={hasModuleAccess(membership, "main_contractors")}
        />
      )}
      {children}
    </>
  );
}
