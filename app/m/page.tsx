import { auth } from "@/auth";
import { getLaunchpadProjects } from "@/lib/launchpad";

export default async function MobileProjectListPage() {
  const session = await auth();
  const projects = await getLaunchpadProjects(session!.user.id);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">Your Projects</h1>
      {projects.length === 0 ? (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          You don&apos;t have any projects yet — use the desktop app to create one.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <a
                href={`/m/${project.id}`}
                className="block rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 active:bg-[#e7edf3] dark:active:bg-slate-800"
              >
                <span className="font-bold">{project.name}</span>
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
