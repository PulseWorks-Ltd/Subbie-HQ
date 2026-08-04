import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrganisationMembership } from "@/lib/organisation";
import type { AccountSettingsTab } from "@/components/account-settings/account-settings-view";
import { AccountSettingsView } from "@/components/account-settings/account-settings-view";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user, membership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true }
    }),
    getOrganisationMembership(session.user.id)
  ]);
  if (!user) {
    redirect("/login");
  }

  const isAdmin = membership?.isAdmin ?? false;

  // Never trust the requested tab for what gets fetched/rendered — a
  // non-admin asking for ?tab=team or ?tab=organisation directly falls back
  // to My Settings, same as the old page's hard admin gate did.
  const initialTab: AccountSettingsTab = isAdmin && (tab === "team" || tab === "organisation") ? tab : "my-settings";

  const [members, invites] = isAdmin
    ? await Promise.all([
        prisma.organisationMember.findMany({
          where: { organisationId: membership!.organisationId },
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { createdAt: "asc" }
        }),
        prisma.organisationInvite.findMany({
          where: { organisationId: membership!.organisationId, acceptedAt: null },
          orderBy: { createdAt: "desc" }
        })
      ])
    : [[], []];

  return (
    <AccountSettingsView
      initialTab={initialTab}
      isAdmin={isAdmin}
      user={user}
      organisationName={membership?.organisation.name ?? ""}
      currentUserId={session.user.id}
      members={members}
      invites={invites}
      variationCompletionMode={membership?.organisation.variationCompletionMode ?? "requires_confirmation"}
      organisation={
        isAdmin
          ? {
              id: membership!.organisationId,
              name: membership!.organisation.name,
              trade: membership!.organisation.trade,
              jurisdiction: membership!.organisation.jurisdiction,
              accessStatus: membership!.organisation.accessStatus,
              planTier: membership!.organisation.planTier,
              trialEndsAt: membership!.organisation.trialEndsAt,
              hasStripeCustomer: membership!.organisation.stripeCustomerId !== null
            }
          : null
      }
    />
  );
}
