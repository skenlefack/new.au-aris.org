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
  Sparkles,
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
import { SubDomainTreeSelector } from '@/components/forms/SubDomainTreeSelector';
import { useDomainStore } from '@/lib/stores/domain-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTenantStore, findTenantById } from '@/lib/stores/tenant-store';
import { useGeoEntities } from '@/lib/api/geo-hooks';
import { AiSuggestionDialog } from '@/components/ai/AiSuggestionDialog';
import { MapPin } from 'lucide-react';

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

// Domains to exclude from campaign forms
const EXCLUDED_DOMAINS = new Set(['knowledge-hub']);

export default function NewCampaignPage() {
  const router = useRouter();
  const t = useTranslations('collecte');
  const tAi = useTranslations('ai');
  const createCampaign = useCreateCollectionCampaign();
  const allDomains = useDomainStore((s) => s.allDomains);
  const user = useAuthStore((s) => s.user);
  const tenantTree = useTenantStore((s) => s.tenantTree);
  const selectedTenantId = useTenantStore((s) => s.selectedTenantId);

  const userLevel = user?.tenantLevel || 'MEMBER_STATE';

  // Determine which country codes are in the user's scope
  const { scopeCountryCodes, scopeRecCodes, userCountryCode } = useMemo(() => {
    if (!user || !selectedTenantId) return { scopeCountryCodes: null, scopeRecCodes: null, userCountryCode: null };

    if (userLevel === 'MEMBER_STATE') {
      // Find country code from COUNTRIES config or email
      const byTenant = Object.values(COUNTRIES).find((c) => c.tenantId === selectedTenantId);
      const code = byTenant?.code || user.email.split('@')[1]?.split('.')[0]?.toUpperCase() || null;
      return { scopeCountryCodes: code ? [code] : [], scopeRecCodes: [] as string[], userCountryCode: code };
    }

    if (userLevel === 'REC') {
      const rec = allRecs.find((r) => r.tenantId === selectedTenantId);
      return {
        scopeCountryCodes: rec?.countryCodes || [],
        scopeRecCodes: rec ? [rec.code] : [],
        userCountryCode: null,
      };
    }

    // CONTINENTAL → all
    return { scopeCountryCodes: null, scopeRecCodes: null, userCountryCode: null };
  }, [user, selectedTenantId, userLevel]);

  // Build domain options from store (active only, excluding Knowledge)
  const domainOptions = useMemo(() => {
    if (allDomains.length > 0) {
      return allDomains
        .filter((d) => !EXCLUDED_DOMAINS.has(d.code))
        .map((d) => {
          const formCode = DOMAIN_OPTIONS.find(
            (opt) => opt.label === (d.name.en || d.name.fr),
          )?.value;
          // Fallback: convert store code to form code (hyphens → underscores)
          const code = formCode ?? d.code.replace(/-/g, '_').replace('_prod', '');
          return { value: code, label: d.name.en || d.name.fr || d.code };
        });
    }
    // Fallback to static DOMAIN_OPTIONS
    return DOMAIN_OPTIONS;
  }, [allDomains]);

  // Multilingual name & description
  const [name, setName] = useState<Record<string, string>>({ en: '', fr: '', pt: '', ar: '', es: '' });
  const [description, setDescription] = useState<Record<string, string>>({ en: '', fr: '', pt: '', ar: '', es: '' });

  // Multi-domain selection
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  // Sub-domain selection (optional)
  const [selectedSubDomains, setSelectedSubDomains] = useState<string[]>([]);

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

  // Admin division targeting (country-level users)
  const [targetAdminZones, setTargetAdminZones] = useState<Array<{ id: string; label: string; level: string }>>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-select country/REC for restricted users
  React.useEffect(() => {
    if (userLevel === 'MEMBER_STATE' && scopeCountryCodes && scopeCountryCodes.length === 1) {
      const code = scopeCountryCodes[0];
      const country = countryList.find((c) => c.code === code);
      if (country && selectedCountries.length === 0) {
        setSelectedCountries([country]);
      }
    }
    if (userLevel === 'REC' && scopeRecCodes && scopeRecCodes.length === 1) {
      const rec = allRecs.find((r) => r.code === scopeRecCodes[0]);
      if (rec && selectedRecs.length === 0) {
        setSelectedRecs([rec]);
      }
    }
  }, [userLevel, scopeCountryCodes, scopeRecCodes]);

  // Fetch admin1 divisions for targeting (country users)
  const targetCountryCode = selectedCountries.length === 1 ? selectedCountries[0].code : undefined;
  const { data: admin1Data } = useGeoEntities(
    userLevel === 'MEMBER_STATE' && targetCountryCode
      ? { level: 'ADMIN1', countryCode: targetCountryCode, limit: 200 }
      : undefined,
  );
  const { data: admin2Data } = useGeoEntities(
    userLevel === 'MEMBER_STATE' && targetCountryCode
      ? { level: 'ADMIN2', countryCode: targetCountryCode, limit: 500 }
      : undefined,
  );

  // AI suggestion dialog
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const handleAiAccept = (draft: any) => {
    if (draft.name) setName(typeof draft.name === 'string' ? { en: draft.name, fr: '', pt: '', ar: '', es: '' } : draft.name);
    if (draft.description) setDescription(typeof draft.description === 'string' ? { en: draft.description, fr: '', pt: '', ar: '', es: '' } : draft.description);
    if (draft.startDate) setStartDate(draft.startDate);
    if (draft.endDate) setEndDate(draft.endDate);
    if (draft.frequency) setFrequency(draft.frequency);
    if (Array.isArray(draft.domains)) handleDomainsChange(draft.domains);
    if (Array.isArray(draft.subDomains)) setSelectedSubDomains(draft.subDomains);
  };

  // Fetch published templates only
  const { data: templatesData, isLoading: templatesLoading } = useFormBuilderTemplates({
    page: 1,
    limit: 500,
    status: 'PUBLISHED',
  });

  // Filter templates: published + domain match + owned by user's tenant or parent tenants
  const publishedTemplates = useMemo(() => {
    const apiData = templatesData?.data ?? [];
    return apiData.filter((tmpl) => {
      if (tmpl.status !== 'PUBLISHED') return false;
      if (selectedDomains.length > 0 && !selectedDomains.includes(tmpl.domain)) return false;
      // Show templates from user's own tenant + parent tenants (continental always visible)
      if (selectedTenantId && tmpl.tenantId !== selectedTenantId) {
        const tmplTenant = findTenantById(tenantTree, tmpl.tenantId);
        if (!tmplTenant) return true; // unknown tenant — show anyway
        // Allow if template is from a parent level (CONTINENTAL always, REC if user is MEMBER_STATE)
        if (tmplTenant.level === 'CONTINENTAL') return true;
        if (tmplTenant.level === 'REC' && userLevel === 'MEMBER_STATE') {
          // Check if this REC is the user's parent REC
          const rec = allRecs.find((r) => r.tenantId === tmpl.tenantId);
          if (rec && userCountryCode && rec.countryCodes.includes(userCountryCode)) return true;
        }
        return false;
      }
      return true;
    });
  }, [templatesData, selectedDomains, selectedTenantId, tenantTree, userLevel, userCountryCode]);

  // Form codes use underscores (animal_health), store uses hyphens (animal-health)
  const FORM_TO_STORE: Record<string, string> = {
    animal_health: 'animal-health', livestock: 'livestock-prod', fisheries: 'fisheries',
    trade_sps: 'trade-sps', wildlife: 'wildlife', apiculture: 'apiculture',
    climate_env: 'climate-env', governance: 'governance',
  };

  // When domains change, clear templates and sub-domains that no longer match
  const handleDomainsChange = (codes: string[]) => {
    setSelectedDomains(codes);
    if (codes.length > 0) {
      setSelectedTemplates((prev) => prev.filter((tmpl) => codes.includes(tmpl.domain)));
      // Convert form codes to store codes before comparing with sub-domain domainCode
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
    if (selectedCountries.length === 0 && userLevel !== 'MEMBER_STATE') e.countries = t('countriesRequired');
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

    // Build targets from domains + sub-domains
    // Each selected domain gets a target; sub-domains attach to their parent domain
    const subMeta = useDomainStore.getState().subDomainsMetadata;
    const builtTargets: { domainCode: string; subDomainCode: string | null; isPrimary: boolean }[] = [];

    if (selectedSubDomains.length > 0) {
      // Group sub-domains by their parent domain
      for (const sdCode of selectedSubDomains) {
        const sd = subMeta.find((s) => s.code === sdCode);
        if (sd) {
          builtTargets.push({
            domainCode: sd.domainCode,
            subDomainCode: sd.code,
            isPrimary: false,
          });
        }
      }
      // Also add domains that have NO sub-domain selected (full domain target)
      const domainsWithSubs = new Set(builtTargets.map((t) => t.domainCode));
      for (const domCode of selectedDomains) {
        if (!domainsWithSubs.has(domCode)) {
          builtTargets.push({ domainCode: domCode, subDomainCode: null, isPrimary: false });
        }
      }
    } else {
      // No sub-domains selected → one target per domain
      for (const domCode of selectedDomains) {
        builtTargets.push({ domainCode: domCode, subDomainCode: null, isPrimary: false });
      }
    }

    // Mark first target as primary
    if (builtTargets.length > 0) builtTargets[0].isPrimary = true;

    const payload = {
      code,
      name,
      description: Object.values(description).some((v) => v.trim()) ? description : undefined,
      domain: primaryDomain,
      formTemplateId: selectedTemplates[0]?.id ?? '',
      formTemplateIds: selectedTemplates.map((t: any) => t.id),
      startDate,
      endDate,
      targetCountries: selectedCountries.map((c: CountryConfig) => c.code),
      targetRecIds: selectedRecs.length > 0 ? selectedRecs.map((r) => r.tenantId) : undefined,
      targetZones: targetAdminZones.length > 0 ? targetAdminZones.map((z) => z.id) : undefined,
      targetSubmissions: targetSubmissions ? parseInt(targetSubmissions, 10) : undefined,
      frequency,
      sendReminders,
      reminderDaysBefore: sendReminders ? parseInt(reminderDays, 10) || 3 : undefined,
      targets: builtTargets.length > 0 ? builtTargets : undefined,
      metadata: {
        domains: selectedDomains,
        subDomains: selectedSubDomains,
        recCodes: selectedRecs.map((r) => r.code),
        targetAdminZones: targetAdminZones.length > 0 ? targetAdminZones : undefined,
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
      <div className="flex items-start justify-between">
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
        type="campaign"
        onAccept={handleAiAccept}
        context={{ domains: selectedDomains }}
      />

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

        {/* ROW 2 — Domains + Sub-domains */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5 dark:border-gray-700 dark:bg-gray-900">
          {/* Domains (required) */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-gray-400" />
              {t('domains')} <span className="text-red-500">*</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('selectDomainsDesc')}</p>
            <div className="flex flex-wrap gap-2">
              {domainOptions.map((d) => {
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

        {/* ROW 3 — RECs (hidden for country users) */}
        {userLevel !== 'MEMBER_STATE' && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              {t('targetRecs')}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('selectRecsDesc')}</p>
            <MultiSearchCombobox<RecConfig>
              value={selectedRecs}
              onChange={handleRecsChange}
              items={userLevel === 'REC'
                ? allRecs.filter((r) => scopeRecCodes?.includes(r.code))
                : allRecs
              }
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
        )}

        {/* ROW 4 — Target Countries (hidden for country users — auto-set) */}
        {userLevel === 'MEMBER_STATE' ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Globe className="h-4 w-4 text-gray-400" />
              {t('targetCountries')}
            </h2>
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              {selectedCountries.map((c) => (
                <span key={c.code} className="inline-flex items-center gap-1 rounded-full border border-aris-primary-200 bg-aris-primary-50 px-3 py-1 text-xs font-medium text-aris-primary-700 dark:border-aris-primary-800 dark:bg-aris-primary-900/20 dark:text-aris-primary-400">
                  {c.flag} {c.name}
                </span>
              ))}
            </div>

            {/* Admin Division Targeting */}
            {targetCountryCode && (
              <div className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {t('targetZones') || 'Target Zones'}
                  <span className="ml-1 text-xs font-normal text-gray-400">({t('optionalField')})</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('targetZonesDesc') || 'Select specific administrative divisions to target. Leave empty to target the entire country.'}
                </p>
                <AdminZoneSelector
                  admin1Data={admin1Data?.data}
                  admin2Data={admin2Data?.data}
                  selected={targetAdminZones}
                  onChange={setTargetAdminZones}
                  t={t}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Globe className="h-4 w-4 text-gray-400" />
              {t('targetCountries')} <span className="text-red-500">*</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('selectTargetCountries')}</p>
            <MultiSearchCombobox<CountryConfig>
              value={selectedCountries}
              onChange={setSelectedCountries}
              items={scopeCountryCodes
                ? countryList.filter((c) => scopeCountryCodes.includes(c.code))
                : countryList
              }
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
        )}

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

/* ── Admin Zone Selector (multi-level admin division picker) ─────────────── */

interface GeoItem {
  id: string;
  code: string;
  name: string | { en?: string; fr?: string; [k: string]: string | undefined };
  level?: string;
}

function geoLabel(item: GeoItem): string {
  if (typeof item.name === 'string') return item.name;
  return item.name?.en || item.name?.fr || item.code;
}

function AdminZoneSelector({
  admin1Data,
  admin2Data,
  selected,
  onChange,
  t,
}: {
  admin1Data?: GeoItem[];
  admin2Data?: GeoItem[];
  selected: Array<{ id: string; label: string; level: string }>;
  onChange: (zones: Array<{ id: string; label: string; level: string }>) => void;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const [search, setSearch] = useState('');
  const selectedIds = new Set(selected.map((z) => z.id));

  const allZones = useMemo(() => {
    const zones: Array<{ id: string; label: string; level: string; sortKey: string }> = [];
    for (const a1 of admin1Data || []) {
      const label = geoLabel(a1);
      zones.push({ id: a1.id, label, level: 'ADMIN1', sortKey: `0_${label}` });
    }
    for (const a2 of admin2Data || []) {
      const label = geoLabel(a2);
      zones.push({ id: a2.id, label, level: 'ADMIN2', sortKey: `1_${label}` });
    }
    return zones.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [admin1Data, admin2Data]);

  const filtered = search
    ? allZones.filter((z) => z.label.toLowerCase().includes(search.toLowerCase()))
    : allZones;

  const toggle = (zone: { id: string; label: string; level: string }) => {
    if (selectedIds.has(zone.id)) {
      onChange(selected.filter((z) => z.id !== zone.id));
    } else {
      onChange([...selected, { id: zone.id, label: zone.label, level: zone.level }]);
    }
  };

  const LEVEL_COLORS: Record<string, string> = {
    ADMIN1: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ADMIN2: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    ADMIN3: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <div className="space-y-3">
      {/* Selected zones */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((z) => (
            <span
              key={z.id}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
            >
              <span className={`rounded px-1 py-0.5 text-[9px] font-semibold ${LEVEL_COLORS[z.level] || 'bg-gray-100 text-gray-600'}`}>
                {z.level.replace('ADMIN', 'A')}
              </span>
              {z.label}
              <button onClick={() => toggle(z)} className="ml-0.5 text-gray-400 hover:text-red-500">&times;</button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            {t('clearAll') || 'Clear all'}
          </button>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('searchAdminZones') || 'Search regions, districts...'}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      />

      {/* Zone list */}
      <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
        {filtered.length === 0 ? (
          <p className="p-3 text-xs text-gray-400 text-center">{t('noZonesFound') || 'No zones found'}</p>
        ) : (
          filtered.map((zone) => (
            <label
              key={zone.id}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(zone.id)}
                onChange={() => toggle(zone)}
                className="rounded border-gray-300"
              />
              <span className={`rounded px-1 py-0.5 text-[9px] font-semibold ${LEVEL_COLORS[zone.level] || 'bg-gray-100 text-gray-600'}`}>
                {zone.level.replace('ADMIN', 'A')}
              </span>
              {zone.label}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
