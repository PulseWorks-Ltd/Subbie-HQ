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
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className={`text-3xl sm:text-4xl font-black tracking-tight ${dek ? "mb-3" : "mb-10"}`}>{h1}</h1>
      {dek && <p className="text-lg font-bold text-primary mb-10">{dek}</p>}

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-2">The Problem</h2>
        <p className="text-[#4c739a] dark:text-slate-400">{problem}</p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-2">The Consequence</h2>
        <p className="text-[#4c739a] dark:text-slate-400">{consequence}</p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-2">How Subbie HQ Helps</h2>
        {helps.map((paragraph, index) => (
          <p key={index} className="text-[#4c739a] dark:text-slate-400 mb-3 last:mb-0">
            {paragraph}
          </p>
        ))}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-2">Expected Outcome</h2>
        <p className="text-[#4c739a] dark:text-slate-400">{outcome}</p>
      </section>

      {disclaimer && (
        <p className="text-sm italic text-[#4c739a] dark:text-slate-400 mb-8 border-l-2 border-[#e7edf3] dark:border-slate-800 pl-4">
          {disclaimer}
        </p>
      )}

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
