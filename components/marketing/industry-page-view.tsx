import Link from "next/link";

export function IndustryPageView({
  h1,
  intro,
  risksHeading,
  risks
}: {
  h1: string;
  intro: string;
  risksHeading: string;
  risks: string[];
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-6">{h1}</h1>
      <p className="text-[#4c739a] dark:text-slate-400 mb-8">{intro}</p>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">{risksHeading}</h2>
        <ul className="flex flex-col gap-2">
          {risks.map((risk, index) => (
            <li key={index} className="flex items-start gap-2 text-[#4c739a] dark:text-slate-400">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5">check_circle</span>
              <span>{risk}</span>
            </li>
          ))}
        </ul>
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
