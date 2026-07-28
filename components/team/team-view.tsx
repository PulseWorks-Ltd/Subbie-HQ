"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrganisationInvite, OrganisationMember } from "@prisma/client";
import { MODULE_LABELS, type ModuleKey, type ModulePermissions } from "@/lib/permissions";
import { MemberPermissionsDialog } from "@/components/team/member-permissions-dialog";

type MemberWithUser = OrganisationMember & { user: { id: string; name: string | null; email: string } };

function moduleSummary(modules: unknown) {
  const permissions = modules as ModulePermissions | null;
  const active = Object.keys(permissions ?? {}).filter((key) => permissions?.[key as ModuleKey]);
  if (active.length === 0) return "No module access";
  return active.map((key) => MODULE_LABELS[key as ModuleKey]).join(", ");
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export function TeamView({
  organisationName,
  currentUserId,
  members,
  invites
}: {
  organisationName: string;
  currentUserId: string;
  members: MemberWithUser[];
  invites: OrganisationInvite[];
}) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberWithUser | null>(null);

  function openInviteDialog() {
    setEditingMember(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(member: MemberWithUser) {
    setEditingMember(member);
    setIsDialogOpen(true);
  }

  async function handleRemoveMember(member: MemberWithUser) {
    if (!confirm(`Remove ${member.user.name ?? member.user.email} from ${organisationName}?`)) return;
    const response = await fetch(`/api/organisation/members/${member.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      alert(typeof body?.error === "string" ? body.error : "Could not remove this member.");
      return;
    }
    router.refresh();
  }

  async function handleRevokeInvite(invite: OrganisationInvite) {
    if (!confirm(`Revoke the invite sent to ${invite.email}?`)) return;
    await fetch(`/api/organisation/invites/${invite.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex-1 flex flex-col items-center">
      <div className="max-w-[900px] w-full px-10 py-8 flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Team</h1>
            <p className="text-sm text-[#4c739a] dark:text-slate-400">{organisationName}</p>
          </div>
          <button
            onClick={openInviteDialog}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
          >
            Invite Team Member
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">
            Members ({members.length})
          </h2>
          <div className="flex flex-col gap-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm">
                    {member.user.name ?? member.user.email}
                    {member.user.id === currentUserId && (
                      <span className="ml-2 text-xs font-normal text-[#4c739a] dark:text-slate-400">(you)</span>
                    )}
                    {member.isAdmin && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary">
                        Admin
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#4c739a] dark:text-slate-400">
                    {member.user.email}
                    {member.title && ` · ${member.title}`}
                  </p>
                  <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-1">
                    {member.isAdmin ? "Full access" : moduleSummary(member.modules)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEditDialog(member)}
                    className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member)}
                    className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {invites.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">
              Pending invites ({invites.length})
            </h2>
            <div className="flex flex-col gap-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-[#cfdbe7] dark:border-slate-700 p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{invite.email}</p>
                    <p className="text-xs text-[#4c739a] dark:text-slate-400">
                      {invite.title && `${invite.title} · `}Sent {formatDate(invite.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevokeInvite(invite)}
                    className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <MemberPermissionsDialog member={editingMember} open={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </div>
  );
}
