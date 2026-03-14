'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ArrowLeft, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { DOMAIN_OPTIONS } from '@/components/form-builder/utils/field-types';
import { createDefaultFormSchema } from '@/components/form-builder/utils/form-schema';
import { useCreateFormTemplate, useImportExcelTemplate } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';

export default function NewFormPage() {
  const router = useRouter();
  const t = useTranslations('collecte');
  const createMutation = useCreateFormTemplate();
  const importMutation = useImportExcelTemplate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('animal_health');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Excel import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importName, setImportName] = useState('');
  const [importDomain, setImportDomain] = useState('animal_health');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);

    const schema = createDefaultFormSchema();
    if (schema.sections.length > 0) {
      schema.sections[0].name = { en: 'General Information' };
    }

    try {
      const result = await createMutation.mutateAsync({
        name: name.trim(),
        domain,
        schema,
      });
      const templateId = result?.data?.id;
      if (templateId) {
        router.push(`/collecte/forms/${templateId}/edit`);
      } else {
        router.push('/collecte/forms');
      }
    } catch (err) {
      console.error('Failed to create form:', err);
      router.push('/collecte/forms');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportError('');
    // Auto-set name from filename
    if (!importName) {
      setImportName(file.name.replace(/\.(xlsx?|csv)$/i, '').replace(/[_-]/g, ' '));
    }
  };

  const handleImport = async () => {
    if (!importFile || !importName.trim()) return;
    setIsImporting(true);
    setImportError('');

    try {
      const result = await importMutation.mutateAsync({
        file: importFile,
        name: importName.trim(),
        domain: importDomain,
      });
      const templateId = result?.data?.id;
      if (templateId) {
        router.push(`/collecte/forms/${templateId}/edit`);
      } else {
        router.push('/collecte/forms');
      }
    } catch (err) {
      console.error('Failed to import:', err);
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/collecte/forms')}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('newForm')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('newFormDesc')}
          </p>
        </div>
      </div>

      {/* Two-column grid on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Creation Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('createFromScratch')}</h2>
              <p className="text-xs text-gray-500">{t('startWithBlank')}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('formName')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('formNamePlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('domain')} <span className="text-red-500">*</span>
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                {DOMAIN_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('description')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('formDescPlaceholder')}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={!name.trim() || isCreating}
                className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreating ? t('creating') : t('createAndOpenEditor')}
              </button>
              <button
                onClick={() => router.push('/collecte/forms')}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>

        {/* Import Excel Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800 self-start">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <Upload className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('importFromExcel')}</h2>
              <p className="text-xs text-gray-500">{t('uploadXlsx')}</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            {t('eachSheetBecomes')}
          </p>

          {/* File picker */}
          <div className="space-y-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Upload className="h-4 w-4" />
                {importFile ? t('changeFile') : t('chooseExcelFile')}
              </button>
              {importFile && (
                <span className="ml-3 inline-flex items-center gap-1.5 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {importFile.name} ({Math.round(importFile.size / 1024)} KB)
                </span>
              )}
            </div>

            {importFile && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('formName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    placeholder={t('importedFormName')}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('domain')}
                  </label>
                  <select
                    value={importDomain}
                    onChange={(e) => setImportDomain(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    {DOMAIN_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                {importError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {importError}
                  </div>
                )}

                <button
                  onClick={handleImport}
                  disabled={!importName.trim() || isImporting}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isImporting ? t('importing') : t('importAndOpenEditor')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
