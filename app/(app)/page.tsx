import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDashboardFeed } from "@/lib/dashboard";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const items = await getDashboardFeed(session.user.id);

  return <DashboardView initialItems={items} />;
}
