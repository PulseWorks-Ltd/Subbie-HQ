"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ModuleKey } from "@/lib/permissions";

const NAV_ITEMS: {
  label: string;
  segment: string;
  module: ModuleKey | null;
  anyOfModules?: ModuleKey[];
  adminOnly?: boolean;
}[] = [
  { label: "Overview", segment: "", module: null },
  { label: "Updates", segment: "updates", module: "updates" },
  { label: "Scope & Programme", segment: "scope-programme", module: null, anyOfModules: ["scope", "programme"] },
  { label: "Variations", segment: "variations", module: null, anyOfModules: ["variations", "site_instructions"] },
  { label: "Payment Claims", segment: "payment-claims", module: "payment_claims" },
  { label: "Health & Safety", segment: "health-safety", module: "health_safety" },
  { label: "Quality Assurance", segment: "quality-assurance", module: "quality_assurance" },
  { label: "Pictures", segment: "pictures", module: "pictures" },
  { label: "Correspondence", segment: "correspondence", module: "correspondence" },
  { label: "Contract", segment: "contract", module: "contract" },
  { label: "Settings", segment: "settings", module: null, adminOnly: true }
];

export function ProjectNav({
  projectId,
  unrestricted,
  isAdmin,
  modules
}: {
  projectId: string;
  unrestricted: boolean;
  isAdmin: boolean;
  modules: Record<string, boolean>;
}) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (unrestricted || isAdmin) return true;
    if (item.adminOnly) return false;
    if (item.anyOfModules) return item.anyOfModules.some((module) => Boolean(modules[module]));
    if (!item.module) return true;
    return Boolean(modules[item.module]);
  });

  return (
    <nav className="flex flex-col gap-1 w-48 shrink-0">
      {visibleItems.map((item) => {
        const href = `/projects/${projectId}${item.segment ? `/${item.segment}` : ""}`;
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

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
