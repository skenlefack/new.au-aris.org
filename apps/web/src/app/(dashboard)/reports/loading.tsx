import { TableSkeleton } from '@/components/ui/Skeleton';

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}
