'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useRealtimeStore, type ConnectionStatus } from '@/lib/realtime/realtime-store';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; dot: string; icon: React.ReactNode }
> = {
  connected: {
    label: 'Live',
    dot: 'bg-green-500',
    icon: <Wifi className="h-3.5 w-3.5 text-green-600" />,
  },
  connecting: {
    label: 'Connecting',
    dot: 'bg-amber-500 animate-pulse',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />,
  },
  disconnected: {
    label: 'Offline',
    dot: 'bg-gray-400',
    icon: <WifiOff className="h-3.5 w-3.5 text-gray-400" />,
  },
  error: {
    label: 'Error',
    dot: 'bg-red-500',
    icon: <WifiOff className="h-3.5 w-3.5 text-red-500" />,
  },
};

export function ConnectionIndicator() {
  const status = useRealtimeStore((s) => s.connectionStatus);
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium',
        status === 'connected'
          ? 'border-green-200 bg-green-50 text-green-700'
          : status === 'connecting'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : status === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-gray-200 bg-gray-50 text-gray-500',
      )}
      title={`WebSocket: ${config.label}`}
    >
      {config.icon}
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
}
