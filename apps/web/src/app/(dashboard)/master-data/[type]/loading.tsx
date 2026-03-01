import { TableSkeleton, LoadingShell } from '@/components/ui/Skeleton';

export default function RefDataTypeLoading() {
  return (
    <LoadingShell>
      <div className="space-y-6">
        <TableSkeleton rows={10} cols={6} />
      </div>
    </LoadingShell>
  );
}
