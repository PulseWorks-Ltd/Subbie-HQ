import Link from "next/link";

export function GuideOutlineView({ h1, outline }: { h1: string; outline: string[] }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
      <div className="mb-8 rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3">
        <p className="text-sm font-bold text-status-warning">
          DRAFT — structure only, not published content
        </p>
        <p className="text-sm text-status-warning/80 mt-1">
          This page is a placeholder template. The outline below still needs a full writing pass and a
          legal-accuracy check against current legislation before it goes live.
        </p>
      </div>

      <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface mb-8">{h1}</h1>

      <section className="mb-10">
        <h2 className="font-heading text-lg font-bold text-on-surface mb-3">Suggested structure</h2>
        <ol className="flex flex-col gap-2 list-decimal list-inside text-on-surface-variant">
          {outline.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>
      </section>

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
