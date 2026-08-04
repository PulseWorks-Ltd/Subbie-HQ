import Link from "next/link";

export function GuideOutlineView({ h1, outline }: { h1: string; outline: string[] }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="mb-8 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
          DRAFT — structure only, not published content
        </p>
        <p className="text-sm text-amber-800/80 dark:text-amber-300/80 mt-1">
          This page is a placeholder template. The outline below still needs a full writing pass and a
          legal-accuracy check against current legislation before it goes live.
        </p>
      </div>

      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-8">{h1}</h1>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">Suggested structure</h2>
        <ol className="flex flex-col gap-2 list-decimal list-inside text-[#4c739a] dark:text-slate-400">
          {outline.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>
      </section>

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
