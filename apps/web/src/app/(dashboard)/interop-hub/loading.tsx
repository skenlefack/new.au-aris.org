import { KpiCardSkeleton, TableSkeleton, LoadingShell } from '@/components/ui/Skeleton';

export default function InteropHubLoading() {
  return (
    <LoadingShell>
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton rows={6} cols={7} />
      </div>
    </LoadingShell>
  );
}
