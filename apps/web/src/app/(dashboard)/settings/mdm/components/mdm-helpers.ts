import { cn } from '@/lib/utils';

export function timeAgo(ts?: string | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function heartbeatColor(ts?: string | null): string {
  if (!ts) return 'text-gray-400';
  const mins = (Date.now() - new Date(ts).getTime()) / 60_000;
  if (mins < 5) return 'text-emerald-500';
  if (mins < 30) return 'text-amber-500';
  return 'text-red-500';
}

export function batteryColor(level?: number | null): string {
  if (level == null) return 'bg-gray-300';
  if (level > 50) return 'bg-emerald-500';
  if (level >= 20) return 'bg-amber-500';
  return 'bg-red-500';
}

export function formatBytes(mb?: number | null): string {
  if (mb == null) return '-';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function commandStatusBadge(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-400' },
    DELIVERED: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400' },
    EXECUTED: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400' },
    FAILED: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400' },
  };
  const c = map[status] ?? map.PENDING;
  return { className: cn('inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium', c.bg, c.text), label: status };
}
