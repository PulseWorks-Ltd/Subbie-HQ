"use client";

import { useState } from "react";
import Link from "next/link";

const FEATURE_LINKS = [
  { href: "/features/contract-review", label: "Contract Review" },
  { href: "/features/variations", label: "Site Instructions & Variations" },
  { href: "/features/project-diary", label: "Project Diary" },
  { href: "/features/dayworks", label: "Dayworks" },
  { href: "/features/approvals-automation", label: "Approvals & Automation" },
  { href: "/features/quality-assurance", label: "Quality Assurance & H&S" },
  { href: "/features/insurance", label: "Insurance Compliance" },
  { href: "/features/team-permissions", label: "Team & Permissions" },
  { href: "/features/scope-programme", label: "Scope & Programme" }
];

const INDUSTRY_LINKS = [
  { href: "/industries/scaffolding", label: "Scaffolding Contractors" },
  { href: "/industries/painting", label: "Painting Contractors" },
  { href: "/industries/masonry", label: "Masonry Contractors" },
  { href: "/industries/residential-builders", label: "Residential Builders" }
];

type NavLink = { href: string; label: string; disabled?: boolean };

// Both currently disabled: draft-only pages (DRAFT banner), pulled from
// nav/indexing until actually written — same treatment as the footer's
// greyed-out Phase 2 placeholders. Routes stay reachable directly; see
// app/sitemap.ts and app/robots.ts.
const GUIDE_LINKS: NavLink[] = [
  { href: "/guides/payment-claims-construction-contracts-act", label: "Payment Claims Under the CCA", disabled: true },
  { href: "/guides/site-instruction-vs-variation", label: "Site Instruction vs Variation", disabled: true }
];

function NavDropdown({ label, links }: { label: string; links: NavLink[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className="text-sm font-bold text-[#4c739a] dark:text-slate-400 hover:text-primary flex items-center gap-1"
        onClick={() => setIsOpen((open) => !open)}
      >
        {label}
        <span className="material-symbols-outlined text-base">expand_more</span>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 pt-2 z-50">
          <div className="flex flex-col rounded-lg border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-background-dark shadow-lg py-2 min-w-56">
            {links.map((link) =>
              link.disabled ? (
                <span key={link.href} className="px-4 py-2 text-sm font-medium text-[#0d141b]/40 dark:text-slate-50/30">
                  {link.label}
                </span>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-sm font-medium text-[#0d141b] dark:text-slate-50 hover:bg-[#e7edf3] dark:hover:bg-slate-800"
                >
                  {link.label}
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function MarketingHeader() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <header className="flex items-center justify-between border-b border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-background-dark px-4 sm:px-8 py-3 sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-3 text-[#0d141b] dark:text-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark-light.png" alt="" className="size-8 dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark-dark.png" alt="" className="size-8 hidden dark:block" />
        <h2 className="text-lg font-bold leading-tight tracking-tight">Subbie HQ</h2>
      </Link>

      <nav className="hidden md:flex items-center gap-6">
        <NavDropdown label="Features" links={FEATURE_LINKS} />
        <Link href="/pricing" className="text-sm font-bold text-[#4c739a] dark:text-slate-400 hover:text-primary">
          Pricing
        </Link>
        <NavDropdown label="Industries" links={INDUSTRY_LINKS} />
        <NavDropdown label="Guides" links={GUIDE_LINKS} />
      </nav>

      <div className="hidden md:flex items-center gap-3">
        <Link
          href="/login"
          className="h-9 px-3 flex items-center text-sm font-bold text-[#4c739a] dark:text-slate-400 hover:text-primary"
        >
          Login
        </Link>
        <Link
          href="/signup"
          className="h-9 px-4 flex items-center rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
        >
          Start Free Trial
        </Link>
      </div>

      <button
        className="md:hidden size-9 flex items-center justify-center rounded-lg border border-[#e7edf3] dark:border-slate-700"
        onClick={() => setIsMobileOpen((open) => !open)}
        aria-label="Toggle menu"
      >
        <span className="material-symbols-outlined">{isMobileOpen ? "close" : "menu"}</span>
      </button>

      {isMobileOpen && (
        <div className="absolute top-full left-0 right-0 md:hidden bg-white dark:bg-background-dark border-b border-[#e7edf3] dark:border-slate-800 flex flex-col p-4 gap-3">
          <p className="text-xs font-bold uppercase text-[#4c739a] dark:text-slate-400 mt-2">Features</p>
          {FEATURE_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium">
              {link.label}
            </Link>
          ))}
          <Link href="/pricing" className="text-sm font-bold mt-2">
            Pricing
          </Link>
          <p className="text-xs font-bold uppercase text-[#4c739a] dark:text-slate-400 mt-2">Industries</p>
          {INDUSTRY_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium">
              {link.label}
            </Link>
          ))}
          <p className="text-xs font-bold uppercase text-[#4c739a] dark:text-slate-400 mt-2">Guides</p>
          {GUIDE_LINKS.map((link) =>
            link.disabled ? (
              <span key={link.href} className="text-sm font-medium text-[#0d141b]/40 dark:text-slate-50/30">
                {link.label}
              </span>
            ) : (
              <Link key={link.href} href={link.href} className="text-sm font-medium">
                {link.label}
              </Link>
            )
          )}
          <div className="flex gap-3 mt-4">
            <Link
              href="/login"
              className="flex-1 h-10 flex items-center justify-center rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="flex-1 h-10 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-bold"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
