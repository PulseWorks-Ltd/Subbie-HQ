"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Overview", segment: "" },
  { label: "Contract", segment: "contract" },
  { label: "Scope", segment: "scope" },
  { label: "Programme", segment: "programme" },
  { label: "Payment Claims", segment: "payment-claims" },
  { label: "Evidence", segment: "evidence" },
  { label: "Settings", segment: "settings" }
];

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 w-48 shrink-0">
      {NAV_ITEMS.map((item) => {
        const href = `/projects/${projectId}${item.segment ? `/${item.segment}` : ""}`;
        const isActive = pathname === href;

        return (
          <Link
            key={item.label}
            href={href}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-[#4c739a] dark:text-slate-400 hover:bg-[#e7edf3] dark:hover:bg-slate-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
