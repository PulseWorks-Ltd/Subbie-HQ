"use client";

import { useEffect, useRef, useState } from "react";

// Small reusable kebab-menu wrapper (Task 4: declutter "Use as Day Works
// Sheet" / "Use as QA Record" off every photo thumbnail into an overflow
// menu instead of always-visible badges/rows). Purely presentational —
// each menu item is one of the existing action components rendered with
// variant="menu-item"; this wrapper doesn't know or care what they do, so
// neither conversion action's own logic changes at all.
export function AttachmentOverflowMenu({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="More actions"
        className="size-6 flex items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-700 shadow-sm text-[#4c739a] dark:text-slate-400 hover:text-primary"
      >
        <span className="material-symbols-outlined text-base leading-none">more_vert</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}
