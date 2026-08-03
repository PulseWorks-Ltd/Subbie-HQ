"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

// Persistent, not a one-time redirect — a locked organisation keeps full
// nav access (see FeatureAccessGate), so this is how /activate stays
// reachable at any time rather than only being landed on once at signup
// (Task 1.2). Sits below TopNav, not sticky itself — TopNav is already
// sticky, stacking two sticky bars wastes vertical space for something
// that isn't urgent enough to need to follow scroll. Suppressed on
// /activate itself — telling someone to activate while they're already on
// the activate page is just noise.
export function AccessBanner() {
  const pathname = usePathname();
  if (pathname === "/activate") return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-400 text-sm text-center py-2 px-4">
      Your organisation doesn&apos;t have active access yet.{" "}
      <Link href="/activate" className="font-bold hover:underline">
        Activate now
      </Link>
    </div>
  );
}
