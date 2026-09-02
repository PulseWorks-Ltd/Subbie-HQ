import Link from "next/link";

export function FeaturePageView({
  h1,
  dek,
  problem,
  consequence,
  helps,
  outcome,
  disclaimer
}: {
  h1: string;
  // Short, prominent lead-in shown directly under the H1 — for stating a
  // page's single clearest benefit before the reader has to read into
  // "The Problem"/"How Subbie HQ Helps". Optional so existing pages that
  // don't pass one render exactly as before. Same purpose as
  // GuideArticleView's own `dek` prop.
  dek?: string;
  problem: string;
  consequence: string;
  helps: string[];
  outcome: string;
  disclaimer?: string;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
      <h1 className={`font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface ${dek ? "mb-3" : "mb-10"}`}>
        {h1}
      </h1>
      {dek && <p className="text-lg font-bold text-accent-soft mb-10">{dek}</p>}

      <div className="flex flex-col gap-6">
        <section className="rounded-xl border border-white/5 bg-surface-card p-6">
          <h2 className="font-heading text-lg font-bold text-on-surface mb-2">The Problem</h2>
          <p className="text-on-surface-variant">{problem}</p>
        </section>

        <section className="rounded-xl border border-white/5 bg-surface-card p-6">
          <h2 className="font-heading text-lg font-bold text-on-surface mb-2">The Consequence</h2>
          <p className="text-on-surface-variant">{consequence}</p>
        </section>

        <section className="rounded-xl border border-white/5 bg-surface-card p-6">
          <h2 className="font-heading text-lg font-bold text-on-surface mb-2">How Subbie HQ Helps</h2>
          {helps.map((paragraph, index) => (
            <p key={index} className="text-on-surface-variant mb-3 last:mb-0">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="rounded-xl border border-accent-electric/20 bg-accent-electric/5 p-6">
          <h2 className="font-heading text-lg font-bold text-on-surface mb-2">Expected Outcome</h2>
          <p className="text-on-surface-variant">{outcome}</p>
        </section>
      </div>

      {disclaimer && (
        <p className="text-sm italic text-on-surface-variant/80 mt-8 border-l-2 border-outline-variant pl-4">
          {disclaimer}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-10">
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
