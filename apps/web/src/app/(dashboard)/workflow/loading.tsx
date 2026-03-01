import { KpiCardSkeleton, TableSkeleton, LoadingShell } from '@/components/ui/Skeleton';

export default function WorkflowLoading() {
  return (
    <LoadingShell>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton rows={5} cols={7} />
      </div>
    </LoadingShell>
  );
}
