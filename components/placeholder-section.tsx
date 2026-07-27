export function PlaceholderSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#e7edf3] dark:border-slate-700 px-6 py-10 text-center">
      <h2 className="text-lg font-bold mb-1">{title}</h2>
      <p className="text-sm text-[#4c739a] dark:text-slate-400">{description}</p>
    </div>
  );
}
