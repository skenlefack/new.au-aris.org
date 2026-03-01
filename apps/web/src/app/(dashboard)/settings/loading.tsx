import { DetailSkeleton, LoadingShell } from '@/components/ui/Skeleton';

export default function SettingsLoading() {
  return (
    <LoadingShell>
      <DetailSkeleton />
    </LoadingShell>
  );
}
