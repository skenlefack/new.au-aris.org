import { TableSkeleton, LoadingShell } from '@/components/ui/Skeleton';

export default function CollecteLoading() {
  return (
    <LoadingShell>
      <div className="space-y-6">
        <TableSkeleton rows={8} cols={6} />
      </div>
    </LoadingShell>
  );
}
