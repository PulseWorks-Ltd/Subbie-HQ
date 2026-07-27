import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const projects = await prisma.project.findMany({
    where: { members: { some: { userId: session.user.id } } },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold">Welcome back{session.user.name ? `, ${session.user.name}` : ""}</h1>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            The full Launchpad dashboard is coming next — for now, here are your projects.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="h-9 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium">
            Sign out
          </button>
        </form>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          You don&apos;t have any projects yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <a
                href={`/projects/${project.id}`}
                className="block rounded-lg border border-[#e7edf3] dark:border-slate-700 px-4 py-3 hover:border-primary"
              >
                <span className="font-medium">{project.name}</span>
                {project.code && (
                  <span className="ml-2 text-sm text-[#4c739a] dark:text-slate-400">{project.code}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
