"use client";

import { useState } from "react";
import Link from "next/link";
import { UseAsDayWorksSheetAction, type TaggableItem } from "@/components/day-works/use-as-day-works-sheet-action";

export type PictureItem = {
  id: string;
  source: "update" | "variation-photo";
  href: string;
  linkedLabel: string;
  linkedHref: string;
  createdAt: Date;
  defaultVariationItemId: string | null;
};

type FilterKey = "all" | "update" | "variation-photo";

export function PicturesView({
  items,
  projectId,
  taggableItems,
  defaultRatePerHour
}: {
  items: PictureItem[];
  projectId: string;
  taggableItems: TaggableItem[];
  defaultRatePerHour: string;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const filteredItems = items.filter((item) => filter === "all" || item.source === filter);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold">Pictures</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          Every photo uploaded on this project, from Updates and Variations/Site Instructions.
        </p>
      </div>

      <div className="flex gap-1 border-b border-[#e7edf3] dark:border-slate-800">
        {([
          ["all", "All"],
          ["update", "Updates"],
          ["variation-photo", "Variations / SI"]
        ] as [FilterKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${
              filter === key
                ? "text-primary border-primary"
                : "text-[#4c739a] dark:text-slate-400 border-transparent hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">No photos yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Photos attached to Updates or Variations/Site Instructions will show up here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="flex flex-col gap-1">
              <a href={item.href} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.href}
                  alt={item.linkedLabel}
                  className="aspect-square w-full rounded-lg object-cover border border-[#e7edf3] dark:border-slate-800"
                />
              </a>
              <Link
                href={item.linkedHref}
                className="text-xs text-[#4c739a] dark:text-slate-400 hover:text-primary truncate"
              >
                {item.linkedLabel}
              </Link>
              <div className="flex items-center gap-1 text-primary">
                <UseAsDayWorksSheetAction
                  projectId={projectId}
                  source={{ type: item.source === "update" ? "update-attachment" : "variation-photo", id: item.id }}
                  taggableItems={taggableItems}
                  defaultVariationItemId={item.defaultVariationItemId}
                  defaultRatePerHour={defaultRatePerHour}
                />
                <span className="text-[11px] font-bold">Day Works Sheet</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
