import { KpiCardSkeleton, ChartSkeleton, LoadingShell } from '@/components/ui/Skeleton';

export default function AnalyticsLoading() {
  return (
    <LoadingShell>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    </LoadingShell>
  );
}
