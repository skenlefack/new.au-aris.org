import { TableSkeleton, LoadingShell } from '@/components/ui/Skeleton';

export default function ReportsLoading() {
  return (
    <LoadingShell>
      <div className="space-y-6">
        <TableSkeleton rows={5} cols={5} />
      </div>
    </LoadingShell>
  );
}
