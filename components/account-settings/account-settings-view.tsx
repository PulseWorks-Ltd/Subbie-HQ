"use client";

import { useState } from "react";
import type { OrganisationInvite, OrganisationMember, VariationCompletionMode } from "@prisma/client";
import { TeamView } from "@/components/team/team-view";
import { MySettingsTab } from "@/components/account-settings/my-settings-tab";
import { OrganisationTab } from "@/components/account-settings/organisation-tab";

export type AccountSettingsTab = "my-settings" | "team" | "organisation";

type MemberWithUser = OrganisationMember & {
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
};

// Not to be confused with components/settings/settings-view.tsx, which is
// the unrelated PROJECT-scoped Settings tab (risk level, invoice mode, Main
// Contractor, Contract Terms) — this is the global, user/organisation-level
// Settings page reached from the account menu.
export function AccountSettingsView({
  initialTab,
  isAdmin,
  user,
  organisationName,
  currentUserId,
  members,
  invites,
  variationCompletionMode,
  organisation
}: {
  initialTab: AccountSettingsTab;
  isAdmin: boolean;
  user: { id: string; firstName: string | null; lastName: string | null; jobTitle: string | null; email: string };
  organisationName: string;
  currentUserId: string;
  members: MemberWithUser[];
  invites: OrganisationInvite[];
  variationCompletionMode: VariationCompletionMode;
  organisation: {
    id: string;
    name: string;
    trade: string | null;
    jurisdiction: string | null;
    accessStatus: string;
    planTier: string | null;
    trialEndsAt: Date | null;
    hasStripeCustomer: boolean;
    logoUrl: string | null;
  } | null;
}) {
  const [tab, setTab] = useState<AccountSettingsTab>(initialTab);

  const tabs: { key: AccountSettingsTab; label: string }[] = [
    { key: "my-settings", label: "My Settings" },
    ...(isAdmin ? ([{ key: "team", label: "Team" }, { key: "organisation", label: "Organisation" }] as const) : [])
  ];

  return (
    <main className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Settings</h1>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-1 border-b border-[#e7edf3] dark:border-slate-800">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${
                tab === key
                  ? "text-primary border-primary"
                  : "text-[#4c739a] dark:text-slate-400 border-transparent hover:text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "my-settings" && <MySettingsTab user={user} />}
      {tab === "team" && isAdmin && (
        <TeamView
          organisationName={organisationName}
          currentUserId={currentUserId}
          members={members}
          invites={invites}
          variationCompletionMode={variationCompletionMode}
        />
      )}
      {tab === "organisation" && isAdmin && organisation && <OrganisationTab organisation={organisation} />}
    </main>
  );
}
