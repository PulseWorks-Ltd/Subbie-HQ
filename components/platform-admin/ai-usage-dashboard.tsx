"use client";

import { useEffect, useState } from "react";

type UsagePeriod = "this_month" | "last_30_days" | "all_time";

type FeatureSummary = { feature: string; calls: number; costUsd: number; avgCostUsd: number; failures: number };
type OrgSummary = {
  organisationId: string | null;
  organisationName: string;
  calls: number;
  costUsd: number;
  capUsd: number | null;
  monthToDateSpendUsd: number;
};
type TrendPoint = { date: string; costUsd: number };
type Summary = { totalCostUsd: number; totalCalls: number; byFeature: FeatureSummary[]; byOrganisation: OrgSummary[]; trend: TrendPoint[] };

type LogRow = {
  id: string;
  feature: string;
  organisationId: string | null;
  organisationName: string | null;
  userId: string | null;
  userName: string | null;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  success: boolean;
  errorMessage: string | null;
  contextRef: string | null;
  createdAt: string;
};
type LogsResult = { logs: LogRow[]; total: number; page: number; pageSize: number };
type FilterOptions = { features: string[]; organisations: { id: string; name: string }[] };

const PERIOD_LABELS: Record<UsagePeriod, string> = {
  this_month: "This month",
  last_30_days: "Last 30 days",
  all_time: "All time"
};

