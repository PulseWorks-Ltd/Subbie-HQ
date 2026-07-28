export function StagingBanner() {
  if (process.env.APP_DB_ENV !== "staging") return null;

  return (
    <div className="sticky top-0 z-[60] bg-amber-500 text-amber-950 text-center text-xs font-bold py-1 tracking-wide">
      STAGING — this server is talking to the staging database, not production
    </div>
  );
}
