import type { ExternalAction } from "@prisma/client";
import { EXTERNAL_ACTION_TYPE_LABELS } from "@/lib/external-action-types";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function statusBadge(action: ExternalAction) {
  if (action.status === "responded") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        Responded
      </span>
    );
  }
  if (action.status === "expired") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      Pending
    </span>
  );
}

// Read-only display of past/pending External Action requests (Task 4.1) —
// the response is shown purely as recorded evidence; nothing here changes
// any status on the source record automatically.
export function ExternalActionList({ actions }: { actions: ExternalAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {actions.map((action) => (
        <div
          key={action.id}
          className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-2.5 text-xs flex flex-col gap-1"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">{EXTERNAL_ACTION_TYPE_LABELS[action.type]}</span>
            {statusBadge(action)}
          </div>
          <p className="text-[#4c739a] dark:text-slate-400">
            Sent to {action.recipientName ?? action.recipientEmail} on {formatDate(action.sentAt)}
          </p>
          {action.status === "responded" && action.respondedAt && (
            <p className="text-[#0d141b] dark:text-slate-200">
              {action.responseChoice
                ? `${action.responseChoice === "approved" ? "Approved" : "Rejected"} by `
                : "Confirmed by "}
              <span className="font-bold">{action.responseName}</span> on {formatDate(action.respondedAt)}
              {action.responseComment && <span className="block text-[#4c739a] dark:text-slate-400 mt-0.5">"{action.responseComment}"</span>}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
