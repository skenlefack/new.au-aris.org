'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function QueryError({
  message = 'Failed to load data',
  onRetry,
}: QueryErrorProps) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center rounded-card border border-red-200 bg-red-50 p-4">
      <AlertTriangle className="h-5 w-5 text-red-500" />
      <p className="mt-2 text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
    </div>
  );
}
