import { z } from "zod";
import { validatePhaseShares } from "./contract-schedule";

// Extracted out of app/api/projects/[projectId]/contract-schedule/items/route.ts
// — that file originally exported these directly for the [itemId] and
// confirm-extraction routes to import, which worked fine under plain `tsc`
// but fails Next.js's own route-export-shape check ("next build"'s
// "Checking validity of types" step): an app/api/.../route.ts file may
// only export the HTTP method handlers (GET/POST/etc.) and a small set of
// route config fields — any other export makes the whole build fail with
// "X is not a valid Route export field." This was a real, deploy-blocking
// production build failure, not a hypothetical one. Moving the shared
// schemas/helper to a plain lib module (which has no such restriction)
// fixes it with no behavioural change — every consumer just imports from
// here instead.

// Shared by both create (items/route.ts) and full-replace edit
// ([itemId]/route.ts) — an item's components/phases are edited as one
// whole form, not piecemeal, so both routes accept the same nested shape
// and replace whatever existed before rather than diffing it. Progress
// checkpoints are the one thing that accumulates independently of this
// (see the separate /progress route) and is deliberately untouched by
// either of these.
export const componentInputSchema = z.object({
  kind: z.enum(["fixed", "weekly_hire"]),
  label: z.string().min(1),
  sortOrder: z.number().int().optional(),
  amount: z.number().min(0).nullable().optional(),
  weeklyRate: z.number().min(0).nullable().optional(),
  quotedDurationWeeks: z.number().min(0).nullable().optional(),
  phases: z
    .array(
      z.object({
        label: z.string().min(1),
        sharePercent: z.number().min(0).max(100),
        sortOrder: z.number().int().optional()
      })
    )
    .optional()
});

export const itemInputSchema = z.object({
  description: z.string().min(1),
  sectionLabel: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  components: z.array(componentInputSchema).min(1)
});

// Same shapes, but every component/phase may carry back its own existing
// id — used only by the [itemId] PATCH route so an edit can update rows in
// place (preserving their progress checkpoints) rather than deleting and
// recreating everything on every save. A row with no id is a new one.
const componentUpdateInputSchema = componentInputSchema.extend({
  id: z.string().optional(),
  phases: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        sharePercent: z.number().min(0).max(100),
        sortOrder: z.number().int().optional()
      })
    )
    .optional()
});
export const itemUpdateInputSchema = itemInputSchema.extend({
  components: z.array(componentUpdateInputSchema).min(1)
});
export type ComponentUpdateInput = z.infer<typeof componentUpdateInputSchema>;

// A "fixed" component needs its phase shares to sum to 100; a
// "weekly_hire" component has no phases at all (its progress attaches
// directly to the component, see lib/contract-schedule.ts).
export function validateComponents(components: z.infer<typeof componentInputSchema>[]): string | null {
  for (const component of components) {
    if (component.kind === "fixed") {
      const error = validatePhaseShares(component.phases ?? []);
      if (error) return `"${component.label}": ${error}`;
    }
  }
  return null;
}
