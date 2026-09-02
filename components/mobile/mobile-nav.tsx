"use client";

import { usePathname } from "next/navigation";

// Sticky bottom tab bar for the mobile shell — standard PWA/native-app
// placement, thumb-reachable, and doesn't compete with the already-sticky
// top header for vertical space. "Projects" covers both the project list
// and (once inside one) that project's Updates view, since mobile has no
// concept of "Updates" independent of a chosen project. "Hours on Site"
// is its own tab (not nested under a project) since its own first step is
// picking a project, same pattern as "Projects" itself — and it has no
// dedicated permission module (same as Tasks on desktop), so it's always
// shown. Incoming Emails is org-level, same as desktop, so it's a peer
// tab rather than nested under a project — hidden entirely if this org
// doesn't have the module enabled for this user, same gate desktop's
// TopNav applies, but that never hides the other two tabs.
export function MobileNav({ canSeeIncomingEmails }: { canSeeIncomingEmails: boolean }) {
  const pathname = usePathname();
  const isHoursOnSite = pathname?.startsWith("/m/dayworks");
  const isIncomingEmails = pathname?.startsWith("/m/incoming-emails");
  const isProjects = !isHoursOnSite && !isIncomingEmails;

  return (
    <nav className="sticky bottom-0 z-50 flex border-t border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900">
      <a
        href="/m"
        className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-bold ${
          isProjects ? "text-primary" : "text-[#4c739a] dark:text-slate-400"
        }`}
      >
        <span className="material-symbols-outlined text-xl">apartment</span>
        Projects
      </a>
      <a
        href="/m/dayworks"
        className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-bold ${
          isHoursOnSite ? "text-primary" : "text-[#4c739a] dark:text-slate-400"
        }`}
      >
        <span className="material-symbols-outlined text-xl">timer</span>
        Hours on Site
      </a>
      {canSeeIncomingEmails && (
        <a
          href="/m/incoming-emails"
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-bold ${
            isIncomingEmails ? "text-primary" : "text-[#4c739a] dark:text-slate-400"
          }`}
        >
          <span className="material-symbols-outlined text-xl">mark_email_unread</span>
          Incoming Emails
        </a>
      )}
    </nav>
  );
}
