import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDashboardFeed } from "@/lib/dashboard";
import { getUnreadUpdates } from "@/lib/updates-feed";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [items, unreadUpdates] = await Promise.all([
    getDashboardFeed(session.user.id),
    getUnreadUpdates(session.user.id)
  ]);

  return <DashboardView initialItems={items} initialUnreadUpdates={unreadUpdates} />;
}
