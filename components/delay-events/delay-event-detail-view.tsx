"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DelayEvent, ExternalAction, VariationItem } from "@prisma/client";
import { DELAY_EVENT_STATUS_LABELS } from "@/lib/delay-events";
import { SendDelayNoticeDialog } from "@/components/delay-events/send-delay-notice-dialog";

type ContactOption = { id: string; name: string; email: string | null; role: string | null };
type DelayEventDetail = DelayEvent & {
  variationItem: Pick<VariationItem, "id" | "reference" | "title"> | null;
  externalActions: ExternalAction[];
};

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}
function toInputDate(date: Date | string | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function DelayEventDetailView({
  projectId,
  delayEvent,
  contacts
}: {
  projectId: string;
  delayEvent: DelayEventDetail;
  contacts: ContactOption[];
}) {
  const router = useRouter();
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isSavingField, setIsSavingField] = useState(false);
  const [daysAwarded, setDaysAwarded] = useState(delayEvent.daysAwarded != null ? String(delayEvent.daysAwarded) : "");
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSendNotice = delayEvent.status === "open" || delayEvent.status === "notice_sent";
  const canResolve = delayEvent.status === "open" || delayEvent.status === "notice_sent";

  async function patch(fields: Record<string, unknown>) {
    setIsSavingField(true);
    await fetch(`/api/projects/${projectId}/delay-events/${delayEvent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields)
    });
    setIsSavingField(false);
    router.refresh();
  }

  async function resolve(status: "awarded" | "rejected") {
    setError(null);
    if (status === "awarded" && daysAwarded === "") {
      setError("Enter the number of days awarded.");
      return;
    }
    setIsResolving(true);
    const response = await fetch(`/api/projects/${projectId}/delay-events/${delayEvent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolve: { status, daysAwarded: status === "awarded" ? Number(daysAwarded) : undefined } })
    });
    setIsResolving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not resolve this delay event.");
      return;
    }
    router.refresh();
  }

  async function closeEvent() {
    if (!confirm("Close this delay event administratively (e.g. superseded, withdrawn)?")) return;
    await patch({ status: "closed" });
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href={`/projects/${projectId}/delay-events`} className="text-xs text-primary hover:underline">
          ← All delay events
        </Link>
        <div className="flex items-start justify-between gap-3 mt-1">
          <h2 className="text-lg font-bold">{delayEvent.cause}</h2>
          <span className="text-xs font-bold px-2 py-1 rounded shrink-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {DELAY_EVENT_STATUS_LABELS[delayEvent.status]}
          </span>
        </div>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          {formatDate(delayEvent.startDate)}
          {delayEvent.endDate ? ` – ${formatDate(delayEvent.endDate)}` : " (ongoing)"}
          {delayEvent.variationItem && (
            <>
              {" · "}
              <Link href={`/projects/${projectId}/variations/${delayEvent.variationItem.id}`} className="text-primary hover:underline">
                {delayEvent.variationItem.reference} — {delayEvent.variationItem.title}
              </Link>
            </>
          )}
        </p>
      </div>

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold">Notice</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-xs text-[#4c739a] dark:text-slate-400">Clause reference</p>
            <p>{delayEvent.clauseReference ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-[#4c739a] dark:text-slate-400">Days claimed</p>
            <p>{delayEvent.daysClaimed ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-[#4c739a] dark:text-slate-400">Notice deadline</p>
            <input
              type="date"
              defaultValue={toInputDate(delayEvent.noticeDeadline)}
              onBlur={(event) => patch({ noticeDeadline: event.target.value || null })}
              disabled={isSavingField}
              className="h-8 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <p className="text-xs text-[#4c739a] dark:text-slate-400">Notice sent</p>
            <p>{delayEvent.noticeSentAt ? formatDate(delayEvent.noticeSentAt) : "Not yet sent"}</p>
          </div>
        </div>

        {canSendNotice && (
          <button
            onClick={() => setIsSendDialogOpen(true)}
            className="self-start h-9 px-3 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
          >
            {delayEvent.noticeSentAt ? "Send notice again" : "Draft & Send Notice"}
          </button>
        )}
      </div>

      {delayEvent.externalActions.length > 0 && (
        <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4 flex flex-col gap-2">
          <h3 className="text-sm font-bold mb-1">Notice history</h3>
          {delayEvent.externalActions.map((action) => (
            <div key={action.id} className="text-sm flex items-center justify-between gap-3 border-b border-[#e7edf3]/60 dark:border-slate-800 py-1.5 last:border-0">
              <span>
                Sent to {action.recipientName ?? action.recipientEmail} on {formatDate(action.sentAt)}
              </span>
              <span className="text-xs font-medium text-[#4c739a] dark:text-slate-400">
                {action.status === "responded" ? `Responded (${action.responseChoice ?? "—"})` : action.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {canResolve && (
        <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold">Resolve</h3>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            Once you've read the Main Contractor/Contract Administrator's response, record the outcome here — the days awarded can
            differ from what was claimed.
          </p>
          <div className="flex items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium w-32">
              Days awarded
              <input
                type="number"
                min={0}
                value={daysAwarded}
                onChange={(event) => setDaysAwarded(event.target.value)}
                className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
              />
            </label>
            <button
              onClick={() => resolve("awarded")}
              disabled={isResolving}
              className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              Mark Awarded
            </button>
            <button
              onClick={() => resolve("rejected")}
              disabled={isResolving}
              className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold disabled:opacity-60"
            >
              Mark Rejected
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button onClick={closeEvent} className="self-start text-xs font-medium text-[#4c739a] dark:text-slate-400 hover:underline">
            Close administratively instead (superseded, withdrawn)
          </button>
        </div>
      )}

      {delayEvent.status === "awarded" && (
        <p className="text-sm rounded-lg bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 p-3">
          Awarded {delayEvent.daysAwarded} day(s) Extension of Time on {formatDate(delayEvent.resolvedAt)}.
        </p>
      )}
      {delayEvent.status === "rejected" && (
        <p className="text-sm rounded-lg bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 p-3">
          Rejected on {formatDate(delayEvent.resolvedAt)}.
        </p>
      )}

      <SendDelayNoticeDialog
        projectId={projectId}
        delayEventId={delayEvent.id}
        contacts={contacts}
        open={isSendDialogOpen}
        onClose={() => setIsSendDialogOpen(false)}
      />
    </div>
  );
}
