'use client';

import React, { useState } from 'react';
import { X, Monitor, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormBuilderStore } from '../hooks/useFormBuilder';
import { FormRenderer } from '../renderer/FormRenderer';

interface PreviewModalProps {
  onClose: () => void;
}

export function PreviewModal({ onClose }: PreviewModalProps) {
  const { form, getSchema } = useFormBuilderStore();
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');

  if (!form) return null;
  const schema = getSchema();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex h-[90vh] w-[95vw] max-w-6xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Preview: {form.name}
            </h2>
            <p className="text-xs text-gray-500">See how the form will look to data collectors</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
              <button
                onClick={() => setMode('desktop')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium',
                  mode === 'desktop'
                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setMode('mobile')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium',
                  mode === 'mobile'
                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-800/50">
          <div
            className={cn(
              'mx-auto',
              mode === 'mobile' ? 'max-w-sm' : 'max-w-3xl',
            )}
          >
            <FormRenderer schema={schema} formName={form.name} />
          </div>
        </div>
      </div>
    </div>
  );
}
