import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";

// Deliberately tiny and read-only — exists so ActivateAccessView can poll
// for a few seconds right after a Checkout redirect, since the webhook
// that actually grants access is asynchronous and can arrive slightly
// after the browser lands back in the app (Task 2). Not admin-gated like
// most billing routes; accessStatus isn't sensitive and any member of the
// organisation already sees it via the layout/activate page itself.
export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getOrganisationMembership(userId);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ accessStatus: membership.organisation.accessStatus });
}
