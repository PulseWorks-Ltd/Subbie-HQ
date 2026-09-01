import { NextResponse } from "next/server";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { findSiteInstructionByReference } from "@/lib/variation-item-lifecycle";

// Called as the user types a reference when creating a new Site
// Instruction or Variation — the shared resolver behind the "SI-241 —
// CLOSED... is this the correct SI?" prompt. Scoped to this one project
// only (never across projects/companies). Requires either module, since a
// Variation is being created starting from a Site Instruction reference
// just as often as the reverse.
export async function GET(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [canVariations, canSiteInstructions] = await Promise.all([
    requireModuleAccess(projectId, userId, "variations"),
    requireModuleAccess(projectId, userId, "site_instructions")
  ]);
  if (!canVariations && !canSiteInstructions) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const reference = new URL(request.url).searchParams.get("reference")?.trim() ?? "";
  if (!reference) {
    return NextResponse.json({ result: { kind: "none" } });
  }

  const result = await findSiteInstructionByReference(projectId, reference);
  return NextResponse.json({ result });
}
