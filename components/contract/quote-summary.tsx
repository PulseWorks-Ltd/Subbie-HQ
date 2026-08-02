"use client";

import type { ProjectQuote } from "@prisma/client";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

function formatDate(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

// Read-only — no comparison logic here (see this feature's task notes).
// Groundwork for a future Payment Claims comparison against this stored
// value.
export function QuoteSummary({ quote }: { quote: ProjectQuote | null }) {
  if (!quote) return null;

  const lineItems = Array.isArray(quote.lineItems) ? (quote.lineItems as { description: string; amount: number | null }[]) : [];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold">Quote</h3>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            Extracted from the document marked as the project's quote — stored for future reference, not yet
            compared against anything.
          </p>
        </div>
        {quote.quotedValue != null && (
          <p className="text-lg font-bold shrink-0">{formatCurrency(Number(quote.quotedValue))}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#4c739a] dark:text-slate-400 mb-3">
        {quote.quotedDate && <span>Dated {formatDate(quote.quotedDate)}</span>}
        <span>Extracted {formatDate(quote.extractedAt)}</span>
      </div>

      {quote.scopeSummary && <p className="text-sm mb-3">{quote.scopeSummary}</p>}

      {lineItems.length > 0 && (
        <div className="flex flex-col gap-1 mb-3 text-sm">
          {lineItems.map((item, index) => (
            <div key={index} className="flex items-center justify-between gap-2">
              <span className="truncate">{item.description}</span>
              {item.amount != null && <span className="font-bold shrink-0">{formatCurrency(item.amount)}</span>}
            </div>
          ))}
        </div>
      )}

      {quote.commercialNotes && (
        <p className="text-xs text-[#4c739a] dark:text-slate-400 border-t border-[#e7edf3] dark:border-slate-800 pt-2">
          {quote.commercialNotes}
        </p>
      )}
    </div>
  );
}
