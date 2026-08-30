"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";

type MemberRow = { id: string; name: string; email: string; isAdmin: boolean; title: string | null; joinedAt: string };
type EventRow = { id: string; fromStatus: string | null; toStatus: string; planTier: string | null; source: string; createdAt: string };
type OrgRow = {
  id: string;
  name: string;
  trade: string | null;
  accessStatus: string;
  planTier: string | null;
  createdAt: string;
  pilotAccessGrantedAt: string | null;
  trialEndsAt: string | null;
  memberCount: number;
  members: MemberRow[];
  accessEvents: EventRow[];
};

const STATUS_LABELS: Record<string, string> = {
  pilot: "Pilot",
  trialing: "Trial",
  active: "Active",
  past_due: "Past Due",
  canceled: "Cancelled",
  none: "None"
};

const STATUS_STYLES: Record<string, string> = {
  pilot: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  trialing: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  active: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  past_due: "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  canceled: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  none: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise"
};

const SOURCE_LABELS: Record<string, string> = {
  pilot_code: "Pilot code redeemed",
  stripe_checkout: "Checkout completed",
  stripe_subscription_created: "Subscription created",
  stripe_subscription_updated: "Subscription updated",
  stripe_subscription_deleted: "Subscription cancelled"
};

function StatusChip({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.none;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide ${style}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function OrganisationsAdminView({ organisations }: { organisations: OrgRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return organisations.filter((org) => {
      if (statusFilter !== "all" && org.accessStatus !== statusFilter) return false;
      if (q && !org.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [organisations, search, statusFilter]);

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const org of organisations) {
      byStatus[org.accessStatus] = (byStatus[org.accessStatus] ?? 0) + 1;
    }
    return byStatus;
  }, [organisations]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Organisations & Users</h1>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Every organisation, its access status, its team, and its billing-status history.
          </p>
        </div>
        <Link href="/platform-admin/ai-usage" className="text-sm font-medium text-primary hover:underline">
          AI Usage &rarr;
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        {(["pilot", "trialing", "active", "past_due", "canceled", "none"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            className={`rounded-lg border px-3 py-2 text-left ${
              statusFilter === status
                ? "border-primary bg-primary/5"
                : "border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900"
            }`}
          >
            <div className="text-lg font-bold tabular-nums">{counts[status] ?? 0}</div>
            <div className="text-xs text-[#4c739a] dark:text-slate-400">{STATUS_LABELS[status]}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by company name..."
          className="h-10 flex-1 min-w-[16rem] rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#e7edf3] dark:border-slate-800">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#e7edf3] dark:border-slate-800 bg-[#f6f7f8] dark:bg-slate-900/40">
              <th className="text-left font-bold py-2 px-4">Company</th>
              <th className="text-left font-bold py-2 px-4">Status</th>
              <th className="text-left font-bold py-2 px-4">Plan</th>
              <th className="text-left font-bold py-2 px-4">Members</th>
              <th className="text-left font-bold py-2 px-4">Created</th>
              <th className="text-left font-bold py-2 px-4">Trial ends</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((org) => {
              const isExpanded = expandedId === org.id;
              return (
                <Fragment key={org.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : org.id)}
                    className="border-b border-[#e7edf3] dark:border-slate-800 last:border-0 cursor-pointer hover:bg-[#f6f7f8] dark:hover:bg-slate-900/40"
                  >
                    <td className="py-2 px-4 font-medium">
                      {org.name}
                      {org.trade && <span className="text-[#4c739a] dark:text-slate-400 font-normal"> — {org.trade}</span>}
                    </td>
                    <td className="py-2 px-4">
                      <StatusChip status={org.accessStatus} />
                    </td>
                    <td className="py-2 px-4 text-[#4c739a] dark:text-slate-400">
                      {org.planTier ? PLAN_LABELS[org.planTier] ?? org.planTier : "—"}
                    </td>
                    <td className="py-2 px-4 tabular-nums">{org.memberCount}</td>
                    <td className="py-2 px-4 text-[#4c739a] dark:text-slate-400">{formatDate(org.createdAt)}</td>
                    <td className="py-2 px-4 text-[#4c739a] dark:text-slate-400">
                      {org.trialEndsAt ? formatDate(org.trialEndsAt) : "—"}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-[#e7edf3] dark:border-slate-800 last:border-0">
                      <td colSpan={6} className="bg-[#f6f7f8] dark:bg-slate-900/40 px-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-2">
                              Team ({org.members.length})
                            </h3>
                            {org.members.length === 0 ? (
                              <p className="text-sm text-[#4c739a] dark:text-slate-400">No members.</p>
                            ) : (
                              <ul className="flex flex-col gap-2">
                                {org.members.map((member) => (
                                  <li key={member.id} className="text-sm flex flex-col">
                                    <span className="font-medium">
                                      {member.name}
                                      {member.isAdmin && (
                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/10 text-primary">
                                          Admin
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-xs text-[#4c739a] dark:text-slate-400">
                                      {member.email}
                                      {member.title ? ` · ${member.title}` : ""} · Joined {formatDate(member.joinedAt)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {org.pilotAccessGrantedAt && (
                              <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-3">
                                Pilot access granted {formatDate(org.pilotAccessGrantedAt)}
                              </p>
                            )}
                          </div>

                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-2">
                              Access history
                            </h3>
                            {org.accessEvents.length === 0 ? (
                              <p className="text-sm text-[#4c739a] dark:text-slate-400">
                                No changes recorded since tracking began.
                              </p>
                            ) : (
                              <ul className="flex flex-col gap-2">
                                {org.accessEvents.map((event) => (
                                  <li key={event.id} className="text-sm">
                                    <span className="font-medium">
                                      {event.fromStatus ? (
                                        <>
                                          {STATUS_LABELS[event.fromStatus] ?? event.fromStatus} &rarr;{" "}
                                        </>
                                      ) : (
                                        ""
                                      )}
                                      {STATUS_LABELS[event.toStatus] ?? event.toStatus}
                                    </span>
                                    <span className="text-xs text-[#4c739a] dark:text-slate-400">
                                      {" "}
                                      · {SOURCE_LABELS[event.source] ?? event.source} · {formatDateTime(event.createdAt)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-sm text-[#4c739a] dark:text-slate-400 px-4 py-6 text-center">
            No organisations match this filter.
          </p>
        )}
      </div>
    </div>
  );
}
