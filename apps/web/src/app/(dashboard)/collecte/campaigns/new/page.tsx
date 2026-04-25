'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  FileText,
  Globe,
  Loader2,
  Settings,
  Building2,
} from 'lucide-react';
import { useCreateCollectionCampaign } from '@/lib/api/workflow-hooks';
import {
  useFormBuilderTemplates,
  type FormTemplateListItem,
} from '@/lib/api/form-builder-hooks';
import { COUNTRIES, type CountryConfig } from '@/data/countries-config';
import { getAllRecs, type RecConfig } from '@/data/recs-config';
import { DOMAIN_OPTIONS } from '@/components/form-builder/utils/field-types';
import { MultiSearchCombobox } from '@/components/ui/MultiSearchCombobox';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { MultilingualTextarea } from '@/components/settings/MultilingualTextarea';
import { useTranslations } from '@/lib/i18n/translations';
import { TargetsSelector, type TargetFormValue } from '@/components/forms/TargetsSelector';

const FREQUENCY_OPTIONS = [
  { value: 'one_time', tKey: 'oneTime' },
  { value: 'daily', tKey: 'daily' },
  { value: 'weekly', tKey: 'weekly' },
  { value: 'monthly', tKey: 'monthly' },
  { value: 'quarterly', tKey: 'quarterly' },
  { value: 'biannual', tKey: 'biannual' },
  { value: 'annual', tKey: 'annual' },
];

const countryList: CountryConfig[] = Object.values(COUNTRIES).sort((a, b) =>
  a.name.localeCompare(b.name),
);

const allRecs = getAllRecs();

