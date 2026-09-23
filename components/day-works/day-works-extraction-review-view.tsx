"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Sheet = {
  id: string;
  attachmentFileName: string;
  sheetNumber: string | null;
  teamLeaderCount: number | null;
  teamMemberCount: number | null;
  totalHours: number | null;
  ratePerHour: number | null;
  date: string | null;
  startTime: string | null;
  finishTime: string | null;
  task: string | null;
  notes: string | null;
  weather: string | null;
  location: string | null;
  confidence: number | null;
  extractedSiReference: string | null;
  matchStatus: string;
  matchedVariationItemId: string | null;
  matchReason: string | null;
  userAction: string;
  newItemReference: string | null;
  newItemTitle: string | null;
  filedAt: string | null;
};

type CandidateVariationItem = { id: string; reference: string; title: string; closed: boolean };

const MATCH_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  matched: { label: "MATCHED", color: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300" },
  likely_match: { label: "LIKELY MATCH", color: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" },
  new: { label: "NEW", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  unresolved: { label: "UNRESOLVED", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" }
};

const ACTION_LABELS: Record<string, string> = {
  pending: "Use suggestion",
  match_existing: "Match to existing item",
  create_new: "Create new item",
  ignore: "Don't file this sheet"
};

const LOW_CONFIDENCE_THRESHOLD = 0.6;

function effectiveAction(sheet: Sheet): string {
  if (sheet.userAction !== "pending") return sheet.userAction;
  if (sheet.matchStatus === "matched") return "match_existing";
  if (sheet.matchStatus === "new") return "create_new";
  return "ignore";
}

// The target group a sheet resolves to — used to show one "Convert to
// Variation" checkbox per distinct target rather than one per row.
function targetGroupKey(sheet: Sheet): string | null {
  const action = effectiveAction(sheet);
  if (action === "match_existing") return sheet.matchedVariationItemId ? `existing:${sheet.matchedVariationItemId}` : null;
  if (action === "create_new") return sheet.newItemReference ? `new:${sheet.newItemReference.trim().toUpperCase()}` : null;
  return null;
}

function formatCurrency(amount: number | null) {
  return amount == null ? "—" : amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

export function DayWorksExtractionReviewView({
  projectId,
  extraction,
  candidateVariationItems
}: {
  projectId: string;
  extraction: {
    id: string;
    status: string;
    extractionError: string | null;
    emailSubject: string;
    emailSender: string;
    sheets: Sheet[];
  };
  candidateVariationItems: CandidateVariationItem[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [convertTargets, setConvertTargets] = useState<Set<string>>(new Set());
  const [isRetrying, setIsRetrying] = useState(false);
  const [isFiling, setIsFiling] = useState(false);
  const [isIgnoring, setIsIgnoring] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // The extraction runs fire-and-forget after this page's own redirect —
  // poll while it's still working so the user sees the sheets appear
  // without a manual refresh, same shape as the mobile Incoming Emails
  // queue's own polling.
  useEffect(() => {
    if (extraction.status !== "extracting") return;
    const interval = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(interval);
  }, [extraction.status, router]);

  const unfiledSheets = useMemo(() => extraction.sheets.filter((sheet) => !sheet.filedAt), [extraction.sheets]);
  const filedSheets = useMemo(() => extraction.sheets.filter((sheet) => sheet.filedAt), [extraction.sheets]);

  const targetGroups = useMemo(() => {
    const groups = new Map<string, { label: string; count: number; isSiteInstruction: boolean; variationItemId: string | null }>();
    for (const sheet of unfiledSheets) {
      const key = targetGroupKey(sheet);
      if (!key) continue;
      const action = effectiveAction(sheet);
      if (groups.has(key)) {
        groups.get(key)!.count += 1;
        continue;
      }
      if (action === "match_existing") {
        const item = candidateVariationItems.find((c) => c.id === sheet.matchedVariationItemId);
        groups.set(key, { label: item ? `${item.reference} — ${item.title}` : "Selected item", count: 1, isSiteInstruction: true, variationItemId: sheet.matchedVariationItemId });
      } else {
        groups.set(key, { label: `${sheet.newItemReference} (new)`, count: 1, isSiteInstruction: sheet.newItemReference ? /^\s*SI[\s-]?\d/i.test(sheet.newItemReference) : false, variationItemId: null });
      }
    }
    return groups;
  }, [unfiledSheets, candidateVariationItems]);

  async function patchSheet(sheetId: string, patch: Record<string, unknown>) {
    setSavingId(sheetId);
    await fetch(`/api/projects/${projectId}/day-works-extractions/${extraction.id}/sheets/${sheetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    setSavingId(null);
    router.refresh();
  }

  function toggleSelected(sheetId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(sheetId)) next.delete(sheetId);
      else next.add(sheetId);
      return next;
    });
  }

  async function handleRetry() {
    setIsRetrying(true);
    setActionError(null);
    const response = await fetch(`/api/projects/${projectId}/day-works-extractions/${extraction.id}/retry`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setIsRetrying(false);
    if (!response.ok) {
      setActionError(typeof data.error === "string" ? data.error : "Retry failed.");
      return;
    }
    router.refresh();
  }

  async function handleFileSelected() {
    if (selected.size === 0) return;
    setIsFiling(true);
    setActionError(null);
    const convertToVariationItemIds = Array.from(convertTargets)
      .map((key) => targetGroups.get(key)?.variationItemId)
      .filter((id): id is string => Boolean(id));
    const response = await fetch(`/api/projects/${projectId}/day-works-extractions/${extraction.id}/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetIds: Array.from(selected), convertToVariationItemIds })
    });
    const data = await response.json().catch(() => ({}));
    setIsFiling(false);
    if (!response.ok) {
      setActionError(typeof data.error === "string" ? data.error : "Could not file the selected sheets.");
      return;
    }
    setSelected(new Set());
    router.refresh();
  }

  async function handleIgnoreSelected() {
    if (selected.size === 0) return;
    setIsIgnoring(true);
    setActionError(null);
    await fetch(`/api/projects/${projectId}/day-works-extractions/${extraction.id}/ignore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetIds: Array.from(selected) })
    });
    setIsIgnoring(false);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="max-w-5xl mx-auto py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold">Day Works Batch — Review</h1>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          {extraction.emailSubject} · from {extraction.emailSender}
        </p>
      </div>

      {extraction.status === "extracting" && (
        <p className="text-sm rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 p-3">
          Reading the attachment(s) — this page will update automatically once it's done.
        </p>
      )}

      {extraction.status === "failed" && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 flex items-center justify-between gap-3">
          <p className="text-sm">{extraction.extractionError ?? "Extraction failed."}</p>
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-60 shrink-0"
          >
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}
      {extraction.extractionError && extraction.status !== "failed" && (
        <p className="text-xs text-amber-700 dark:text-amber-400 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3">
          {extraction.extractionError}
        </p>
      )}

      {unfiledSheets.length > 0 && (
        <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="text-left text-[#4c739a] dark:text-slate-400 border-b border-[#e7edf3] dark:border-slate-700">
                <th className="p-2 w-8"></th>
                <th className="p-2">Sheet</th>
                <th className="p-2">Task</th>
                <th className="p-2 text-right">Hours</th>
                <th className="p-2 text-right">Rate</th>
                <th className="p-2">Match</th>
                <th className="p-2">Action</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {unfiledSheets.map((sheet) => {
                const action = effectiveAction(sheet);
                const isExpanded = expandedId === sheet.id;
                const isLowConfidence = sheet.confidence != null && sheet.confidence < LOW_CONFIDENCE_THRESHOLD;
                const isSaving = savingId === sheet.id;
                const statusInfo = MATCH_STATUS_LABELS[sheet.matchStatus] ?? MATCH_STATUS_LABELS.unresolved;
                const needsCandidate = action === "match_existing";
                const needsNewFields = action === "create_new";

                return (
                  <Fragment key={sheet.id}>
                    <tr className={`border-b border-[#e7edf3] dark:border-slate-800 align-top ${isLowConfidence ? "bg-amber-50/60 dark:bg-amber-950/10" : ""}`}>
                      <td className="p-2">
                        <input type="checkbox" checked={selected.has(sheet.id)} onChange={() => toggleSelected(sheet.id)} />
                      </td>
                      <td className="p-2">
                        <p className="font-medium">{sheet.sheetNumber ?? "—"}</p>
                        <p className="text-[10px] text-[#4c739a] dark:text-slate-400">{sheet.attachmentFileName}</p>
                        {isLowConfidence && <p className="text-[10px] text-amber-700 dark:text-amber-400">Low confidence — check carefully</p>}
                      </td>
                      <td className="p-2 max-w-[16rem]">
                        <input
                          value={sheet.task ?? ""}
                          onChange={(event) => patchSheet(sheet.id, { task: event.target.value || null })}
                          disabled={isSaving}
                          className="w-full h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.25"
                          value={sheet.totalHours ?? ""}
                          onChange={(event) => patchSheet(sheet.id, { totalHours: event.target.value ? Number(event.target.value) : null })}
                          disabled={isSaving}
                          className="w-20 h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1 text-right"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={sheet.ratePerHour ?? ""}
                          onChange={(event) => patchSheet(sheet.id, { ratePerHour: event.target.value ? Number(event.target.value) : null })}
                          disabled={isSaving}
                          className="w-20 h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1 text-right"
                        />
                      </td>
                      <td className="p-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${statusInfo.color}`}>{statusInfo.label}</span>
                        {sheet.extractedSiReference && <p className="text-[10px] text-[#4c739a] dark:text-slate-400 mt-1">On sheet: {sheet.extractedSiReference}</p>}
                        {sheet.matchReason && <p className="text-[10px] text-[#4c739a] dark:text-slate-400">{sheet.matchReason}</p>}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-col gap-1 min-w-[10rem]">
                          <select
                            value={action}
                            disabled={isSaving}
                            onChange={(event) => patchSheet(sheet.id, { userAction: event.target.value })}
                            className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                          >
                            {Object.entries(ACTION_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          {needsCandidate && (
                            <select
                              value={sheet.matchedVariationItemId ?? ""}
                              disabled={isSaving}
                              onChange={(event) => patchSheet(sheet.id, { userAction: "match_existing", matchedVariationItemId: event.target.value || null })}
                              className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                            >
                              <option value="">Select…</option>
                              {candidateVariationItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.reference} — {item.title}
                                  {item.closed ? " (closed)" : ""}
                                </option>
                              ))}
                            </select>
                          )}
                          {needsNewFields && (
                            <>
                              <input
                                placeholder="Reference"
                                value={sheet.newItemReference ?? ""}
                                disabled={isSaving}
                                onChange={(event) => patchSheet(sheet.id, { userAction: "create_new", newItemReference: event.target.value || null })}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                              />
                              <input
                                placeholder="Title"
                                value={sheet.newItemTitle ?? ""}
                                disabled={isSaving}
                                onChange={(event) => patchSheet(sheet.id, { userAction: "create_new", newItemTitle: event.target.value || null })}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                              />
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <button onClick={() => setExpandedId(isExpanded ? null : sheet.id)} className="text-primary font-bold hover:underline">
                          {isExpanded ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-[#e7edf3] dark:border-slate-800">
                        <td colSpan={8} className="p-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <label className="flex flex-col gap-1">
                              Team leaders
                              <input
                                type="number"
                                min={0}
                                value={sheet.teamLeaderCount ?? ""}
                                onChange={(event) => patchSheet(sheet.id, { teamLeaderCount: event.target.value ? Number(event.target.value) : null })}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              Team members
                              <input
                                type="number"
                                min={0}
                                value={sheet.teamMemberCount ?? ""}
                                onChange={(event) => patchSheet(sheet.id, { teamMemberCount: event.target.value ? Number(event.target.value) : null })}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              Date
                              <input
                                type="date"
                                value={sheet.date ?? ""}
                                onChange={(event) => patchSheet(sheet.id, { date: event.target.value || null })}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              Location
                              <input
                                value={sheet.location ?? ""}
                                onChange={(event) => patchSheet(sheet.id, { location: event.target.value || null })}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                              />
                            </label>
                            <label className="flex flex-col gap-1 col-span-2">
                              Notes
                              <input
                                value={sheet.notes ?? ""}
                                onChange={(event) => patchSheet(sheet.id, { notes: event.target.value || null })}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                              />
                            </label>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {targetGroups.size > 0 && (
            <div className="p-3 border-t border-[#e7edf3] dark:border-slate-800 flex flex-col gap-1.5">
              {Array.from(targetGroups.entries()).map(([key, group]) => (
                <label key={key} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={convertTargets.has(key)}
                    disabled={!group.isSiteInstruction}
                    onChange={(event) =>
                      setConvertTargets((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(key);
                        else next.delete(key);
                        return next;
                      })
                    }
                  />
                  Also give <span className="font-bold">{group.label}</span> a Variation identity ({group.count} sheet
                  {group.count === 1 ? "" : "s"}) — no $ value is set automatically
                </label>
              ))}
            </div>
          )}

          {actionError && <p className="text-xs text-red-600 dark:text-red-400 p-3">{actionError}</p>}

          <div className="p-3 border-t border-[#e7edf3] dark:border-slate-800 flex items-center justify-between">
            <p className="text-xs text-[#4c739a] dark:text-slate-400">{selected.size} selected</p>
            <div className="flex gap-2">
              <button
                onClick={handleIgnoreSelected}
                disabled={selected.size === 0 || isIgnoring}
                className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold disabled:opacity-60"
              >
                {isIgnoring ? "Ignoring..." : "Ignore selected"}
              </button>
              <button
                onClick={handleFileSelected}
                disabled={selected.size === 0 || isFiling}
                className="h-9 px-4 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
              >
                {isFiling ? "Filing..." : "File selected"}
              </button>
            </div>
          </div>
        </div>
      )}

      {unfiledSheets.length === 0 && extraction.status !== "extracting" && extraction.status !== "failed" && (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">Every sheet in this batch has been filed or ignored.</p>
      )}

      {filedSheets.length > 0 && (
        <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4">
          <p className="text-sm font-bold mb-2">Filed ({filedSheets.length})</p>
          <div className="flex flex-col gap-1 text-xs text-[#4c739a] dark:text-slate-400">
            {filedSheets.map((sheet) => (
              <p key={sheet.id}>
                {sheet.sheetNumber ?? sheet.attachmentFileName} — {sheet.task ?? "—"} ({formatCurrency(sheet.totalHours && sheet.ratePerHour ? sheet.totalHours * sheet.ratePerHour : null)})
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
