export default function InteropHubLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header skeleton */}
      <div className="relative overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-br from-muted/30 to-transparent p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-muted/60" />
            <div className="h-4 w-64 animate-pulse rounded-md bg-muted/40" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-36 animate-pulse rounded-lg bg-muted/50" />
            <div className="h-10 w-28 animate-pulse rounded-lg bg-muted/40" />
            <div className="h-10 w-24 animate-pulse rounded-lg bg-muted/40" />
          </div>
        </div>
      </div>

      {/* KPI card skeletons */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl border border-border/50 bg-card/50 p-4"
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-muted/30 to-transparent" />
            <div className="flex items-start justify-between">
              <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
              <div className="h-9 w-9 animate-pulse rounded-xl bg-muted/40" />
            </div>
            <div className="mt-4 h-7 w-16 animate-pulse rounded bg-muted/60" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted/30" />
          </div>
        ))}
      </div>

      {/* Chart + Health grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Volume chart skeleton */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-border/50 bg-card/50">
          <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
            <div className="space-y-1.5">
              <div className="h-4 w-32 animate-pulse rounded bg-muted/50" />
              <div className="h-3 w-48 animate-pulse rounded bg-muted/30" />
            </div>
            <div className="flex gap-3">
              <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
            </div>
          </div>
          <div className="flex h-48 items-end gap-1.5 p-5">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="flex flex-1 items-end gap-0.5">
                <div
                  className="flex-1 animate-pulse rounded-t-md bg-muted/40"
                  style={{ height: `${20 + Math.random() * 60}%`, animationDelay: `${i * 100}ms` }}
                />
                <div
                  className="flex-1 animate-pulse rounded-t-md bg-muted/30"
                  style={{ height: `${15 + Math.random() * 50}%`, animationDelay: `${i * 100 + 50}ms` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Health skeleton */}
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
          <div className="border-b border-border/30 px-5 py-4">
            <div className="h-4 w-36 animate-pulse rounded bg-muted/50" />
            <div className="mt-1.5 h-3 w-44 animate-pulse rounded bg-muted/30" />
          </div>
          <div className="space-y-2.5 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/30 bg-background/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-muted/50" />
                  <div className="h-3.5 flex-1 animate-pulse rounded bg-muted/40" />
                  <div className="h-3 w-12 animate-pulse rounded bg-muted/30" />
                </div>
                <div className="mt-2.5 h-1.5 w-full animate-pulse rounded-full bg-muted/30" />
                <div className="mt-1.5 flex justify-between">
                  <div className="h-2.5 w-16 animate-pulse rounded bg-muted/20" />
                  <div className="h-2.5 w-12 animate-pulse rounded bg-muted/20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
          <div className="space-y-1.5">
            <div className="h-4 w-40 animate-pulse rounded bg-muted/50" />
            <div className="h-3 w-52 animate-pulse rounded bg-muted/30" />
          </div>
          <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
        </div>

        {/* Table header */}
        <div className="flex gap-4 border-b border-border/30 px-5 py-3">
          {[48, 32, 56, 80, 64, 48].map((w, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-muted/30" style={{ width: `${w}px` }} />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/20 last:border-0 px-5 py-3.5"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="h-3.5 w-16 animate-pulse rounded bg-muted/30" />
            <div className="h-4 w-4 animate-pulse rounded bg-muted/30" />
            <div className="h-3.5 w-20 animate-pulse rounded bg-muted/40" />
            <div className="h-3.5 flex-1 animate-pulse rounded bg-muted/30" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-muted/30" />
            <div className="h-3.5 w-14 animate-pulse rounded bg-muted/20" />
          </div>
        ))}
      </div>
    </div>
  );
}
