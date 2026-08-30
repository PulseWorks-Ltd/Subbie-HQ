import Link from "next/link";

// Purely a nav convenience between the platform-admin pages — does NOT
// re-gate access itself. Each page under here keeps its own existing,
// independent isPlatformAdmin check (see ai-usage/page.tsx and
// organisations/page.tsx) and 404s for anyone without it; this layout adds
// no new access logic, so it can't accidentally loosen or duplicate that.
export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-background-dark px-4 sm:px-8 py-3">
        <nav className="max-w-6xl mx-auto flex items-center gap-6">
          <span className="text-sm font-bold text-[#0d141b] dark:text-slate-50">Platform Admin</span>
          <Link href="/platform-admin/ai-usage" className="text-sm font-medium text-[#4c739a] dark:text-slate-400 hover:text-primary">
            AI Usage
          </Link>
          <Link
            href="/platform-admin/organisations"
            className="text-sm font-medium text-[#4c739a] dark:text-slate-400 hover:text-primary"
          >
            Organisations & Users
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
