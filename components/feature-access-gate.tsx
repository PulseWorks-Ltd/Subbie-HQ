"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

// Pages a locked organisation must always be able to reach (Task 1.3) —
// account settings (My Settings tab always works; the Organisation tab's
// Billing section, admin-only, is where "Manage subscription" lives) and
// /activate itself, which now lives inside this same route group (Task
// 1.1) and would otherwise be hidden behind its own lock message —
// exactly the page meant to resolve that lock. Logging out and the
// account menu itself aren't page routes, so they need no exemption
// here — TopNav renders unconditionally regardless of gating (see
// app/(app)/layout.tsx).
const EXEMPT_PATHS = ["/settings", "/activate"];

function isExempt(pathname: string | null): boolean {
  if (!pathname) return false;
  return EXEMPT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

// Replaces a blanket redirect-away-from-everything gate (Task 1.2): the
// main nav and shell always render (see the layout), and only the actual
// page content underneath gets swapped for this friendly message —
// feature-by-feature, not a whole-app dead end. isGated is computed once,
// server-side, in the layout (session + membership + accessStatus are
// already known there) — this component's only job is deciding, per
// route, whether to honour that gate or let an exempt page through.
export function FeatureAccessGate({
  isGated,
  isAdmin,
  children
}: {
  isGated: boolean;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (!isGated || isExempt(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16 mx-8 mt-8">
      <p className="font-bold mb-1">Active access required</p>
      <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5 text-center max-w-sm">
        {isAdmin
          ? "You'll need an active subscription or pilot access to use this."
          : "Ask your organisation admin to activate access to use this."}
      </p>
      {isAdmin && (
        <Link
          href="/activate"
          className="h-10 px-4 flex items-center rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
        >
          Activate access
        </Link>
      )}
    </div>
  );
}
