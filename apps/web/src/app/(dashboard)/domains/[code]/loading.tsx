export default function DomainLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="rounded-xl border border-gray-100 bg-gradient-to-r from-gray-50 to-white p-6 dark:border-gray-800 dark:from-gray-900 dark:to-gray-950">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-2">
            <div className="h-7 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3.5 w-64 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
              <div className="space-y-2 flex-1">
                <div className="h-6 w-14 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-20 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Synthesis */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 h-[320px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800/50" />
        <div className="lg:col-span-2 space-y-4">
          <div className="h-[150px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800/50" />
          <div className="h-[150px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800/50" />
        </div>
      </div>

      {/* Sub-domains */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800/50" />
        ))}
      </div>

      {/* Plannings */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-50 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    </div>
  );
}
