import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { getOrganisationsOverview } from "@/lib/platform-admin-organisations";
import { OrganisationsAdminView } from "@/components/platform-admin/organisations-admin-view";

// Same gate pattern as /platform-admin/ai-usage (see that page's comment) —
// access is checked here directly rather than in a shared layout, so this
// page keeps working exactly the same way even if the layout changes.
// Any user without isPlatformAdmin gets an ordinary 404, not a permission-
// denied page that would confirm this route exists.
export default async function PlatformAdminOrganisationsPage() {
  const session = await auth();
  if (!session?.user?.id || !(await isPlatformAdmin(session.user.id))) {
    notFound();
  }

  const organisations = await getOrganisationsOverview();

  return <OrganisationsAdminView organisations={organisations} />;
}
