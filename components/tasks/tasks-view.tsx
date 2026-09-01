"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Task, TaskStatus } from "@prisma/client";

type TaskWithItem = Task & { variationItem: { id: string; reference: string; title: string } | null };
type TaggableItem = { id: string; reference: string; title: string };

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  closed: "Closed"
};
const STATUS_STYLES: Record<TaskStatus, string> = {
  open: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  completed: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
};

function formatDate(date: Date | string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function TaskRow({ projectId, task }: { projectId: string; task: TaskWithItem }) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);

  async function transition(body: Record<string, unknown>) {
    setIsBusy(true);
    await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setIsBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[task.status]}`}>
            {STATUS_LABELS[task.status]}
          </span>
          <span className="font-bold text-sm">{task.title}</span>
        </div>
        {task.description && <p className="text-sm text-[#4c739a] dark:text-slate-400">{task.description}</p>}
        <div className="flex items-center gap-3 text-xs text-[#4c739a] dark:text-slate-400">
          {task.variationItem && (
            <Link href={`/projects/${projectId}/variations/${task.variationItem.id}`} className="font-medium text-primary hover:underline">
              {task.variationItem.reference} — {task.variationItem.title}
            </Link>
          )}
          {task.dueAt && <span>Due {formatDate(task.dueAt)}</span>}
          {task.completedAt && <span>Completed {formatDate(task.completedAt)}</span>}
          {task.closedAt && <span>Closed {formatDate(task.closedAt)}</span>}
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        {task.status === "open" && (
          <button onClick={() => transition({ moveToInProgress: true })} disabled={isBusy} className="h-8 px-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold disabled:opacity-60">
            Start
          </button>
        )}
        {(task.status === "open" || task.status === "in_progress") && (
          <button onClick={() => transition({ complete: true })} disabled={isBusy} className="h-8 px-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold disabled:opacity-60">
            Mark Complete
          </button>
        )}
        {task.status !== "closed" && (
          <button onClick={() => transition({ close: true })} disabled={isBusy} className="h-8 px-2 rounded-lg border border-red-300 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold disabled:opacity-60">
            Close
          </button>
        )}
        {task.status === "closed" && (
          <button onClick={() => transition({ reactivate: true })} disabled={isBusy} className="h-8 px-2 rounded-lg border border-primary text-primary text-xs font-bold disabled:opacity-60">
            Reactivate
          </button>
        )}
      </div>
    </div>
  );
}

export function TasksView({
  projectId,
  tasks,
  taggableItems
}: {
  projectId: string;
  tasks: TaskWithItem[];
  taggableItems: TaggableItem[];
}) {
  const router = useRouter();
  const [showClosed, setShowClosed] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [variationItemId, setVariationItemId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleTasks = tasks.filter((task) => showClosed || task.status !== "closed");
  const closedCount = tasks.filter((task) => task.status === "closed").length;

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    await fetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        variationItemId: variationItemId || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined
      })
    });
    setIsSubmitting(false);
    setTitle("");
    setDescription("");
    setVariationItemId("");
    setDueAt("");
    setIsFormOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Tasks</h2>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Work items, optionally linked to a Site Instruction or Variation. Completing a task doesn&apos;t close it —
            that&apos;s a separate step.
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen((open) => !open)}
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shrink-0"
        >
          {isFormOpen ? "Cancel" : "Add Task"}
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-xl border border-[#e7edf3] dark:border-slate-800 p-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Title
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Description <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              Link to SI/Variation <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <select
                value={variationItemId}
                onChange={(event) => setVariationItemId(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Not linked</option>
                {taggableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.reference} — {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              Due <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <input
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting ? "Adding..." : "Add Task"}
            </button>
          </div>
        </form>
      )}

      {closedCount > 0 && (
        <label className="flex items-center gap-2 text-xs font-medium text-[#4c739a] dark:text-slate-400">
          <input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} className="size-4" />
          Include {closedCount} closed
        </label>
      )}

      {visibleTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">No tasks yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">Add one to start tracking work items.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleTasks.map((task) => (
            <div key={task.id} id={task.id}>
              <TaskRow projectId={projectId} task={task} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
