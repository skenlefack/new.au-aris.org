'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  Eye,
  Shield,
  Users,
} from 'lucide-react';
import {
  useCollectionCampaign,
  useUpdateCollectionCampaign,
} from '@/lib/api/workflow-hooks';
import { useSettingsFunctions, type FunctionItem } from '@/lib/api/settings-hooks';
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
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';
import { SubDomainTreeSelector } from '@/components/forms/SubDomainTreeSelector';
import { useDomainStore } from '@/lib/stores/domain-store';

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

type AnyCampaign = any;

function toMultilingual(val: unknown): Record<string, string> {
  if (!val) return { en: '', fr: '', pt: '', ar: '', es: '', sw: '' };
  if (typeof val === 'string') return { en: val, fr: '', pt: '', ar: '', es: '' };
  if (typeof val === 'object') return { en: '', fr: '', pt: '', ar: '', es: '', ...(val as Record<string, string>) };
  return { en: String(val), fr: '', pt: '', ar: '', es: '' };
}

function toDateInputValue(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try { return new Date(dateStr).toISOString().split('T')[0]; } catch { return ''; }
}

const EXCLUDED_DOMAINS = new Set(['knowledge-hub']);

export default function EditCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations('collecte');
  const campaignId = params.id as string;

  const { data: campaignRes, isLoading: campaignLoading } = useCollectionCampaign(campaignId);
  const updateCampaign = useUpdateCollectionCampaign();
  const allDomains = useDomainStore((s) => s.allDomains);

  const domainOptions = useMemo(() => {
    if (allDomains.length > 0) {
      return allDomains
        .filter((d) => !EXCLUDED_DOMAINS.has(d.code))
        .map((d) => {
          const formCode = DOMAIN_OPTIONS.find(
            (opt) => opt.label === (d.name.en || d.name.fr),
          )?.value;
          const code = formCode ?? d.code.replace(/-/g, '_').replace('_prod', '');
          return { value: code, label: d.name.en || d.name.fr || d.code };
        });
    }
    return DOMAIN_OPTIONS;
  }, [allDomains]);

  const [name, setName] = useState<Record<string, string>>({ en: '', fr: '', pt: '', ar: '', es: '', sw: '' });
  const [description, setDescription] = useState<Record<string, string>>({ en: '', fr: '', pt: '', ar: '', es: '', sw: '' });
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedSubDomains, setSelectedSubDomains] = useState<string[]>([]);
  const [selectedRecs, setSelectedRecs] = useState<RecConfig[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<FormTemplateListItem[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<CountryConfig[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetSubmissions, setTargetSubmissions] = useState<string>('');
  const [frequency, setFrequency] = useState('one_time');
  const [sendReminders, setSendReminders] = useState(false);
  const [reminderDays, setReminderDays] = useState('3');
  const [visibilityScope, setVisibilityScope] = useState<'continental' | 'rec' | 'country'>('continental');
  const [selectedFunctions, setSelectedFunctions] = useState<FunctionItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: functionsData } = useSettingsFunctions({ limit: 100, status: 'active' });
  const allFunctions: FunctionItem[] = functionsData?.data ?? [];

  const { data: templatesData, isLoading: templatesLoading } = useFormBuilderTemplates({ page: 1, limit: 100 });

  const publishedTemplates = useMemo(() => {
    const apiData = templatesData?.data ?? [];
    return apiData.filter((tmpl) => {
      if (tmpl.status !== 'PUBLISHED') return false;
      if (selectedDomains.length > 0 && !selectedDomains.includes(tmpl.domain)) return false;
      return true;
    });
  }, [templatesData, selectedDomains]);

  const campaign = (campaignRes as AnyCampaign)?.data as AnyCampaign | undefined;

  useEffect(() => {
    if (campaign && !initialized && (templatesData?.data?.length ?? 0) > 0) {
      setName(toMultilingual(campaign.name));
      setDescription(toMultilingual(campaign.description));

      // Backward compat: reads legacy domain field, prefer targets[]
      const domains = campaign.metadata?.domains ?? (campaign.domain ? [campaign.domain] : []);
      setSelectedDomains(domains);

      setStartDate(toDateInputValue(campaign.startDate));
      setEndDate(toDateInputValue(campaign.endDate));
      setTargetSubmissions(campaign.targetSubmissions != null ? String(campaign.targetSubmissions) : '');
      setFrequency(campaign.frequency ?? 'one_time');
      setSendReminders(campaign.sendReminders ?? false);
      setReminderDays(String(campaign.reminderDaysBefore ?? 3));

      // Restore sub-domains from targets or metadata
      const campaignTargets = campaign.targets as any[] | undefined;
      if (campaign.metadata?.subDomains && Array.isArray(campaign.metadata.subDomains)) {
        setSelectedSubDomains(campaign.metadata.subDomains);
      } else if (campaignTargets && campaignTargets.length > 0) {
        const subCodes = campaignTargets
          .filter((t: any) => t.subDomainCode)
          .map((t: any) => t.subDomainCode as string);
        if (subCodes.length > 0) setSelectedSubDomains(subCodes);
      }

      // Restore templates (multi-template support)
      const multiIds: string[] = Array.isArray(campaign.formTemplateIds) && campaign.formTemplateIds.length > 0
        ? campaign.formTemplateIds
        : [];
      const singleId = campaign.formTemplateId ?? campaign.templateId;
      const idsToRestore = multiIds.length > 0 ? multiIds : (singleId ? [singleId] : []);
      const allTpls = templatesData?.data ?? [];
      const matched = idsToRestore.map((id: string) => allTpls.find((t: FormTemplateListItem) => t.id === id)).filter(Boolean) as FormTemplateListItem[];
      if (matched.length > 0) setSelectedTemplates(matched);

      // Restore countries
      const countryCodes: string[] = campaign.targetCountries ?? [];
      setSelectedCountries(countryCodes.map((code: string) => COUNTRIES[code.toUpperCase()]).filter(Boolean) as CountryConfig[]);

      // Restore RECs
      const recCodes: string[] = campaign.metadata?.recCodes ?? [];
      if (recCodes.length > 0) {
        setSelectedRecs(allRecs.filter((r) => recCodes.includes(r.code)));
      }

      // Restore visibility scope
      if (campaign.scope) setVisibilityScope(campaign.scope as any);

      // Restore target functions
      if (campaign.metadata?.targetFunctionId && allFunctions.length > 0) {
        const fn = allFunctions.find((f) => f.id === campaign.metadata.targetFunctionId);
        if (fn) setSelectedFunctions([fn]);
      }
      if (campaign.metadata?.targetFunctions && allFunctions.length > 0) {
        const fns = (campaign.metadata.targetFunctions as any[])
          .map((tf: any) => allFunctions.find((f) => f.id === tf.id))
          .filter(Boolean) as FunctionItem[];
        if (fns.length > 0) setSelectedFunctions(fns);
      }

      setInitialized(true);
    }
  }, [campaign, initialized, templatesData, allFunctions]);

  const FORM_TO_STORE: Record<string, string> = {
    animal_health: 'animal-health', livestock: 'livestock-prod', fisheries: 'fisheries',
    trade_sps: 'trade-sps', wildlife: 'wildlife', apiculture: 'apiculture',
    climate_env: 'climate-env', governance: 'governance',
  };

  const handleDomainsChange = (codes: string[]) => {
    setSelectedDomains(codes);
    if (codes.length > 0) {
      setSelectedTemplates((prev) => prev.filter((tmpl) => codes.includes(tmpl.domain)));
      const storeCodes = codes.map((c) => FORM_TO_STORE[c] ?? c);
      setSelectedSubDomains((prev) => {
        const subMeta = useDomainStore.getState().subDomainsMetadata;
        return prev.filter((sdCode) => {
          const sd = subMeta.find((s) => s.code === sdCode);
          return sd && storeCodes.includes(sd.domainCode);
        });
      });
    }
  };

  const handleRecsChange = (recs: RecConfig[]) => {
    setSelectedRecs(recs);
    if (recs.length > 0) {
      const recCountryCodes = new Set(recs.flatMap((r) => r.countryCodes));
      const existing = new Set(selectedCountries.map((c) => c.code));
      const toAdd = countryList.filter((c) => recCountryCodes.has(c.code) && !existing.has(c.code));
      if (toAdd.length > 0) setSelectedCountries((prev) => [...prev, ...toAdd]);
    }
  };

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!(name.en?.trim() || name.fr?.trim())) e.name = t('campaignNameRequired');
    if (!startDate) e.startDate = t('startDateRequired');
    if (!endDate) e.endDate = t('endDateRequired');
    if (startDate && endDate && startDate > endDate) e.endDate = t('endDateAfterStart');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitError(null);

    // Build targets from domains + sub-domains
    const subMeta = useDomainStore.getState().subDomainsMetadata;
    const builtTargets: { domainCode: string; subDomainCode: string | null; isPrimary: boolean }[] = [];

    if (selectedSubDomains.length > 0) {
      for (const sdCode of selectedSubDomains) {
        const sd = subMeta.find((s) => s.code === sdCode);
        if (sd) {
          builtTargets.push({ domainCode: sd.domainCode, subDomainCode: sd.code, isPrimary: false });
        }
      }
      const domainsWithSubs = new Set(builtTargets.map((t) => t.domainCode));
      for (const domCode of selectedDomains) {
        if (!domainsWithSubs.has(domCode)) {
          builtTargets.push({ domainCode: domCode, subDomainCode: null, isPrimary: false });
        }
      }
    } else {
      for (const domCode of selectedDomains) {
        builtTargets.push({ domainCode: domCode, subDomainCode: null, isPrimary: false });
      }
    }
    if (builtTargets.length > 0) builtTargets[0].isPrimary = true;

    const payload = {
      id: campaignId,
      name,
      description,
      startDate,
      endDate,
      targetSubmissions: targetSubmissions ? parseInt(targetSubmissions, 10) : undefined,
      targetCountries: selectedCountries.map((c: CountryConfig) => c.code),
      frequency,
      sendReminders,
      reminderDaysBefore: sendReminders ? parseInt(reminderDays, 10) || 3 : undefined,
      targets: builtTargets.length > 0 ? builtTargets : undefined,
      formTemplateIds: selectedTemplates.map((t: FormTemplateListItem) => t.id),
      scope: visibilityScope,
      metadata: {
        ...(campaign?.metadata ?? {}),
        domains: selectedDomains,
        subDomains: selectedSubDomains,
        recCodes: selectedRecs.map((r) => r.code),
        ...(selectedFunctions.length > 0
          ? {
              targetFunctionId: selectedFunctions[0].id,
              targetFunctionCode: selectedFunctions[0].code,
              targetFunctions: selectedFunctions.map((f) => ({ id: f.id, code: f.code })),
            }
          : { targetFunctionId: null, targetFunctionCode: null, targetFunctions: null }),
      },
    };

    try {
      await updateCampaign.mutateAsync(payload);
      router.push('/collecte');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  }

  if (campaignLoading) {
    return (
      <div className="space-y-6 pb-12">
        <div>
          <Link href="/collecte" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
            <ArrowLeft className="h-4 w-4" /> {t('backToCampaigns')}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{t('editCampaign')}</h1>
        </div>
        <TableSkeleton rows={6} cols={2} />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-6 pb-12">
        <div>
          <Link href="/collecte" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> {t('backToCampaigns')}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{t('campaignNotFound')}</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <Link href="/collecte" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft className="h-4 w-4" /> {t('backToCampaigns')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{t('editCampaign')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ROW 1 — Two columns: Info + Scheduling */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* LEFT — Campaign Information */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-gray-400" /> {t('campaignInformation')}
            </h2>
            <div>
              <MultilingualInput label={t('campaignNameLabel')} value={name} onChange={setName} required placeholder={t('campaignNamePlaceholder')} />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
            <div>
              <MultilingualTextarea label={t('description')} value={description} onChange={setDescription} placeholder={t('descriptionPlaceholder')} rows={4} />
            </div>
          </div>

          {/* RIGHT — Scheduling + Options */}
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" /> {t('scheduling')}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('startDate')} <span className="text-red-500">*</span></label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                  {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('endDate')} <span className="text-red-500">*</span></label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                  {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('targetSubmissionsLabel')}</label>
                  <input type="number" min="0" value={targetSubmissions} onChange={(e) => setTargetSubmissions(e.target.value)} placeholder="e.g. 500" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('frequency')}</label>
                  <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                    {FREQUENCY_OPTIONS.map((f) => <option key={f.value} value={f.value}>{t(f.tKey)}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Visibility & Access */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-400" />
                {t('visibilityAccess') || 'Visibility & Access'}
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('campaignScope') || 'Campaign Scope'}
                </label>
                <div className="flex gap-2">
                  {([
                    { key: 'continental' as const, icon: Globe, label: t('continental') || 'Continental' },
                    { key: 'rec' as const, icon: Building2, label: t('rec') || 'REC' },
                    { key: 'country' as const, icon: Shield, label: t('country') || 'Country' },
                  ] as const).map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setVisibilityScope(s.key)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        visibilityScope === s.key
                          ? 'border-[#1F4E79] bg-[#1F4E79]/5 text-[#1F4E79]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <s.icon className="h-3.5 w-3.5" />
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-gray-400">
                  {visibilityScope === 'continental' && (t('scopeContinentalDesc') || 'Visible by continental-level users (AU-IBAR)')}
                  {visibilityScope === 'rec' && (t('scopeRecDesc') || 'Visible by REC-level users and their member states')}
                  {visibilityScope === 'country' && (t('scopeCountryDesc') || 'Visible by country-level users only')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-gray-400" />
                    {t('targetFunction') || 'Target Function'}
                    <span className="text-xs font-normal text-gray-400">({t('optionalField')})</span>
                  </span>
                </label>
                <p className="text-[10px] text-gray-400 mb-2">
                  {t('targetFunctionDesc') || 'Restrict to specific functions. If none selected, all users in scope can see the campaign.'}
                </p>
                <MultiSearchCombobox<FunctionItem>
                  value={selectedFunctions}
                  onChange={setSelectedFunctions}
                  items={allFunctions}
                  labelKey={(f) => { const n = f.name as any; return typeof n === 'object' ? (n.en || n.fr || f.code) : (n || f.code); }}
                  idKey={(f) => f.id}
                  filterKey={(f) => { const n = f.name as any; return `${typeof n === 'object' ? `${n.en || ''} ${n.fr || ''}` : (n || '')} ${f.code}`; }}
                  placeholder={t('searchFunctions') || 'Search functions...'}
                  allLabel={t('allFunctions') || 'All functions'}
                  renderItem={(f) => { const n = f.name as any; return (<span className="flex items-center gap-2"><span>{typeof n === 'object' ? (n.en || n.fr || f.code) : (n || f.code)}</span><span className="text-[10px] text-gray-400 font-mono">{f.code}</span></span>); }}
                  renderChip={(f) => { const n = f.name as any; return <span>{typeof n === 'object' ? (n.en || n.fr || f.code) : (n || f.code)}</span>; }}
                />
              </div>
            </div>

            {/* Options */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="h-4 w-4 text-gray-400" /> {t('options')}
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('sendReminders')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('notifyAgents')}</p>
                </div>
                <button type="button" role="switch" aria-checked={sendReminders} onClick={() => setSendReminders(!sendReminders)} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${sendReminders ? 'bg-aris-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${sendReminders ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {sendReminders && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('reminderDays')}</label>
                  <input type="number" min="1" max="30" value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} className="mt-1 w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2 — Domains + Sub-domains */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5 dark:border-gray-700 dark:bg-gray-900">
          {/* Domains */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-gray-400" /> {t('domains')}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('selectDomainsDesc')}</p>
            <div className="flex flex-wrap gap-2">
              {domainOptions.map((d) => {
                const isSelected = selectedDomains.includes(d.value);
                return (
                  <button key={d.value} type="button" onClick={() => handleDomainsChange(isSelected ? selectedDomains.filter((v) => v !== d.value) : [...selectedDomains, d.value])}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${isSelected ? 'border-aris-primary-500 bg-aris-primary-50 text-aris-primary-700 dark:border-aris-primary-400 dark:bg-aris-primary-900/20 dark:text-aris-primary-400' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600'}`}>
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub-domains (optional) */}
          {selectedDomains.length > 0 && (
            <div className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('subDomains')}
                <span className="ml-2 text-xs font-normal text-gray-400">({t('optionalField')})</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('subDomainsDesc')}</p>
              <SubDomainTreeSelector
                selectedDomains={selectedDomains}
                value={selectedSubDomains}
                onChange={setSelectedSubDomains}
                t={t}
              />
            </div>
          )}
        </div>

        {/* ROW 3 — Form Templates */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" /> {t('formTemplates')}
          </h2>
          <MultiSearchCombobox<FormTemplateListItem>
            value={selectedTemplates} onChange={setSelectedTemplates} items={publishedTemplates}
            labelKey={(tpl) => tpl.name} idKey={(tpl) => tpl.id} filterKey={(tpl) => `${tpl.name} ${tpl.domain}`}
            placeholder={t('searchFormTemplates')} allLabel={t('allTemplates')} loading={templatesLoading}
            renderItem={(tmpl) => (<span className="flex items-center gap-2"><span>{tmpl.name}</span><span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">{DOMAIN_OPTIONS.find((d) => d.value === tmpl.domain)?.label ?? tmpl.domain}</span></span>)}
            renderChip={(tmpl) => (<span className="flex items-center gap-1">{tmpl.name}<span className="rounded bg-aris-primary-100 px-1 text-[9px] text-aris-primary-600 dark:bg-aris-primary-800/50 dark:text-aris-primary-300">{DOMAIN_OPTIONS.find((d) => d.value === tmpl.domain)?.label ?? tmpl.domain}</span></span>)}
          />
        </div>

        {/* ROW 4 — RECs */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" /> {t('targetRecs')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('selectRecsDesc')}</p>
          <MultiSearchCombobox<RecConfig>
            value={selectedRecs} onChange={handleRecsChange} items={allRecs}
            labelKey={(r) => r.name} idKey={(r) => r.code} filterKey={(r) => `${r.name} ${r.nameFr} ${r.code}`}
            placeholder={t('searchRecs')} allLabel={t('allRecs')}
            renderItem={(r) => (<span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} /><span>{r.name}</span><span className="text-gray-400 text-[10px]">{r.memberCount} {t('countries')}</span></span>)}
            renderChip={(r) => (<span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />{r.name}</span>)}
          />
        </div>

        {/* ROW 5 — Target Countries */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-400" /> {t('targetCountries')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('selectTargetCountries')}</p>
          <MultiSearchCombobox<CountryConfig>
            value={selectedCountries} onChange={setSelectedCountries} items={countryList}
            labelKey={(c) => `${c.flag} ${c.name}`} idKey={(c) => c.code} filterKey={(c) => `${c.name} ${c.code} ${c.nameFr}`}
            placeholder={t('searchCountries')} allLabel={t('allCountries')}
            renderItem={(c) => (<span className="flex items-center gap-2"><span>{c.flag}</span><span>{c.name}</span><span className="text-gray-400">{c.code}</span></span>)}
            renderChip={(c) => (<span className="flex items-center gap-1">{c.flag} {c.name}</span>)}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/collecte" className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
            {t('cancel')}
          </Link>
          <button type="submit" disabled={updateCampaign.isPending} className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-aris-primary-700 disabled:opacity-50">
            {updateCampaign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('saveChanges')}
          </button>
        </div>

        {(updateCampaign.isError || submitError) && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-400">
              {submitError ?? t('failedToUpdateCampaign')}
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
