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
        <li key={index} className="flex items-start gap-2 text-on-surface-variant">
          <span className="material-symbols-outlined text-accent-electric text-lg mt-0.5">check_circle</span>
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
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
      <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface mb-3">{h1}</h1>
      <p className="text-lg text-on-surface-variant mb-10">{heroHook}</p>

      <section className="mb-10">
        <h2 className="font-heading text-lg font-bold text-on-surface mb-3">The Reality</h2>
        <p className="text-on-surface-variant whitespace-pre-line">{reality}</p>
      </section>

      <section className="mb-10">
        <h2 className="font-heading text-lg font-bold text-on-surface mb-3">Where Subcontractors Lose Money</h2>
        <BulletList items={lossScenarios} />
      </section>

      <section className="mb-10">
        <h2 className="font-heading text-lg font-bold text-on-surface mb-3">What The Contract Actually Requires</h2>
        <p className="text-on-surface-variant">{contractRequirements}</p>
      </section>

      <section className="mb-10">
        <h2 className="font-heading text-lg font-bold text-on-surface mb-3">How Subbie HQ Helps</h2>
        <BulletList items={howWeHelp} />
      </section>

      <section className="mb-10">
        <h2 className="font-heading text-lg font-bold text-on-surface mb-3">From Site Event → Evidence</h2>
        <p className="text-on-surface-variant">{workflow}</p>
      </section>

      <section className="mb-10">
        <h2 className="font-heading text-lg font-bold text-on-surface mb-3">Why This Matters</h2>
        <p className="text-on-surface-variant">{whyItMatters}</p>
      </section>

      <section>
        <p className="font-heading text-xl sm:text-2xl font-extrabold tracking-tight text-on-surface mb-2">{BRAND_LINE}</p>
        <p className="text-on-surface-variant mb-6">{BRAND_SUBLINE}</p>
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
      </section>
    </div>
  );
}