// "contract_review" -> "Contract Review" — plain string feature tags (see
// lib/ai-usage.ts's AI_FEATURES) never need a label lookup table kept in
// sync; any new feature just displays sensibly automatically.
function featureLabel(feature: string): string {
  return feature
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-NZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function AiUsageDashboard({
  initialPeriod,
  initialSummary,
  initialLogs,
  filterOptions
}: {
  initialPeriod: UsagePeriod;
  initialSummary: Summary;
  initialLogs: LogsResult;
  filterOptions: FilterOptions;
}) {
  const [period, setPeriod] = useState<UsagePeriod>(initialPeriod);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editCapValue, setEditCapValue] = useState("");
  const [editNoCap, setEditNoCap] = useState(false);
  const [savingCap, setSavingCap] = useState(false);

  const [logs, setLogs] = useState<LogsResult>(initialLogs);
  const [logsLoading, setLogsLoading] = useState(false);
  const [featureFilter, setFeatureFilter] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [successFilter, setSuccessFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    fetch(`/api/platform-admin/ai-usage/summary?period=${period}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    setLogsLoading(true);
    const params = new URLSearchParams();
    if (featureFilter) params.set("feature", featureFilter);
    if (orgFilter) params.set("organisationId", orgFilter);
    if (successFilter) params.set("success", successFilter);
    if (fromFilter) params.set("from", fromFilter);
    if (toFilter) params.set("to", toFilter);
    params.set("page", String(page));

    fetch(`/api/platform-admin/ai-usage/logs?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setLogs(data);
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [featureFilter, orgFilter, successFilter, fromFilter, toFilter, page]);

  const maxTrendCost = Math.max(...summary.trend.map((t) => t.costUsd), 0.01);
  const totalPages = Math.max(Math.ceil(logs.total / logs.pageSize), 1);

  function startEditingCap(row: OrgSummary) {
    setEditingOrgId(row.organisationId);
    setEditCapValue(row.capUsd !== null ? String(row.capUsd) : "");
    setEditNoCap(row.capUsd === null);
  }

  async function saveCap(organisationId: string) {
    setSavingCap(true);
    try {
      const res = await fetch(`/api/platform-admin/ai-usage/organisations/${organisationId}/cap`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capUsd: editNoCap ? null : Number(editCapValue) })
      });
      if (res.ok) {
        const { organisation } = await res.json();
        setSummary((prev) => ({
          ...prev,
          byOrganisation: prev.byOrganisation.map((row) =>
            row.organisationId === organisationId ? { ...row, capUsd: organisation.aiMonthlySpendCapUsd } : row
          )
        }));
        setEditingOrgId(null);
      }
    } finally {
      setSavingCap(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight">AI Usage &amp; Cost</h1>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">Platform-owner only — Grok API cost and usage across every organisation.</p>
      </div>

      <div className="flex gap-1 border-b border-[#e7edf3] dark:border-slate-800">
        {(Object.keys(PERIOD_LABELS) as UsagePeriod[]).map((key) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${
              period === key
                ? "text-primary border-primary"
                : "text-[#4c739a] dark:text-slate-400 border-transparent hover:text-primary"
            }`}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${summaryLoading ? "opacity-50" : ""}`}>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
          <div className="text-xs font-bold uppercase text-[#4c739a] dark:text-slate-400">Total AI cost</div>
          <div className="text-3xl font-black mt-1">{formatUsd(summary.totalCostUsd)}</div>
          <div className="text-xs text-[#4c739a] dark:text-slate-400 mt-1">{PERIOD_LABELS[period]}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
          <div className="text-xs font-bold uppercase text-[#4c739a] dark:text-slate-400">Total AI calls</div>
          <div className="text-3xl font-black mt-1">{summary.totalCalls}</div>
          <div className="text-xs text-[#4c739a] dark:text-slate-400 mt-1">{PERIOD_LABELS[period]}</div>
        </div>
      </div>

      <section className={`bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-4 ${summaryLoading ? "opacity-50" : ""}`}>
        <h2 className="text-sm font-bold">Cost trend</h2>
        {summary.trend.length === 0 ? (
          <p className="text-sm text-[#4c739a] dark:text-slate-400">No AI usage logged in this period.</p>
        ) : (
          <div className="flex items-end gap-1 h-32 overflow-x-auto">
            {summary.trend.map((point) => (
              <div key={point.date} className="flex flex-col items-center justify-end h-full gap-1 min-w-[10px]" title={`${point.date}: ${formatUsd(point.costUsd)}`}>
                <div
                  className="w-2.5 bg-primary rounded-t"
                  style={{ height: `${Math.max((point.costUsd / maxTrendCost) * 100, 2)}%` }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={`bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-3 ${summaryLoading ? "opacity-50" : ""}`}>
        <h2 className="text-sm font-bold">By feature</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase text-[#4c739a] dark:text-slate-400 border-b border-[#e7edf3] dark:border-slate-800">
                <th className="py-2 pr-4">Feature</th>
                <th className="py-2 pr-4">Calls</th>
                <th className="py-2 pr-4">Cost</th>
                <th className="py-2 pr-4">Avg/call</th>
                <th className="py-2 pr-4">Failures</th>
              </tr>
            </thead>
            <tbody>
              {summary.byFeature.map((row) => (
                <tr key={row.feature} className="border-b border-[#e7edf3] dark:border-slate-800 last:border-0">
                  <td className="py-2 pr-4 font-medium">{featureLabel(row.feature)}</td>
                  <td className="py-2 pr-4">{row.calls}</td>
                  <td className="py-2 pr-4">{formatUsd(row.costUsd)}</td>
                  <td className="py-2 pr-4">{formatUsd(row.avgCostUsd)}</td>
                  <td className="py-2 pr-4">{row.failures > 0 ? <span className="text-red-600 dark:text-red-400">{row.failures}</span> : row.failures}</td>
                </tr>
              ))}
              {summary.byFeature.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-[#4c739a] dark:text-slate-400">
                    No AI usage logged in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-3 ${summaryLoading ? "opacity-50" : ""}`}>
        <h2 className="text-sm font-bold">By organisation</h2>
        <p className="text-xs text-[#4c739a] dark:text-slate-400 -mt-2">
          &quot;Spend / cap&quot; is always the current calendar month — a pilot-phase safety cap, not billing. Amber = 80%+ of cap, red = at or over cap (AI calls blocked).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase text-[#4c739a] dark:text-slate-400 border-b border-[#e7edf3] dark:border-slate-800">
                <th className="py-2 pr-4">Organisation</th>
                <th className="py-2 pr-4">Calls</th>
                <th className="py-2 pr-4">Cost ({PERIOD_LABELS[period]})</th>
                <th className="py-2 pr-4">Spend / cap (this month)</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {summary.byOrganisation.map((row) => {
                const ratio = row.capUsd !== null && row.capUsd > 0 ? row.monthToDateSpendUsd / row.capUsd : null;
                const atOrOverCap = row.capUsd !== null && row.monthToDateSpendUsd >= row.capUsd;
                const nearCap = !atOrOverCap && ratio !== null && ratio >= 0.8;
                const isEditing = editingOrgId === row.organisationId;
                return (
                  <tr key={row.organisationId ?? "none"} className="border-b border-[#e7edf3] dark:border-slate-800 last:border-0">
                    <td className="py-2 pr-4 font-medium">{row.organisationName}</td>
                    <td className="py-2 pr-4">{row.calls}</td>
                    <td className="py-2 pr-4">{formatUsd(row.costUsd)}</td>
                    <td className="py-2 pr-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={editNoCap}
                            value={editCapValue}
                            onChange={(e) => setEditCapValue(e.target.value)}
                            className="h-8 w-24 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm disabled:opacity-40"
                          />
                          <label className="flex items-center gap-1 text-xs">
                            <input type="checkbox" checked={editNoCap} onChange={(e) => setEditNoCap(e.target.checked)} />
                            No cap
                          </label>
                        </div>
                      ) : (
                        <span
                          className={
                            atOrOverCap
                              ? "text-red-600 dark:text-red-400 font-bold"
                              : nearCap
                                ? "text-amber-600 dark:text-amber-400 font-bold"
                                : ""
                          }
                        >
                          {formatUsd(row.monthToDateSpendUsd)} / {row.capUsd !== null ? formatUsd(row.capUsd) : "no cap"}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {!row.organisationId ? null : isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveCap(row.organisationId as string)}
                            disabled={savingCap}
                            className="h-7 px-2 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-60"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingOrgId(null)}
                            disabled={savingCap}
                            className="h-7 px-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditingCap(row)}
                          className="h-7 px-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:border-primary hover:text-primary"
                        >
                          Edit cap
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {summary.byOrganisation.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-[#4c739a] dark:text-slate-400">
                    No AI usage logged in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-4">
        <h2 className="text-sm font-bold">Raw log</h2>

        <div className="flex flex-wrap gap-2">
          <select
            value={featureFilter}
            onChange={(e) => {
              setPage(1);
              setFeatureFilter(e.target.value);
            }}
            className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
          >
            <option value="">All features</option>
            {filterOptions.features.map((f) => (
              <option key={f} value={f}>
                {featureLabel(f)}
              </option>
            ))}
          </select>
          <select
            value={orgFilter}
            onChange={(e) => {
              setPage(1);
              setOrgFilter(e.target.value);
            }}
            className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
          >
            <option value="">All organisations</option>
            {filterOptions.organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            value={successFilter}
            onChange={(e) => {
              setPage(1);
              setSuccessFilter(e.target.value);
            }}
            className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
          >
            <option value="">Success + failure</option>
            <option value="true">Success only</option>
            <option value="false">Failure only</option>
          </select>
          <input
            type="date"
            value={fromFilter}
            onChange={(e) => {
              setPage(1);
              setFromFilter(e.target.value);
            }}
            className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
          />
          <input
            type="date"
            value={toFilter}
            onChange={(e) => {
              setPage(1);
              setToFilter(e.target.value);
            }}
            className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
          />
        </div>

        <div className={`overflow-x-auto ${logsLoading ? "opacity-50" : ""}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase text-[#4c739a] dark:text-slate-400 border-b border-[#e7edf3] dark:border-slate-800">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Feature</th>
                <th className="py-2 pr-4">Organisation</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Model</th>
                <th className="py-2 pr-4">Tokens</th>
                <th className="py-2 pr-4">Cost</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Ref</th>
              </tr>
            </thead>
            <tbody>
              {logs.logs.map((log) => (
                <tr key={log.id} className="border-b border-[#e7edf3] dark:border-slate-800 last:border-0 align-top">
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                  <td className="py-2 pr-4">{featureLabel(log.feature)}</td>
                  <td className="py-2 pr-4">{log.organisationName ?? "—"}</td>
                  <td className="py-2 pr-4">{log.userName ?? "—"}</td>
                  <td className="py-2 pr-4">{log.model}</td>
                  <td className="py-2 pr-4">{log.totalTokens ?? "—"}</td>
                  <td className="py-2 pr-4">{log.costUsd !== null ? formatUsd(log.costUsd) : "—"}</td>
                  <td className="py-2 pr-4">
                    {log.success ? (
                      <span className="text-green-700 dark:text-green-400">OK</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400" title={log.errorMessage ?? undefined}>
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs text-[#4c739a] dark:text-slate-400">{log.contextRef ?? "—"}</td>
                </tr>
              ))}
              {logs.logs.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-[#4c739a] dark:text-slate-400">
                    No matching log entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-[#4c739a] dark:text-slate-400">
            {logs.total} entr{logs.total === 1 ? "y" : "ies"} — page {logs.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
