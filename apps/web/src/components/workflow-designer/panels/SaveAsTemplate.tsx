'use client';

import React, { useState } from 'react';
import { X, BookmarkPlus, Loader2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { useSaveDefinitionAsTemplate } from '@/lib/api/workflow-hooks';
import { toast } from 'sonner';

interface SaveAsTemplateProps {
  definitionId: string;
  onClose: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'standard', labelKey: 'templateCatStandard' },
  { value: 'surveillance', labelKey: 'templateCatSurveillance' },
  { value: 'export', labelKey: 'templateCatExport' },
  { value: 'custom', labelKey: 'templateCatCustom' },
];

export function SaveAsTemplate({ definitionId, onClose }: SaveAsTemplateProps) {
  const t = useTranslations('workflow');
  const saveMut = useSaveDefinitionAsTemplate();

  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descFr, setDescFr] = useState('');
  const [category, setCategory] = useState('custom');
  const [tagsRaw, setTagsRaw] = useState('');

  const handleSave = async () => {
    if (!nameEn.trim()) {
      toast.error(t('designer.templateNameRequired'));
      return;
    }

    const name: Record<string, string> = {};
    if (nameEn.trim()) name.en = nameEn.trim();
    if (nameFr.trim()) name.fr = nameFr.trim();

    const description: Record<string, string> = {};
    if (descEn.trim()) description.en = descEn.trim();
    if (descFr.trim()) description.fr = descFr.trim();

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await saveMut.mutateAsync({
        definitionId,
        name,
        description: Object.keys(description).length > 0 ? description : undefined,
        category,
        tags: tags.length > 0 ? tags : undefined,
      });
      toast.success(t('designer.templateSaved'));
      onClose();
    } catch (err: any) {
      toast.error(t('designer.templateSaveFailed'), { description: err?.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <BookmarkPlus className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {t('designer.saveAsTemplate')}
          </h2>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {/* Name EN */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('designer.nameEn')} *
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. My Custom Workflow"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {/* Name FR */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('designer.nameFr')}
            </label>
            <input
              type="text"
              value={nameFr}
              onChange={(e) => setNameFr(e.target.value)}
              placeholder="ex. Mon workflow personnalise"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {/* Description EN */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('designer.descriptionEn')}
            </label>
            <textarea
              value={descEn}
              onChange={(e) => setDescEn(e.target.value)}
              placeholder={t('designer.descPlaceholder')}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('designer.templateCategory')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`designer.${opt.labelKey}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('designer.templateTags')}
            </label>
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder={t('designer.templateTagsPlaceholder')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            {t('designer.close')}
          </button>
          <button
            onClick={handleSave}
            disabled={saveMut.isPending || !nameEn.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
            {t('designer.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
