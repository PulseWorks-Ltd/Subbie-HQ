// Shared client-side editing shapes for a contract item's components/
// phases — used by the manual add/edit dialog and the quote-extraction
// review screen alike, since both ultimately edit the exact same nested
// shape before POSTing it to either the plain create/update routes or the
// confirm-extraction route (which all validate/save it identically).
export type ComponentKind = "fixed" | "weekly_hire";
export type PhaseState = { id?: string; label: string; sharePercent: string };
export type ComponentState = {
  id?: string;
  kind: ComponentKind;
  label: string;
  amount: string;
  weeklyRate: string;
  quotedDurationWeeks: string;
  phases: PhaseState[];
};

export function blankComponent(): ComponentState {
  return { kind: "fixed", label: "", amount: "", weeklyRate: "", quotedDurationWeeks: "", phases: [{ label: "Supply", sharePercent: "100" }] };
}

export function phaseShareTotal(component: ComponentState): number {
  return component.phases.reduce((sum, phase) => sum + (Number(phase.sharePercent) || 0), 0);
}

// Converts a component's client-side string-typed form state into the
// numeric payload every write route (create item, update item, confirm-
// extraction) expects.
export function componentStateToPayload(component: ComponentState) {
  return {
    id: component.id,
    kind: component.kind,
    label: component.label,
    amount: component.kind === "fixed" ? Number(component.amount || 0) : undefined,
    weeklyRate: component.kind === "weekly_hire" ? Number(component.weeklyRate || 0) : undefined,
    quotedDurationWeeks: component.kind === "weekly_hire" && component.quotedDurationWeeks ? Number(component.quotedDurationWeeks) : undefined,
    phases:
      component.kind === "fixed"
        ? component.phases.map((phase) => ({ id: phase.id, label: phase.label, sharePercent: Number(phase.sharePercent || 0) }))
        : undefined
  };
}
