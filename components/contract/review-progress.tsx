export function ReviewProgress() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-10 px-4 text-center">
      <span className="material-symbols-outlined text-3xl text-primary animate-spin mb-3">progress_activity</span>
      <p className="font-bold mb-1">Analyzing your contract against the standard form</p>
      <p className="text-sm text-[#4c739a] dark:text-slate-400">
        This checks every clause carefully — for a long contract it can take several minutes. It's running in the
        background, so feel free to carry on elsewhere in the project; this page updates on its own, and the
        result is here whenever you come back.
      </p>
    </div>
  );
}
