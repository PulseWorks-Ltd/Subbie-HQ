import type { ExternalAction } from "@prisma/client";
import { RequestActionDialog } from "@/components/external-actions/request-action-dialog";
import { ExternalActionList } from "@/components/external-actions/external-action-list";

type ContactOption = { id: string; name: string; email: string | null; role: string | null };

export function VariationExternalActionsSection({
  projectId,
  itemId,
  actions,
  contacts
}: {
  projectId: string;
  itemId: string;
  actions: ExternalAction[];
  contacts: ContactOption[];
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">External Actions</h3>
        <RequestActionDialog projectId={projectId} target={{ variationItemId: itemId }} contacts={contacts} />
      </div>

      {actions.length === 0 ? (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          No requests sent for this item yet.
        </p>
      ) : (
        <ExternalActionList actions={actions} />
      )}
    </div>
  );
}
