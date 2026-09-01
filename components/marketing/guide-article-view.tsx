import type { ReactNode } from "react";
import Link from "next/link";

// Shared chrome for a real, published long-form guide — distinct from
// GuideOutlineView (a DRAFT-banner placeholder for outline-only guides
// still awaiting a full writing pass). This wraps genuinely finished
// content: the page itself supplies its own <section>/<h2>/<p>/<ul>
// markup using the same typographic classes as every other marketing
// page (FeaturePageView, IndustryPageView), so a guide with a different
// shape (numbered sections, mixed prose/lists) isn't forced into a rigid
// prop shape.
export function GuideArticleView({ h1, dek, children }: { h1: string; dek?: string; children: ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">{h1}</h1>
      {dek && <p className="text-lg text-[#4c739a] dark:text-slate-400 mb-10">{dek}</p>}

      <div className="flex flex-col gap-8 mb-10">{children}</div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/signup"
          className="h-11 px-6 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
        >
          Start Free Trial
        </Link>
        <Link
          href="/pricing"
          className="h-11 px-6 flex items-center justify-center rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
        >
          See Pricing
        </Link>
      </div>
    </div>
  );
}
