'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useRealtimeStore, type ConnectionStatus } from '@/lib/realtime/realtime-store';

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; dotColor: string }
> = {
  connected: { label: 'Live', dotColor: 'bg-green-500' },
  connecting: { label: 'Connecting', dotColor: 'bg-amber-500 animate-pulse' },
  disconnected: { label: 'Offline', dotColor: 'bg-gray-400' },
  error: { label: 'Reconnecting', dotColor: 'bg-amber-500 animate-pulse' },
};

export function ConnectionIndicator() {
  const status = useRealtimeStore((s) => s.connectionStatus);
  const config = STATUS_CONFIG[status];

  // Only show the indicator prominently when not connected
  if (status === 'connected') {
    return (
      <div
        className="flex items-center gap-1.5 rounded-lg p-2"
        title={`WebSocket: ${config.label}`}
      >
        <span className={cn('inline-block h-2 w-2 rounded-full', config.dotColor)} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium',
        status === 'connecting' || status === 'error'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-gray-400 dark:text-gray-500',
      )}
      title={`WebSocket: ${config.label}`}
    >
      <span className={cn('inline-block h-2 w-2 rounded-full', config.dotColor)} />
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
}
