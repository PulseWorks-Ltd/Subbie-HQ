"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-script";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="size-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 hover:bg-[#e7edf3] dark:hover:bg-slate-800 flex items-center justify-center"
    >
      <span className="material-symbols-outlined text-lg">{isDark ? "light_mode" : "dark_mode"}</span>
    </button>
  );
}
