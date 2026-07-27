import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLaunchpadProjects } from "@/lib/launchpad";
import { LaunchpadView } from "@/components/launchpad/launchpad-view";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const projects = await getLaunchpadProjects(session.user.id);

  return <LaunchpadView initialProjects={projects} />;
}
