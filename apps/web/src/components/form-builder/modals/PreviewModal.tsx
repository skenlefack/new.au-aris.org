'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Monitor, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useFormBuilderStore } from '../hooks/useFormBuilder';
import { FormRenderer } from '../renderer/FormRenderer';

interface PreviewModalProps {
  onClose: () => void;
}

export function PreviewModal({ onClose }: PreviewModalProps) {
  const { form, getSchema } = useFormBuilderStore();
  const t = useTranslations('collecte');
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  if (!form) return null;
  const schema = getSchema();

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex items-center justify-center transition-all duration-200',
        visible ? 'bg-black/50 backdrop-blur-[6px]' : 'bg-black/0 backdrop-blur-0',
      )}
      style={{ zIndex: 99999 }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className={cn(
          'flex h-[90vh] w-[95vw] max-w-6xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900 transition-all duration-200',
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Preview: {form.name}
            </h2>
            <p className="text-xs text-gray-500">{t('fbPreviewDesc')}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
              <button
                onClick={() => setMode('desktop')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  mode === 'desktop'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setMode('mobile')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  mode === 'mobile'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-800/50">
          <div className={cn('mx-auto transition-all duration-200', mode === 'mobile' && 'max-w-sm')}>
            <FormRenderer schema={schema} formName={form.name} mobile={mode === 'mobile'} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
