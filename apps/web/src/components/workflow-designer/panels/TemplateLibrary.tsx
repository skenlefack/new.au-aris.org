'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  LayoutTemplate,
  Loader2,
  Trash2,
  ArrowRight,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useWorkflowTemplates,
  useApplyWorkflowTemplate,
  useDeleteWorkflowTemplate,
} from '@/lib/api/workflow-hooks';
import { toast } from 'sonner';

interface TemplateLibraryProps {
  definitionId: string;
  hasExistingGraph: boolean;
  onClose: () => void;
  onApplied: () => void;
}

const CATEGORIES = ['all', 'standard', 'surveillance', 'export', 'custom'] as const;

function mlDisplay(ml: Record<string, string> | null | undefined): string {
  if (!ml) return '';
  return ml.en || ml.fr || Object.values(ml)[0] || '';
}

export function TemplateLibrary({
  definitionId,
  hasExistingGraph,
  onClose,
  onApplied,
}: TemplateLibraryProps) {
  const t = useTranslations('workflow');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmTemplateId, setConfirmTemplateId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params: any = { limit: 50 };
    if (activeCategory !== 'all') params.category = activeCategory;
    if (searchTerm.trim()) params.search = searchTerm.trim();
    return params;
  }, [activeCategory, searchTerm]);

  const { data: templatesRes, isLoading } = useWorkflowTemplates(queryParams);
  const applyMut = useApplyWorkflowTemplate();
  const deleteMut = useDeleteWorkflowTemplate();

  const templates = templatesRes?.data ?? [];

  const handleApply = async (templateId: string) => {
    if (hasExistingGraph && confirmTemplateId !== templateId) {
      setConfirmTemplateId(templateId);
      return;
    }

    try {
      await applyMut.mutateAsync({ templateId, definitionId });
      toast.success(t('designer.templateApplied'));
      onApplied();
      onClose();
    } catch (err: any) {
      toast.error(t('designer.templateApplyFailed'), { description: err?.message });
    }
    setConfirmTemplateId(null);
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    try {
      await deleteMut.mutateAsync(id);
      toast.success(t('designer.templateDeleted'));
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete template');
    }
    setDeleteConfirmId(null);
  };

  const categoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      all: t('designer.templateCatAll'),
      standard: t('designer.templateCatStandard'),
      surveillance: t('designer.templateCatSurveillance'),
      export: t('designer.templateCatExport'),
      custom: t('designer.templateCatCustom'),
    };
    return labels[cat] ?? cat;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <LayoutTemplate className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {t('designer.templateLibrary')}
          </h2>
          <div className="ml-auto">
            <button onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Category tabs + Search */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition',
                  activeCategory === cat
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
                )}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder={t('designer.templateSearch')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </div>

        {/* Templates grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {t('designer.templateNone')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {templates.map((tpl: any) => (
                <div
                  key={tpl.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 flex flex-col gap-2 hover:border-blue-300 dark:hover:border-blue-600 transition group"
                >
                  {/* Title */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {mlDisplay(tpl.name)}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {mlDisplay(tpl.description)}
                      </p>
                    </div>
                    {tpl.isSystem && (
                      <span className="shrink-0 text-[10px] bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded px-1.5 py-0.5 font-medium">
                        System
                      </span>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-[10px] text-gray-400">
                    <span className="bg-gray-200 dark:bg-gray-700 rounded px-1.5 py-0.5 font-medium text-gray-600 dark:text-gray-300">
                      {tpl.category}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Hash className="h-3 w-3" /> {tpl.usageCount} {t('designer.templateUsed')}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-1">
                    {confirmTemplateId === tpl.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          {t('designer.templateReplaceConfirm')}
                        </span>
                        <button
                          onClick={() => handleApply(tpl.id)}
                          disabled={applyMut.isPending}
                          className="rounded-md bg-amber-500 text-white px-2 py-1 text-xs font-medium hover:bg-amber-600 disabled:opacity-50 transition"
                        >
                          {applyMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t('designer.templateConfirmYes')}
                        </button>
                        <button
                          onClick={() => setConfirmTemplateId(null)}
                          className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                        >
                          {t('designer.templateConfirmNo')}
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApply(tpl.id)}
                          disabled={applyMut.isPending}
                          className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition disabled:opacity-50"
                        >
                          <ArrowRight className="h-3 w-3" />
                          {t('designer.templateUse')}
                        </button>
                        {!tpl.isSystem && (
                          deleteConfirmId === tpl.id ? (
                            <div className="flex items-center gap-1 ml-auto">
                              <button
                                onClick={() => handleDelete(tpl.id)}
                                className="text-xs text-red-600 hover:text-red-700 font-medium"
                              >
                                {t('designer.templateConfirmYes')}
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-xs text-gray-500 hover:text-gray-600"
                              >
                                {t('designer.templateConfirmNo')}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDelete(tpl.id)}
                              className="ml-auto rounded-md p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
