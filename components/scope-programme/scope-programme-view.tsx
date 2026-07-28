"use client";

import { useState } from "react";
import type { Clause, ContractDocument, ProgrammeItem, ScopeItem } from "@prisma/client";
import { ScopeView } from "@/components/scope/scope-view";
import { ProgrammeView } from "@/components/programme/programme-view";

export type ScopeProgrammeTab = "scope" | "programme";

type ScopeItemWithSource = ScopeItem & { sourceDocument: ContractDocument | null; sourceClause: Clause | null };
type DocumentWithClauses = ContractDocument & { clauses: Clause[] };
type ProgrammeItemWithSource = ProgrammeItem & { sourceDocument: ContractDocument | null };

export function ScopeProgrammeView({
  projectId,
  initialTab,
  canSeeScope,
  canSeeProgramme,
  scopeItems,
  scopeDocuments,
  programmeItems,
  programmeActiveDocument,
  initialTradeReference
}: {
  projectId: string;
  initialTab: ScopeProgrammeTab;
  canSeeScope: boolean;
  canSeeProgramme: boolean;
  scopeItems: ScopeItemWithSource[];
  scopeDocuments: DocumentWithClauses[];
  programmeItems: ProgrammeItemWithSource[];
  programmeActiveDocument: ContractDocument | null;
  initialTradeReference: string;
}) {
  const [tab, setTab] = useState<ScopeProgrammeTab>(initialTab);

  return (
    <div className="flex flex-col gap-6">
      {canSeeScope && canSeeProgramme && (
        <div className="flex gap-1 border-b border-[#e7edf3] dark:border-slate-800">
          {(
            [
              ["scope", "Scope"],
              ["programme", "Programme"]
            ] as [ScopeProgrammeTab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${
                tab === key
                  ? "text-primary border-primary"
                  : "text-[#4c739a] dark:text-slate-400 border-transparent hover:text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "scope" && canSeeScope && <ScopeView projectId={projectId} items={scopeItems} documents={scopeDocuments} />}
      {tab === "programme" && canSeeProgramme && (
        <ProgrammeView
          projectId={projectId}
          items={programmeItems}
          activeDocument={programmeActiveDocument}
          initialTradeReference={initialTradeReference}
        />
      )}
    </div>
  );
}
