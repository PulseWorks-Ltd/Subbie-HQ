import Link from "next/link";

// Shared across every industry page, defined once here so it's trivial to
// update in one place (and so future industry pages built on this template
// get it automatically) rather than four separately hardcoded copies.
const BRAND_LINE = "Construction doesn't have to be perfect. Your paperwork does.";
const BRAND_SUBLINE = "Stop letting missing paperwork become lost revenue.";

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2 text-[#4c739a] dark:text-slate-400">
          <span className="material-symbols-outlined text-primary text-lg mt-0.5">check_circle</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function IndustryPageView({
  h1,
  heroHook,
  reality,
  lossScenarios,
  contractRequirements,
  howWeHelp,
  workflow,
  whyItMatters
}: {
  h1: string;
  heroHook: string;
  reality: string;
  lossScenarios: string[];
  contractRequirements: string;
  howWeHelp: string[];
  workflow: string;
  whyItMatters: string;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">{h1}</h1>
      <p className="text-lg text-[#4c739a] dark:text-slate-400 mb-10">{heroHook}</p>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">The Reality</h2>
        <p className="text-[#4c739a] dark:text-slate-400 whitespace-pre-line">{reality}</p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">Where Subcontractors Lose Money</h2>
        <BulletList items={lossScenarios} />
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">What The Contract Actually Requires</h2>
        <p className="text-[#4c739a] dark:text-slate-400">{contractRequirements}</p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">How Subbie HQ Helps</h2>
        <BulletList items={howWeHelp} />
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">From Site Event → Evidence</h2>
        <p className="text-[#4c739a] dark:text-slate-400">{workflow}</p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">Why This Matters</h2>
        <p className="text-[#4c739a] dark:text-slate-400">{whyItMatters}</p>
      </section>

      <section>
        <p className="text-xl sm:text-2xl font-black tracking-tight mb-2">{BRAND_LINE}</p>
        <p className="text-[#4c739a] dark:text-slate-400 mb-6">{BRAND_SUBLINE}</p>
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
      </section>
    </div>
  );
}
