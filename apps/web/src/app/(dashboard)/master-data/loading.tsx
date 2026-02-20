import { TableSkeleton } from '@/components/ui/Skeleton';

export default function MasterDataLoading() {
  return (
    <div className="space-y-6">
      <TableSkeleton rows={10} cols={5} />
    </div>
  );
}
