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
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
      <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface mb-4">{h1}</h1>
      {dek && <p className="text-lg text-on-surface-variant mb-10">{dek}</p>}

      <div className="flex flex-col gap-8 mb-10">{children}</div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/signup"
          className="h-11 px-6 flex items-center justify-center rounded-lg bg-accent-electric text-white text-sm font-bold hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] transition-all active:scale-95"
        >
          Start Free Trial
        </Link>
        <Link
          href="/pricing"
          className="h-11 px-6 flex items-center justify-center rounded-lg border border-outline-variant text-on-surface text-sm font-bold hover:bg-surface-variant transition-all active:scale-95"
        >
          See Pricing
        </Link>
      </div>
    </div>
  );
}