export default function NewCampaignPage() {
  const router = useRouter();
  const t = useTranslations('collecte');
  const createCampaign = useCreateCollectionCampaign();

  // Multilingual name & description
  const [name, setName] = useState<Record<string, string>>({ en: '', fr: '', pt: '', ar: '', es: '' });
  const [description, setDescription] = useState<Record<string, string>>({ en: '', fr: '', pt: '', ar: '', es: '' });

  // Targets
  const [targets, setTargets] = useState<TargetFormValue[]>([
    { domainCode: '', subDomainCode: null, isPrimary: true },
  ]);

  // Multi-domain selection
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  // RECs selection
  const [selectedRecs, setSelectedRecs] = useState<RecConfig[]>([]);

  const [selectedTemplates, setSelectedTemplates] = useState<FormTemplateListItem[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<CountryConfig[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetSubmissions, setTargetSubmissions] = useState<string>('');
  const [frequency, setFrequency] = useState('one_time');
  const [sendReminders, setSendReminders] = useState(false);
  const [reminderDays, setReminderDays] = useState('3');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch all templates
  const { data: templatesData, isLoading: templatesLoading } = useFormBuilderTemplates({
    page: 1,
    limit: 100,
  });

  // Filter templates by selected domains
  const publishedTemplates = useMemo(() => {
    const apiData = templatesData?.data ?? [];
    return apiData.filter((tmpl) => {
      if (tmpl.status !== 'PUBLISHED') return false;
      if (selectedDomains.length > 0 && !selectedDomains.includes(tmpl.domain)) return false;
      return true;
    });
  }, [templatesData, selectedDomains]);

  // When domains change, clear templates that no longer match
  const handleDomainsChange = (codes: string[]) => {
    setSelectedDomains(codes);
    if (codes.length > 0) {
      setSelectedTemplates((prev) => prev.filter((tmpl) => codes.includes(tmpl.domain)));
    }
  };

  // When RECs change, auto-select corresponding countries
  const handleRecsChange = (recs: RecConfig[]) => {
    setSelectedRecs(recs);
    if (recs.length > 0) {
      const recCountryCodes = new Set(recs.flatMap((r) => r.countryCodes));
      const recCountries = countryList.filter((c) => recCountryCodes.has(c.code));
      // Merge with manually selected countries
      const existing = new Set(selectedCountries.map((c) => c.code));
      const toAdd = recCountries.filter((c) => !existing.has(c.code));
      if (toAdd.length > 0) {
        setSelectedCountries((prev) => [...prev, ...toAdd]);
      }
    }
  };

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!(name.en?.trim() || name.fr?.trim())) e.name = t('campaignNameRequired');
    if (selectedDomains.length === 0) e.domains = t('domainRequired');
    if (selectedTemplates.length === 0) e.templates = t('templateRequired');
    if (selectedCountries.length === 0) e.countries = t('countriesRequired');
    if (!startDate) e.startDate = t('startDateRequired');
    if (!endDate) e.endDate = t('endDateRequired');
    if (startDate && endDate && startDate > endDate) e.endDate = t('endDateAfterStart');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;

    const primaryDomain = selectedDomains[0];
    const code = `${primaryDomain.replace(/[^a-zA-Z]/g, '_').toUpperCase().slice(0, 10)}_${startDate.replace(/-/g, '')}`;

    // Build targets array for API
    const validTargets = targets.filter((t) => t.domainCode).map((t) => ({
      domainCode: t.domainCode,
      subDomainCode: t.subDomainCode,
      isPrimary: t.isPrimary,
    }));

    const payload = {
      code,
      name,
      description: Object.values(description).some((v) => v.trim()) ? description : undefined,
      domain: primaryDomain,
      formTemplateId: selectedTemplates[0]?.id ?? '',
      startDate,
      endDate,
      targetCountries: selectedCountries.map((c: CountryConfig) => c.code),
      targetRecIds: selectedRecs.length > 0 ? selectedRecs.map((r) => r.tenantId) : undefined,
      targetSubmissions: targetSubmissions ? parseInt(targetSubmissions, 10) : undefined,
      frequency,
      sendReminders,
      reminderDaysBefore: sendReminders ? parseInt(reminderDays, 10) || 3 : undefined,
      targets: validTargets.length > 0 ? validTargets : undefined,
      metadata: {
        domains: selectedDomains,
        recCodes: selectedRecs.map((r) => r.code),
      },
    };

    try {
      await createCampaign.mutateAsync(payload);
      router.push('/collecte');
    } catch {
      // Error handled by React Query
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <Link
          href="/collecte"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToCampaigns')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          {t('createCampaign')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('collectionCampaignsDesc')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ROW 1 — Two-column: Information (left) + Scheduling & Options (right) */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* LEFT — Campaign Information */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-gray-400" />
              {t('campaignInformation')}
            </h2>

            {/* Multilingual name */}
            <div>
              <MultilingualInput
                label={t('campaignNameLabel')}
                value={name}
                onChange={setName}
                required
                placeholder={t('campaignNamePlaceholder')}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>

            {/* Multilingual description */}
            <div>
              <MultilingualTextarea
                label={t('description')}
                value={description}
                onChange={setDescription}
                placeholder={t('descriptionPlaceholder')}
                rows={4}
              />
            </div>

          </div>

          {/* RIGHT — Scheduling + Options */}
          <div className="space-y-6">
            {/* Scheduling */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                {t('scheduling')}
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('startDate')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('endDate')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('targetSubmissionsLabel')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={targetSubmissions}
                    onChange={(e) => setTargetSubmissions(e.target.value)}
                    placeholder="e.g. 500"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('frequency')}
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    {FREQUENCY_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {t(f.tKey)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="h-4 w-4 text-gray-400" />
                {t('options')}
              </h2>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('sendReminders')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('notifyAgents')}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sendReminders}
                  onClick={() => setSendReminders(!sendReminders)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    sendReminders ? 'bg-aris-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${sendReminders ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {sendReminders && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('reminderDays')}</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={reminderDays}
                    onChange={(e) => setReminderDays(e.target.value)}
                    className="mt-1 w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2 — Targets */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gray-400" />
            {t('targets')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('targetsDesc')}</p>
          <TargetsSelector value={targets} onChange={setTargets} t={t} />
        </div>

        {/* ROW 3 — Domains */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gray-400" />
            {t('domains')} <span className="text-red-500">*</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('selectDomainsDesc')}</p>
          <div className="flex flex-wrap gap-2">
            {DOMAIN_OPTIONS.map((d) => {
              const isSelected = selectedDomains.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => {
                    const next = isSelected
                      ? selectedDomains.filter((v) => v !== d.value)
                      : [...selectedDomains, d.value];
                    handleDomainsChange(next);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-aris-primary-500 bg-aris-primary-50 text-aris-primary-700 dark:border-aris-primary-400 dark:bg-aris-primary-900/20 dark:text-aris-primary-400'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          {errors.domains && <p className="mt-1 text-xs text-red-600">{errors.domains}</p>}
        </div>

        {/* ROW 3 — Form Templates */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            {t('formTemplates')} <span className="text-red-500">*</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {selectedDomains.length > 0
              ? t('showingTemplatesForDomains', { count: String(publishedTemplates.length) })
              : t('selectDomainToFilter')}
          </p>
          <MultiSearchCombobox<FormTemplateListItem>
            value={selectedTemplates}
            onChange={setSelectedTemplates}
            items={publishedTemplates}
            labelKey={(tpl) => tpl.name}
            idKey={(tpl) => tpl.id}
            filterKey={(tpl) => `${tpl.name} ${tpl.domain}`}
            placeholder={t('searchFormTemplates')}
            allLabel={t('allTemplates')}
            loading={templatesLoading}
            renderItem={(tmpl) => (
              <span className="flex items-center gap-2">
                <span>{tmpl.name}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  {DOMAIN_OPTIONS.find((d) => d.value === tmpl.domain)?.label ?? tmpl.domain}
                </span>
              </span>
            )}
            renderChip={(tmpl) => (
              <span className="flex items-center gap-1">
                {tmpl.name}
                <span className="rounded bg-aris-primary-100 px-1 text-[9px] text-aris-primary-600 dark:bg-aris-primary-800/50 dark:text-aris-primary-300">
                  {DOMAIN_OPTIONS.find((d) => d.value === tmpl.domain)?.label ?? tmpl.domain}
                </span>
              </span>
            )}
          />
          {errors.templates && <p className="text-xs text-red-600">{errors.templates}</p>}
        </div>

        {/* ROW 3 — RECs */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            {t('targetRecs')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('selectRecsDesc')}</p>
          <MultiSearchCombobox<RecConfig>
            value={selectedRecs}
            onChange={handleRecsChange}
            items={allRecs}
            labelKey={(r) => r.name}
            idKey={(r) => r.code}
            filterKey={(r) => `${r.name} ${r.nameFr} ${r.code}`}
            placeholder={t('searchRecs')}
            allLabel={t('allRecs')}
            renderItem={(r) => (
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                <span>{r.name}</span>
                <span className="text-gray-400 text-[10px]">{r.memberCount} {t('countries')}</span>
              </span>
            )}
            renderChip={(r) => (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                {r.name}
              </span>
            )}
          />
        </div>

        {/* ROW 4 — Target Countries */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-400" />
            {t('targetCountries')} <span className="text-red-500">*</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('selectTargetCountries')}</p>
          <MultiSearchCombobox<CountryConfig>
            value={selectedCountries}
            onChange={setSelectedCountries}
            items={countryList}
            labelKey={(c) => `${c.flag} ${c.name}`}
            idKey={(c) => c.code}
            filterKey={(c) => `${c.name} ${c.code} ${c.nameFr}`}
            placeholder={t('searchCountries')}
            allLabel={t('allCountries')}
            renderItem={(c) => (
              <span className="flex items-center gap-2">
                <span>{c.flag}</span>
                <span>{c.name}</span>
                <span className="text-gray-400">{c.code}</span>
              </span>
            )}
            renderChip={(c) => (
              <span className="flex items-center gap-1">{c.flag} {c.name}</span>
            )}
          />
          {errors.countries && <p className="text-xs text-red-600">{errors.countries}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/collecte"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {t('cancel')}
          </Link>
          <button
            type="submit"
            disabled={createCampaign.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50"
          >
            {createCampaign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('createCampaign')}
          </button>
        </div>

        {createCampaign.isError && (
          <p className="text-sm text-red-600">{t('failedToCreateCampaign')}</p>
        )}
      </form>
    </div>
  );
}
