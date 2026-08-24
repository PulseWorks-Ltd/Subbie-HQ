"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UpdatesSearchBar({
  basePath,
  initialQuery,
  initialFrom,
  initialTo
}: {
  basePath: string;
  initialQuery: string;
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const hasActiveFilter = Boolean(initialQuery || initialFrom || initialTo);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  }

  function handleClear() {
    setQuery("");
    setFrom("");
    setTo("");
    router.push(basePath);
  }

  return (
    <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by keyword or Variation/SI reference..."
        className="flex-1 min-w-[160px] h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <input
        type="date"
        value={from}
        onChange={(event) => setFrom(event.target.value)}
        aria-label="From date"
        className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <span className="text-xs text-[#4c739a] dark:text-slate-400">to</span>
      <input
        type="date"
        value={to}
        onChange={(event) => setTo(event.target.value)}
        aria-label="To date"
        className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        type="submit"
        className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
      >
        Search
      </button>
      {hasActiveFilter && (
        <button
          type="button"
          onClick={handleClear}
          className="h-10 px-4 rounded-lg text-sm font-medium text-[#4c739a] dark:text-slate-400 hover:underline"
        >
          Clear
        </button>
      )}
    </form>
  );
}
