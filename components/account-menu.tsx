"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

// First dropdown/popover-style component in this codebase — every existing
// overlay is a full modal dialog (fixed inset-0 + backdrop), which doesn't
// fit a small account menu, so this is a plain click-outside-to-close panel
// rather than reusing that pattern.
export function AccountMenu({ userName, userEmail }: { userName: string | null; userEmail: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = (userName ?? userEmail).charAt(0).toUpperCase();

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-full hover:bg-[#e7edf3] dark:hover:bg-slate-800"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm ring-2 ring-primary/10 shrink-0">
          {initial}
        </span>
        <span className="hidden sm:inline text-sm font-medium max-w-[140px] truncate">{userName ?? userEmail}</span>
        <span className="material-symbols-outlined text-lg text-[#4c739a] dark:text-slate-400 hidden sm:inline">
          expand_more
        </span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1 z-50"
        >
          <div className="px-3 py-2 border-b border-[#e7edf3] dark:border-slate-800">
            <p className="text-sm font-bold truncate">{userName ?? userEmail}</p>
            {userName && <p className="text-xs text-[#4c739a] dark:text-slate-400 truncate">{userEmail}</p>}
          </div>
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#e7edf3] dark:hover:bg-slate-800"
            role="menuitem"
          >
            <span className="material-symbols-outlined text-lg">settings</span>
            Settings
          </Link>
          <button
            onClick={() => signOut({ redirectTo: "/login" })}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#e7edf3] dark:hover:bg-slate-800"
            role="menuitem"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
