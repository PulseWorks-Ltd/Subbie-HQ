"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Clause, ContractDocument, ScopeItem } from "@prisma/client";
import { ScopeItemCard } from "@/components/scope/scope-item-card";
import { ScopeItemFormDialog } from "@/components/scope/scope-item-form-dialog";

type ScopeItemWithSource = ScopeItem & {
  sourceDocument: ContractDocument | null;
  sourceClause: Clause | null;
};
type DocumentWithClauses = ContractDocument & { clauses: Clause[] };

export function ScopeView({
  projectId,
  items,
  documents
}: {
  projectId: string;
  items: ScopeItemWithSource[];
  documents: DocumentWithClauses[];
}) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScopeItemWithSource | null>(null);

  const ambiguousCount = items.filter((item) => item.ambiguityFlag).length;
  const confirmedCount = items.filter((item) => item.status === "confirmed").length;

  function openCreateDialog() {
    setEditingItem(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(item: ScopeItemWithSource) {
    setEditingItem(item);
    setIsDialogOpen(true);
  }

  async function handleDelete(item: ScopeItemWithSource) {
    if (!confirm(`Delete scope item "${item.title}"?`)) return;
    await fetch(`/api/projects/${projectId}/scope/${item.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Scope</h2>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            What's included, and what still needs clarifying.
          </p>
        </div>
        <button
          onClick={openCreateDialog}
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shrink-0"
        >
          Add Scope Item
        </button>
      </div>

      {items.length > 0 && (
        <div className="flex gap-6 text-sm text-[#4c739a] dark:text-slate-400">
          <span>{items.length} total</span>
          <span>{confirmedCount} confirmed</span>
          {ambiguousCount > 0 && <span className="text-amber-600 font-medium">{ambiguousCount} ambiguous</span>}
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">No scope items yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
            Add what's included in scope, referencing the contract where useful.
          </p>
          <button
            onClick={openCreateDialog}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
          >
            Add Scope Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <ScopeItemCard
              key={item.id}
              item={item}
              onEdit={() => openEditDialog(item)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </div>
      )}

      <ScopeItemFormDialog
        projectId={projectId}
        documents={documents}
        item={editingItem}
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
