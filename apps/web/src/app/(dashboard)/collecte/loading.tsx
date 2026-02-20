import { TableSkeleton } from '@/components/ui/Skeleton';

export default function CollecteLoading() {
  return (
    <div className="space-y-6">
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
