"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export function TopNav({
  userName,
  userEmail,
  isOrganisationAdmin
}: {
  userName: string | null;
  userEmail: string;
  isOrganisationAdmin: boolean;
}) {
  const pathname = usePathname();
  const isDashboard = pathname === "/";
  const isProjects = pathname === "/projects";
  const isTeam = pathname === "/team";
  const initial = (userName ?? userEmail).charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-between border-b border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-background-dark px-8 py-3 sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-3 text-[#0d141b] dark:text-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-light.png" alt="" className="size-8 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-dark.png" alt="" className="size-8 hidden dark:block" />
          <h2 className="text-lg font-bold leading-tight tracking-tight">Subbie HQ</h2>
        </Link>
        <Link
          href="/"
          className={`text-sm font-bold pb-1 border-b-2 ${
            isDashboard ? "text-primary border-primary" : "text-[#4c739a] dark:text-slate-400 border-transparent hover:text-primary"
          }`}
        >
          Dashboard
        </Link>
        <Link
          href="/projects"
          className={`text-sm font-bold pb-1 border-b-2 flex items-center gap-1.5 ${
            isProjects ? "text-primary border-primary" : "text-[#4c739a] dark:text-slate-400 border-transparent hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-lg">apartment</span>
          Projects
        </Link>
        {isOrganisationAdmin && (
          <Link
            href="/team"
            className={`text-sm font-bold pb-1 border-b-2 flex items-center gap-1.5 ${
              isTeam ? "text-primary border-primary" : "text-[#4c739a] dark:text-slate-400 border-transparent hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-lg">group</span>
            Team
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/get-app"
          className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium hover:bg-[#e7edf3] dark:hover:bg-slate-800 flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-lg">phone_iphone</span>
          <span className="hidden sm:inline">Get the app</span>
        </Link>
        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="text-sm font-medium">{userName ?? userEmail}</span>
        </div>
        <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm ring-2 ring-primary/10">
          {initial}
        </div>
        <button
          onClick={() => signOut({ redirectTo: "/login" })}
          className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium hover:bg-[#e7edf3] dark:hover:bg-slate-800"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
