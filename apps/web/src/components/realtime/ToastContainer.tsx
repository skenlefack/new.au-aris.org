'use client';

import React from 'react';
import { X, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRealtimeStore, type ToastNotification } from '@/lib/realtime/realtime-store';

const TOAST_CONFIG: Record<
  ToastNotification['type'],
  { icon: React.ReactNode; bg: string; border: string; text: string }
> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
  },
  error: {
    icon: <XCircle className="h-4 w-4" />,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
  },
  info: {
    icon: <Info className="h-4 w-4" />,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
  },
};

export function ToastContainer() {
  const toasts = useRealtimeStore((s) => s.toasts);
  const removeToast = useRealtimeStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => {
        const config = TOAST_CONFIG[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg animate-in slide-in-from-right-5 fade-in duration-200',
              config.bg,
              config.border,
            )}
            style={{ minWidth: '320px', maxWidth: '420px' }}
          >
            <span className={cn('mt-0.5 flex-shrink-0', config.text)}>
              {config.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-medium', config.text)}>
                {toast.title}
              </p>
              <p className="mt-0.5 text-xs text-gray-600">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
