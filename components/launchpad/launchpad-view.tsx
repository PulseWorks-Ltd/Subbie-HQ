"use client";

import { useMemo, useState } from "react";
import type { LaunchpadProject } from "@/lib/launchpad";
import { ProjectCard } from "@/components/launchpad/project-card";
import { CreateProjectDialog } from "@/components/launchpad/create-project-dialog";

export function LaunchpadView({ initialProjects }: { initialProjects: LaunchpadProject[] }) {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return initialProjects;
    return initialProjects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) || project.code?.toLowerCase().includes(query)
    );
  }, [initialProjects, search]);

  return (
    <main className="flex-1 flex flex-col items-center">
      <div className="max-w-[1200px] w-full px-10 py-8">
        <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
          <div className="flex min-w-72 flex-col gap-2">
            <p className="text-[#0d141b] dark:text-slate-50 text-4xl font-black leading-tight tracking-[-0.033em]">
              Launchpad
            </p>
            <p className="text-[#4c739a] dark:text-slate-400 text-base font-normal leading-normal max-w-xl">
              Your active projects, at a glance.
            </p>
          </div>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="flex min-w-[140px] cursor-pointer items-center justify-center rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-lg mr-2">add</span>
            <span>Add New Project</span>
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#0d141b] dark:text-slate-50 text-[22px] font-bold leading-tight tracking-[-0.015em]">
            Projects
            <span className="ml-2 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full align-middle">
              {initialProjects.length}
            </span>
          </h2>
          {initialProjects.length > 0 && (
            <label className="flex items-center relative">
              <span className="material-symbols-outlined absolute left-3 text-[#4c739a] text-[18px]">search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-64 rounded-full bg-[#e7edf3] dark:bg-slate-800 border-transparent pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-[#4c739a]"
                placeholder="Search projects..."
              />
            </label>
          )}
        </div>

        {initialProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-20">
            <div className="size-16 rounded-full bg-[#e7edf3] dark:bg-slate-800 flex items-center justify-center text-[#4c739a] mb-4">
              <span className="material-symbols-outlined text-4xl">add</span>
            </div>
            <p className="text-[#0d141b] dark:text-slate-50 font-bold">No projects yet</p>
            <p className="text-[#4c739a] dark:text-slate-400 text-sm mt-1 mb-5">
              Create your first project to get started.
            </p>
            <button
              onClick={() => setIsDialogOpen(true)}
              className="flex items-center justify-center rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Add New Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
            <button
              onClick={() => setIsDialogOpen(true)}
              className="flex flex-col items-center justify-center bg-transparent rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 min-h-[220px] hover:border-primary/50 hover:bg-white dark:hover:bg-slate-900 transition-all cursor-pointer group"
            >
              <div className="size-16 rounded-full bg-[#e7edf3] dark:bg-slate-800 flex items-center justify-center text-[#4c739a] group-hover:bg-primary/10 group-hover:text-primary transition-colors mb-4">
                <span className="material-symbols-outlined text-4xl">add</span>
              </div>
              <p className="text-[#0d141b] dark:text-slate-50 font-bold">Start New Project</p>
            </button>
          </div>
        )}
      </div>

      <CreateProjectDialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </main>
  );
}
