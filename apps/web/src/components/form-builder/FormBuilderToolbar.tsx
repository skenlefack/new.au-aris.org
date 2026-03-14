'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Undo2,
  Redo2,
  Eye,
  Save,
  SendHorizonal,
  ArrowLeft,
  MoreHorizontal,
  Copy,
  Download,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useFormBuilderStore } from './hooks/useFormBuilder';
import { DOMAIN_OPTIONS } from './utils/field-types';

interface FormBuilderToolbarProps {
  onSave: () => void;
  onPublish: () => void;
  onPreview: () => void;
}

export function FormBuilderToolbar({ onSave, onPublish, onPreview }: FormBuilderToolbarProps) {
  const router = useRouter();
  const t = useTranslations('collecte');
  const {
    form,
    isDirty,
    isSaving,
    historyIndex,
    history,
    undo,
    redo,
  } = useFormBuilderStore();

  const [menuOpen, setMenuOpen] = React.useState(false);

  if (!form) return null;

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const domainLabel = DOMAIN_OPTIONS.find((d) => d.value === form.domain)?.label || form.domain;
  const statusColor =
    form.status === 'PUBLISHED'
      ? 'bg-green-100 text-green-700'
      : form.status === 'ARCHIVED'
        ? 'bg-gray-100 text-gray-500'
        : 'bg-amber-100 text-amber-700';

  return (
    <div className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900">
      {/* Left: Back + Name + Badges */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => router.push('/collecte/forms')}
          className="flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          title={t('backToForms')}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {form.name || t('untitledForm')}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              {domainLabel}
            </span>
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', statusColor)}>
              {form.status}
            </span>
            <span className="text-[10px] text-gray-400">v{form.version}</span>
          </div>
        </div>
      </div>

      {/* Center: Undo/Redo */}
      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-gray-800"
          title={t('undoCtrlZ')}
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-gray-800"
          title={t('redoCtrlY')}
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Eye className="h-3.5 w-3.5" />
          {t('preview')}
        </button>
        <button
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? `${t('saved')}...` : t('saved')}
        </button>
        {form.status === 'DRAFT' && (
          <button
            onClick={onPublish}
            className="inline-flex items-center gap-1.5 rounded-lg bg-aris-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-aris-primary-700"
          >
            <SendHorizonal className="h-3.5 w-3.5" />
            {t('publish')}
          </button>
        )}

        {/* More menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <button className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                  <Copy className="h-3.5 w-3.5" /> {t('duplicate')}
                </button>
                <button className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                  <Download className="h-3.5 w-3.5" /> {t('exportExcelTemplate')}
                </button>
                <hr className="my-1 border-gray-200 dark:border-gray-700" />
                <button className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="h-3.5 w-3.5" /> {t('delete')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
