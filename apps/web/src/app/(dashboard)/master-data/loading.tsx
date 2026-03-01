import { TableSkeleton, LoadingShell } from '@/components/ui/Skeleton';

export default function MasterDataLoading() {
  return (
    <LoadingShell>
      <div className="space-y-6">
        <TableSkeleton rows={10} cols={5} />
      </div>
    </LoadingShell>
  );
}
