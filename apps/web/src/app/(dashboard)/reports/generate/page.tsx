'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Settings2,
  CheckCircle2,
  Loader2,
  Layers,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useReportTemplatesV2,
  useGenerateReportV2,
  type ReportTemplate,
  type ReportScope,
  type ReportLanguage,
  type ReportType,
} from '@/lib/api/report-hooks';
import { usePublicDomains } from '@/lib/api/settings-hooks';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';

/* ------------------------------------------------------------------ */
/*  Wizard steps                                                       */
/* ------------------------------------------------------------------ */

const STEPS = [
  { key: 'template', icon: FileText, tKey: 'stepTemplate' },
  { key: 'config', icon: Settings2, tKey: 'stepConfig' },
  { key: 'confirm', icon: CheckCircle2, tKey: 'stepConfirm' },
] as const;

const TYPE_BADGE: Record<ReportType, string> = {
  PERIODIC: 'bg-indigo-100 text-indigo-700',
  AD_HOC: 'bg-purple-100 text-purple-700',
  FLASH: 'bg-orange-100 text-orange-700',
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function GenerateReportWizard() {
  const t = useTranslations('reports');
  const locale = useLocaleStore((s) => s.locale);
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);

  // Config form state
  const [title, setTitle] = useState<Record<string, string>>({ en: '', fr: '', pt: '', ar: '', es: '', sw: '' });
  const [themeFr, setThemeFr] = useState('');
  const [scope, setScope] = useState<ReportScope>('CONTINENTAL');
  const [domainId, setDomainId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [referenceYear, setReferenceYear] = useState(new Date().getFullYear());
  const [language, setLanguage] = useState<ReportLanguage>(locale === 'fr' ? 'fr' : 'en');

  const { data: templatesData, isLoading: templatesLoading } = useReportTemplatesV2();
  const { data: domainsData } = usePublicDomains();
  const generateMutation = useGenerateReportV2();

  // Filter out FLASH templates from wizard
  const templates = useMemo(() => {
    const all = (templatesData as any)?.data ?? [];
    return all.filter((tpl: ReportTemplate) => tpl.type !== 'FLASH');
  }, [templatesData]);

  const domains: any[] = (domainsData as any)?.data ?? [];

  function handleSelectTemplate(tpl: ReportTemplate) {
    setSelectedTemplate(tpl);
    setTitle({ en: tpl.nameEn || '', fr: tpl.nameFr || '', pt: tpl.namePt || '', ar: tpl.nameAr || '', es: tpl.nameEs || '', sw: tpl.nameSw || '' });
    if (tpl.domainId) setDomainId(tpl.domainId);
    if (tpl.scope) setScope(tpl.scope);
    setStep(1);
  }

  function handleGenerate() {
    if (!selectedTemplate) return;

    generateMutation.mutate(
      {
        templateId: selectedTemplate.id,
        titleFr: title.fr,
        titleEn: title.en,
        themeFr: themeFr || undefined,
        scope,
        domainId: domainId || undefined,
        periodStart,
        periodEnd,
        referenceYear,
        language,
      },
      {
        onSuccess: (res) => {
          const id = (res as any)?.data?.id;
          if (id) {
            router.push(`/reports/${id}`);
          } else {
            router.push('/reports');
          }
        },
      },
    );
  }

  const canGoToConfirm = !!(title.fr || title.en) && !!periodStart && !!periodEnd;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToReports')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          {t('generateNew')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('generateWizardDesc')}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div className={cn('h-px flex-1', isDone ? 'bg-[#1F4E79]' : 'bg-gray-200 dark:bg-gray-700')} />
              )}
              <button
                onClick={() => {
                  if (isDone) setStep(i);
                }}
                disabled={!isDone && !isActive}
                className={cn(
                  'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  isActive && 'bg-[#1F4E79] text-white',
                  isDone && 'bg-[#1F4E79]/10 text-[#1F4E79] hover:bg-[#1F4E79]/20',
                  !isActive && !isDone && 'bg-gray-100 text-gray-400 dark:bg-gray-800',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t(s.tKey)}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Step 1: Template selection ── */}
      {step === 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            {t('chooseTemplate')}
          </h2>
          {templatesLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
                {t('noTemplates')}
              </p>
              <p className="mt-1 text-sm text-gray-500">{t('noTemplatesDesc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl: ReportTemplate) => {
                const name = locale === 'fr' ? tpl.nameFr : tpl.nameEn;
                const desc = locale === 'fr' ? tpl.descriptionFr : tpl.descriptionEn;
                const typeBadge = TYPE_BADGE[tpl.type] ?? 'bg-gray-100 text-gray-600';

                return (
                  <button
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={cn(
                      'rounded-xl border bg-white p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-[#1F4E79]/40',
                      'dark:border-gray-700 dark:bg-gray-800 dark:hover:border-[#1F4E79]/60',
                      selectedTemplate?.id === tpl.id && 'ring-2 ring-[#1F4E79] border-[#1F4E79]',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1F4E79]/10">
                        <FileText className="h-5 w-5 text-[#1F4E79]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {name}
                        </h3>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider', typeBadge)}>
                            {tpl.type}
                          </span>
                          {tpl.scope && (
                            <span className="text-[10px] text-gray-400 uppercase">
                              {tpl.scope}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {desc && (
                      <p className="mt-3 text-sm leading-relaxed text-gray-500 line-clamp-2 dark:text-gray-400">
                        {desc}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                      <Layers className="h-3 w-3" />
                      {tpl.sections?.length ?? 0} {t('sections')}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Configuration ── */}
      {step === 1 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-5 text-lg font-semibold text-gray-900 dark:text-white">
            {t('stepConfig')}
          </h2>
          <div className="space-y-5 max-w-2xl">
            {/* Title FR */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                {t('titleFr')} *
              </label>
              <input
                type="text"
                value={title.fr}
                onChange={(e) => setTitle(prev => ({ ...prev, fr: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Title EN */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                {t('titleEn')} *
              </label>
              <input
                type="text"
                value={title.en}
                onChange={(e) => setTitle(prev => ({ ...prev, en: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Theme */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                {t('theme')} <span className="text-gray-400">({t('optional')})</span>
              </label>
              <input
                type="text"
                value={themeFr}
                onChange={(e) => setThemeFr(e.target.value)}
                placeholder={t('themePlaceholder')}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Scope */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                {t('scope')}
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as ReportScope)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="CONTINENTAL">{t('scopeContinental')}</option>
                <option value="REGIONAL">{t('scopeRegional')}</option>
                <option value="NATIONAL">{t('scopeNational')}</option>
              </select>
            </div>

            {/* Domain */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                {t('domain')} <span className="text-gray-400">({t('optional')})</span>
              </label>
              <select
                value={domainId}
                onChange={(e) => setDomainId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">{t('allDomains')}</option>
                {domains.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {locale === 'fr' ? (d.name?.fr ?? d.code) : (d.name?.en ?? d.code)}
                  </option>
                ))}
              </select>
            </div>

            {/* Period */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  {t('periodStart')} *
                </label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  {t('periodEnd')} *
                </label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Reference year */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                {t('referenceYear')}
              </label>
              <input
                type="number"
                min={2000}
                max={2100}
                value={referenceYear}
                onChange={(e) => setReferenceYear(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                {t('language')}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as ReportLanguage)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="fr">Francais</option>
                <option value="en">English</option>
                <option value="pt">Portugues</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-5 dark:border-gray-700">
            <button
              onClick={() => setStep(0)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('back')}
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!canGoToConfirm}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors',
                canGoToConfirm
                  ? 'bg-[#1F4E79] hover:bg-[#1a4268]'
                  : 'cursor-not-allowed bg-gray-300',
              )}
            >
              {t('next')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirmation ── */}
      {step === 2 && selectedTemplate && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-5 text-lg font-semibold text-gray-900 dark:text-white">
            {t('stepConfirm')}
          </h2>

          <div className="space-y-4 max-w-2xl">
            <SummaryRow label={t('reportTemplate')} value={locale === 'fr' ? selectedTemplate.nameFr : selectedTemplate.nameEn} />
            <SummaryRow label={t('titleFr')} value={title.fr} />
            <SummaryRow label={t('titleEn')} value={title.en} />
            {themeFr && <SummaryRow label={t('theme')} value={themeFr} />}
            <SummaryRow label={t('scope')} value={scope} />
            <SummaryRow label={t('periodStart')} value={periodStart} />
            <SummaryRow label={t('periodEnd')} value={periodEnd} />
            <SummaryRow label={t('referenceYear')} value={String(referenceYear)} />
            <SummaryRow label={t('language')} value={language.toUpperCase()} />
            <SummaryRow label={t('sections')} value={`${selectedTemplate.sections?.length ?? 0} section(s)`} />
          </div>

          {/* Error */}
          {generateMutation.isError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {generateMutation.error instanceof Error
                ? generateMutation.error.message
                : t('generationFailed')}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-5 dark:border-gray-700">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('back')}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#C9A227] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#b8921f] transition-colors disabled:opacity-60"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('launching')}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t('launchGeneration')}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary row helper                                                 */
/* ------------------------------------------------------------------ */

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 border-b border-gray-50 pb-3 dark:border-gray-700">
      <span className="w-40 flex-shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="text-sm text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}
