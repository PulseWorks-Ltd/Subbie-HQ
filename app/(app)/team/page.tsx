import { redirect } from "next/navigation";

// Team management now lives inside the tabbed Settings page — this stays
// as a redirect-only stub (rather than being deleted outright) so any
// bookmark or stale link to the old URL still lands somewhere real, instead
// of a 404.
export default function TeamPage() {
  redirect("/settings?tab=team");
}
