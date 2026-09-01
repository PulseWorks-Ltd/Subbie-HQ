import Link from "next/link";

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-sm text-[#4c739a] dark:text-slate-400 hover:text-primary">
      {label}
    </Link>
  );
}

// Un-linked, greyed-out entries for Phase 2 roadmap topics — gives every
// column its final shape now so future pages just slot in as a link, no
// footer rebuild needed (per the marketing-site brief's footer requirement).
function FooterPlaceholder({ label }: { label: string }) {
  return <span className="text-sm text-[#4c739a]/50 dark:text-slate-400/40">{label}</span>;
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-background-dark px-4 sm:px-8 py-12">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8">
        <div className="col-span-2 md:col-span-1">
          <Link href="/" className="flex items-center gap-2 text-[#0d141b] dark:text-slate-50 mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mark-light.png" alt="" className="size-7 dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mark-dark.png" alt="" className="size-7 hidden dark:block" />
            <span className="text-base font-bold tracking-tight">Subbie HQ</span>
          </Link>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Contract and commercial management for subcontractors.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[#0d141b] dark:text-slate-50 mb-1">
            Features
          </p>
          <FooterLink href="/features/contract-review" label="Contract Review" />
          <FooterLink href="/features/variations" label="Site Instructions & Variations" />
          <FooterLink href="/features/project-diary" label="Project Diary" />
          <FooterLink href="/features/dayworks" label="Dayworks" />
          <FooterLink href="/features/approvals-automation" label="Approvals & Automation" />
          <FooterLink href="/features/quality-assurance" label="Quality Assurance & H&S" />
          <FooterLink href="/features/insurance" label="Insurance Compliance" />
          <FooterLink href="/features/team-permissions" label="Team & Permissions" />
          <FooterLink href="/features/scope-programme" label="Scope & Programme" />
          <FooterPlaceholder label="Payment Claims" />
          <FooterPlaceholder label="Project Documents" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[#0d141b] dark:text-slate-50 mb-1">
            Industries
          </p>
          <FooterLink href="/industries/scaffolding" label="Scaffolding Contractors" />
          <FooterLink href="/industries/painting" label="Painting Contractors" />
          <FooterLink href="/industries/masonry" label="Masonry Contractors" />
          <FooterLink href="/industries/residential-builders" label="Residential Builders" />
          <FooterPlaceholder label="Electricians" />
          <FooterPlaceholder label="Plumbers" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[#0d141b] dark:text-slate-50 mb-1">
            Compare & Guides
          </p>
          <FooterLink href="/compare/spreadsheets-and-paper" label="vs Spreadsheets & Paper" />
          <FooterLink href="/guides/late-or-non-compliant-claims" label="Late or Non-Compliant Claims" />
          {/* Draft-only pages (see the "DRAFT" banner on each) — pulled from
              nav/indexing until actually written; routes stay reachable
              directly, see app/sitemap.ts and app/robots.ts. */}
          <FooterPlaceholder label="Payment Claims Under the CCA" />
          <FooterPlaceholder label="Site Instruction vs Variation" />
          <FooterPlaceholder label="vs Generic Construction Software" />
          <FooterPlaceholder label="More guides coming soon" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[#0d141b] dark:text-slate-50 mb-1">
            Company
          </p>
          <FooterLink href="/pricing" label="Pricing" />
          <FooterLink href="/login" label="Login" />
          <FooterLink href="/signup" label="Start Free Trial" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-[#e7edf3] dark:border-slate-800">
        <p className="text-xs text-[#4c739a] dark:text-slate-400">
          © {new Date().getFullYear()} Subbie HQ. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
