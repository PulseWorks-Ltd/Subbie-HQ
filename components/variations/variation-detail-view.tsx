"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  ContractTerms,
  Correspondence,
  Update,
  UpdateAttachment,
  VariationItem,
  VariationPackage,
  VariationPhoto
} from "@prisma/client";
import type { DayWorksSheetWithLineItems } from "@/lib/variation-package";
import { StatusBadge } from "@/components/badges/status-badge";
import { CountdownBadge } from "@/components/badges/countdown-badge";
import { VariationItemFormDialog } from "@/components/variations/variation-item-form-dialog";
import { VariationQuoteSection } from "@/components/variations/variation-quote-section";
import { VariationDayWorksSection } from "@/components/variations/variation-day-works-section";
import { VariationPhotosSection } from "@/components/variations/variation-photos-section";
import { VariationCorrespondenceSection } from "@/components/variations/variation-correspondence-section";
import { VariationLinkedUpdatesSection } from "@/components/variations/variation-linked-updates-section";
import { VariationPackageSection } from "@/components/variations/variation-package-section";
import { CreateVariationDialog } from "@/components/variations/create-variation-dialog";

type Author = { id: string; firstName: string | null; lastName: string | null; email: string };
type VariationItemRef = { id: string; reference: string; title: string };
type ContactOption = { id: string; name: string; email: string | null; role: string | null };
type UpdateWithReplies = Update & {
  author: Author;
  variationItem: VariationItemRef | null;
  attachments: UpdateAttachment[];
  replies: (Update & { author: Author; attachments: UpdateAttachment[] })[];
};

function formatDate(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export function VariationDetailView({
  projectId,
  item,
  dayWorksSheets,
  photos,
  correspondence,
  updates,
  contacts,
  taggableItems,
  contractTerms,
  packages
}: {
  projectId: string;
  item: VariationItem;
  dayWorksSheets: DayWorksSheetWithLineItems[];
  photos: VariationPhoto[];
  correspondence: Correspondence[];
  updates: UpdateWithReplies[];
  contacts: ContactOption[];
  taggableItems: VariationItem[];
  contractTerms: ContractTerms | null;
  packages: VariationPackage[];
}) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCreateVariationOpen, setIsCreateVariationOpen] = useState(false);
  const isSiteInstruction = item.type === "site_instruction";
  const hasVariation = item.variationCreatedAt != null;

  // Mirrors VariationDayWorksSection's own defaultRatePerHour derivation —
  // ContractTerms is one row per project (not per item), so this same
  // value applies regardless of which item a "Use as Day Works Sheet"
  // action ends up targeting from the Linked Updates section below.
  const defaultRatePerHour =
    contractTerms?.dayWorksRateNormal != null ? String(Number(contractTerms.dayWorksRateNormal)) : "";

  async function handleConfirmSuggested() {
    setIsConfirming(true);
    await fetch(`/api/projects/${projectId}/variation-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmSuggested: true })
    });
    setIsConfirming(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/projects/${projectId}/variations`}
          className="text-xs font-medium text-[#4c739a] dark:text-slate-400 hover:text-primary"
        >
          &larr; Variations
        </Link>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isSiteInstruction && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  Site Instruction
                </span>
              )}
              {hasVariation && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary">
                  Variation
                </span>
              )}
              <StatusBadge status={item.status} />
            </div>
            <h1 className="text-2xl font-bold">
              {item.reference} <span className="font-normal text-[#4c739a] dark:text-slate-400">· {item.title}</span>
            </h1>
            {item.description && (
              <p className="text-sm text-[#4c739a] dark:text-slate-400 mt-2 max-w-2xl">{item.description}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {isSiteInstruction && !hasVariation && (
              <button
                onClick={() => setIsCreateVariationOpen(true)}
                className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
              >
                Create Variation
              </button>
            )}
            <button
              onClick={() => setIsEditOpen(true)}
              className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
            >
              Edit
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-[#4c739a] dark:text-slate-400">
          {item.notifiedAt && <span>Notified {formatDate(item.notifiedAt)}</span>}
          {item.dueAt && (
            <span className="flex items-center gap-1.5">
              Due {formatDate(item.dueAt)}
              {item.status !== "complete" && <CountdownBadge date={item.dueAt} />}
            </span>
          )}
          {item.percentComplete != null && (
            <span className="font-bold text-[#0d141b] dark:text-slate-50">{Math.round(item.percentComplete)}% complete</span>
          )}
          {hasVariation && item.variationValue != null && (
            <span className="font-bold text-[#0d141b] dark:text-slate-50">
              ${Number(item.variationValue).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
            </span>
          )}
          {item.storageKey && (
            <a
              href={`/api/projects/${projectId}/variation-items/${item.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-primary hover:underline"
            >
              View source document
            </a>
          )}
        </div>

        {item.suggestedPercentComplete != null && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 px-4 py-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              An update suggested <strong>{Math.round(item.suggestedPercentComplete)}% complete</strong> — awaiting confirmation.
            </p>
            <button
              onClick={handleConfirmSuggested}
              disabled={isConfirming}
              className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60 shrink-0"
            >
              {isConfirming ? "Confirming..." : "Confirm"}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hasVariation && <VariationQuoteSection projectId={projectId} item={item} />}
        <VariationDayWorksSection
          projectId={projectId}
          itemId={item.id}
          dayWorksSheets={dayWorksSheets}
          contractTerms={contractTerms}
        />
        <VariationPhotosSection projectId={projectId} itemId={item.id} photos={photos} />
        <VariationCorrespondenceSection
          projectId={projectId}
          itemId={item.id}
          reference={item.reference}
          correspondence={correspondence}
        />
      </div>

      <VariationLinkedUpdatesSection
        projectId={projectId}
        updates={updates}
        contacts={contacts}
        taggableItems={taggableItems}
        defaultRatePerHour={defaultRatePerHour}
      />

      <VariationPackageSection
        projectId={projectId}
        itemId={item.id}
        item={item}
        dayWorksSheets={dayWorksSheets}
        photos={photos}
        correspondence={correspondence}
        contractTerms={contractTerms}
        packages={packages}
      />

      {isCreateVariationOpen && (
        <CreateVariationDialog
          projectId={projectId}
          itemId={item.id}
          onClose={() => setIsCreateVariationOpen(false)}
          onCreated={() => {
            setIsCreateVariationOpen(false);
            router.refresh();
          }}
        />
      )}

      <VariationItemFormDialog
        projectId={projectId}
        item={item}
        defaultType={item.type}
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
