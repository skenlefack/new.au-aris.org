export default function BiToolsLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--color-accent)]" />
        <p className="text-sm text-slate-400">Loading BI Tools...</p>
      </div>
    </div>
  );
}
