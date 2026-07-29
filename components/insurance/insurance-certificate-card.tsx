"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CountdownBadge } from "@/components/badges/countdown-badge";
import { INSURANCE_TYPE_LABELS } from "@/lib/insurance-labels";
import type { InsuranceCertificateRow } from "@/components/insurance/insurance-certificates-view";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function formatValue(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? `$${num.toLocaleString("en-NZ")}` : String(value);
}

export function InsuranceCertificateCard({
  certificate,
  activeProjectCount,
  isAdmin,
  onEdit
}: {
  certificate: InsuranceCertificateRow;
  activeProjectCount: number;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const sentToCount = certificate.distributions.length;
  const notYetSentCount = Math.max(activeProjectCount - sentToCount, 0);

  async function handleSendToAll() {
    setIsSending(true);
    await fetch(`/api/organisation/insurance-certificates/${certificate.id}/send`, { method: "POST" });
    setIsSending(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete this ${INSURANCE_TYPE_LABELS[certificate.type] ?? certificate.type} certificate?`)) return;
    await fetch(`/api/organisation/insurance-certificates/${certificate.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-5">
        <button onClick={() => setIsExpanded((value) => !value)} className="flex items-start gap-3 flex-1 min-w-0 text-left">
          <span className="material-symbols-outlined text-[#4c739a] mt-0.5">
            {isExpanded ? "expand_less" : "expand_more"}
          </span>
          <div className="min-w-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              {INSURANCE_TYPE_LABELS[certificate.type] ?? certificate.type}
            </span>
            <p className="font-bold mt-1">{certificate.provider}</p>
            <p className="text-xs text-[#4c739a] dark:text-slate-400">
              {certificate.policyNumber ? `Policy ${certificate.policyNumber}` : "No policy number recorded"}
            </p>
            {certificate.covers.length > 0 && (
              <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-1">
                {certificate.covers.map((c) => `${c.coverType} — ${formatValue(c.value)}`).join(" · ")}
              </p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-3 shrink-0">
          {certificate.expiryAt && <CountdownBadge date={certificate.expiryAt} />}
          {certificate.storageKey && (
            <a
              href={`/api/organisation/insurance-certificates/${certificate.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="h-8 px-3 flex items-center rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
            >
              View file
            </a>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-[#e7edf3] dark:border-slate-800 p-5 pt-4 flex flex-col gap-4">
          {certificate.expiryAt && (
            <p className="text-sm text-[#4c739a] dark:text-slate-400">Expires {formatDate(certificate.expiryAt)}</p>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold">
                Distributed to {sentToCount} project{sentToCount === 1 ? "" : "s"}
                {notYetSentCount > 0 ? ` · ${notYetSentCount} active project${notYetSentCount === 1 ? "" : "s"} not yet sent` : ""}
              </h4>
              {isAdmin && (
                <button
                  onClick={handleSendToAll}
                  disabled={isSending || notYetSentCount === 0}
                  className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 disabled:opacity-50"
                >
                  {isSending ? "Sending..." : "Send to all active projects"}
                </button>
              )}
            </div>

            {certificate.distributions.length === 0 ? (
              <p className="text-sm text-[#4c739a] dark:text-slate-400">Not yet sent to any project.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {certificate.distributions.map((distribution) => (
                  <div key={distribution.id} className="flex items-center justify-between text-sm py-1">
                    <span>{distribution.project.name}</span>
                    <span className="text-xs text-[#4c739a] dark:text-slate-400">{formatDate(distribution.sentAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="flex gap-2 pt-3 border-t border-[#e7edf3] dark:border-slate-800">
              <button
                onClick={onEdit}
                className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
