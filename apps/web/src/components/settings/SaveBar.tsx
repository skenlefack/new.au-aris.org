'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Save, X, Loader2 } from 'lucide-react';

interface SaveBarProps {
  show: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  message?: string;
}

export function SaveBar({
  show,
  saving = false,
  onSave,
  onDiscard,
  message = 'You have unsaved changes',
}: SaveBarProps) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 transform transition-transform duration-300',
        show ? 'translate-y-0' : 'translate-y-full',
      )}
    >
      <div className="border-t border-gray-200 bg-white px-6 py-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            {message}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <X className="h-4 w-4" />
              Discard
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-aris-primary-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
