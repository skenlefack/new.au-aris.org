'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ArrowLeft, Upload, CheckCircle2, AlertCircle, Target, Sparkles } from 'lucide-react';
import { DOMAIN_OPTIONS } from '@/components/form-builder/utils/field-types';
import { createDefaultFormSchema } from '@/components/form-builder/utils/form-schema';
import { useCreateFormTemplate, useImportExcelTemplate, type FormType } from '@/lib/api/form-builder-hooks';
import { useTranslations } from '@/lib/i18n/translations';
import { TargetsSelector, type TargetFormValue } from '@/components/forms/TargetsSelector';
import { AiSuggestionDialog } from '@/components/ai/AiSuggestionDialog';

export default function NewFormPage() {
  const router = useRouter();
  const t = useTranslations('collecte');
  const tAi = useTranslations('ai');
  const createMutation = useCreateFormTemplate();
  const importMutation = useImportExcelTemplate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('animal_health');
  const [targets, setTargets] = useState<TargetFormValue[]>([
    { domainCode: 'animal_health', subDomainCode: null, isPrimary: true },
  ]);
  const [formType, setFormType] = useState<FormType>('CAMPAIGN');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // AI suggestion dialog state
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const handleAiAccept = (draft: any) => {
    if (draft.name) setName(draft.name);
    if (draft.description) setDescription(draft.description);
    if (draft.domain) setDomain(draft.domain);
    if (draft.formType) setFormType(draft.formType);
    if (Array.isArray(draft.targets) && draft.targets.length > 0) {
      setTargets(draft.targets.map((t: any, i: number) => ({
        domainCode: t.domainCode ?? '',
        subDomainCode: t.subDomainCode ?? null,
        isPrimary: i === 0,
      })));
    }
  };

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

    // Derive domain from primary target for backward compat; PAID forms always use 'paid'
    const primaryTarget = targets.find((t) => t.isPrimary) ?? targets[0];
    const effectiveDomain = formType === 'PAID' ? 'paid' : (primaryTarget?.domainCode || domain);

    try {
      const result = await createMutation.mutateAsync({
        name: name.trim(),
        domain: effectiveDomain,
        formType,
        schema,
        targets: targets.filter((t) => t.domainCode).map((t) => ({
          domainCode: t.domainCode,
          subDomainCode: t.subDomainCode,
          isPrimary: t.isPrimary,
        })),
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
      <div className="flex items-center justify-between">
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
        <button
          onClick={() => setAiDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-[#C9A227]/30 bg-gradient-to-r from-[#1F4E79]/5 to-[#C9A227]/5 px-4 py-2 text-sm font-medium text-[#1F4E79] hover:from-[#1F4E79]/10 hover:to-[#C9A227]/10 transition-all dark:text-[#C9A227] dark:border-[#C9A227]/20"
        >
          <Sparkles className="h-4 w-4" style={{ color: '#C9A227' }} />
          {tAi('suggestWithAi')}
        </button>
      </div>

      <AiSuggestionDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        type="form"
        onAccept={handleAiAccept}
        context={{ domain }}
      />

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

            {/* Targets */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Target className="h-4 w-4 text-gray-400" />
                {t('targets')} <span className="text-red-500">*</span>
              </label>
              <TargetsSelector value={targets} onChange={setTargets} t={t} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('formType')} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFormType('CAMPAIGN')}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    formType === 'CAMPAIGN'
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  }`}
                >
                  <p className={`text-sm font-semibold ${formType === 'CAMPAIGN' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {t('formTypeCampaign')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">{t('formTypeCampaignDesc')}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('EVENT_ALERT')}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    formType === 'EVENT_ALERT'
                      ? 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  }`}
                >
                  <p className={`text-sm font-semibold ${formType === 'EVENT_ALERT' ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {t('formTypeEventAlert')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">{t('formTypeEventAlertDesc')}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('PAID')}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    formType === 'PAID'
                      ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  }`}
                >
                  <p className={`text-sm font-semibold ${formType === 'PAID' ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    PAID
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">{t('formTypePaidDesc') || 'Programme d\'Amélioration de l\'Information sur les Données'}</p>
                </button>
              </div>
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
