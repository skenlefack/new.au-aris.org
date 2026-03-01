import { KpiCardSkeleton, TableSkeleton, LoadingShell } from '@/components/ui/Skeleton';

export default function QualityLoading() {
  return (
    <LoadingShell>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton rows={5} cols={5} />
      </div>
    </LoadingShell>
  );
}
