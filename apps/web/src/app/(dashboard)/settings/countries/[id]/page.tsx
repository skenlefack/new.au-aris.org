'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  useSettingsCountry, useUpdateCountry, useSettingsRecs, useAdminLevels, useUpsertAdminLevels, type AdminLevel,
  useStatisticDefinitions, useCountryStatistics, useUpsertCountryStatistics,
  useKpiDefinitions, useCountryKpiScores, useUpsertCountryKpiScores,
} from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { SaveBar } from '@/components/settings/SaveBar';
import { useTranslations } from '@/lib/i18n/translations';
import { ArrowLeft, Loader2, Layers, Plus, Trash2, Save, MapPin, BarChart3, Activity, FileText } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const RichTextEditor = dynamic(() => import('@/components/settings/RichTextEditor').then((m) => m.RichTextEditor), {
  ssr: false,
  loading: () => <div className="flex h-[300px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>,
});

const emptyML = { en: '', fr: '', pt: '', ar: '' };

export default function CountryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { canManageCountries, isSuperAdmin, isContinentalAdmin, isNationalAdmin } = useSettingsAccess();
  const t = useTranslations('settings');
  const { data, isLoading } = useSettingsCountry(id);
  const { data: recsData } = useSettingsRecs();
  const updateMutation = useUpdateCountry();

  // Resolved country code (from API or fallback)
  const resolvedCode: string | undefined = (data?.data as any)?.code;

  // Admin levels — pass resolved country code for GADM fallback
  const { data: adminLevelsData, isLoading: adminLevelsLoading } = useAdminLevels(id, resolvedCode);
  const upsertAdminLevelsMutation = useUpsertAdminLevels();
  const canEditAdminLevels = isSuperAdmin || isContinentalAdmin || isNationalAdmin;

  const allRecs: any[] = recsData?.data ?? [];

  const [form, setForm] = useState<Record<string, any>>({
    name: { ...emptyML },
    officialName: { ...emptyML },
    capital: { ...emptyML },
    flag: '',
    population: '',
    area: '',
    timezone: '',
    languages: [] as string[],
    currency: '',
    phoneCode: '',
    isActive: false,
    isOperational: false,
    stats: {} as Record<string, number>,
    sectorPerformance: { vaccination: 0, fisheries: 0, wildlife: 0, governance: 0, dataQuality: 0, analytics: 0 },
    welcomeMessage: '',
  });

  const [dirty, setDirty] = useState(false);

  // Admin levels local state
  const [adminLevels, setAdminLevels] = useState<AdminLevel[]>([]);
  const [adminLevelsDirty, setAdminLevelsDirty] = useState(false);

  useEffect(() => {
    if (data?.data) {
      const c = data.data;
      setForm({
        name: c.name ?? { ...emptyML },
        officialName: c.officialName ?? { ...emptyML },
        capital: c.capital ?? { ...emptyML },
        flag: c.flag ?? '',
        population: c.population ? String(c.population) : '',
        area: c.area ? String(c.area) : '',
        timezone: c.timezone ?? '',
        languages: c.languages ?? [],
        currency: c.currency ?? '',
        phoneCode: c.phoneCode ?? '',
        isActive: c.isActive ?? false,
        isOperational: c.isOperational ?? false,
        stats: c.stats ?? {},
        sectorPerformance: c.sectorPerformance ?? { vaccination: 0, fisheries: 0, wildlife: 0, governance: 0, dataQuality: 0, analytics: 0 },
        welcomeMessage: c.welcomeMessage ?? '',
      });
      setDirty(false);
    }
  }, [data]);

  useEffect(() => {
    if (adminLevelsData?.data) {
      setAdminLevels(adminLevelsData.data.map((l: any) => ({
        level: l.level,
        name: l.name ?? { ...emptyML },
        code: l.code ?? '',
        isActive: l.isActive ?? true,
      })));
      setAdminLevelsDirty(false);
    }
  }, [adminLevelsData]);

  const updateField = (key: string, value: unknown) => {
    setForm((prev: Record<string, any>) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    const body = {
      id,
      name: form.name,
      officialName: form.officialName,
      capital: form.capital,
      flag: form.flag,
      population: form.population ? Number(form.population) : null,
      area: form.area ? Number(form.area) : null,
      timezone: form.timezone || null,
      languages: form.languages,
      currency: form.currency || null,
      phoneCode: form.phoneCode || null,
      isActive: form.isActive,
      isOperational: form.isOperational,
      stats: form.stats,
      sectorPerformance: form.sectorPerformance,
      welcomeMessage: form.welcomeMessage || null,
    };
    await updateMutation.mutateAsync(body);
    setDirty(false);
  };

  const handleDiscard = () => {
    if (data?.data) {
      const c = data.data;
      setForm({
        name: c.name ?? { ...emptyML },
        officialName: c.officialName ?? { ...emptyML },
        capital: c.capital ?? { ...emptyML },
        flag: c.flag ?? '',
        population: c.population ? String(c.population) : '',
        area: c.area ? String(c.area) : '',
        timezone: c.timezone ?? '',
        languages: c.languages ?? [],
        currency: c.currency ?? '',
        phoneCode: c.phoneCode ?? '',
        isActive: c.isActive ?? false,
        isOperational: c.isOperational ?? false,
        stats: c.stats ?? {},
        sectorPerformance: c.sectorPerformance ?? {},
        welcomeMessage: c.welcomeMessage ?? '',
      });
    }
    setDirty(false);
  };

  // Admin levels handlers
  const updateAdminLevel = (index: number, field: string, value: unknown) => {
    setAdminLevels((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setAdminLevelsDirty(true);
  };

  const updateAdminLevelName = (index: number, lang: string, value: string) => {
    setAdminLevels((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        name: { ...updated[index].name, [lang]: value },
      };
      return updated;
    });
    setAdminLevelsDirty(true);
  };

  const addAdminLevel = () => {
    const nextLevel = adminLevels.length > 0
      ? Math.max(...adminLevels.map((l) => l.level)) + 1
      : 1;
    if (nextLevel > 5) return;
    setAdminLevels((prev) => [...prev, { level: nextLevel, name: { ...emptyML }, code: '', isActive: true }]);
    setAdminLevelsDirty(true);
  };

  const removeAdminLevel = (index: number) => {
    setAdminLevels((prev) => prev.filter((_, i) => i !== index));
    setAdminLevelsDirty(true);
  };

  const handleSaveAdminLevels = async () => {
    await upsertAdminLevelsMutation.mutateAsync({ countryId: id, levels: adminLevels });
    setAdminLevelsDirty(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings/countries"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-3xl">{form.flag}</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {form.name?.en || t('editCountry')}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {form.officialName?.en}
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{t('basicInformation')}</h2>
        <div className="grid gap-5 lg:grid-cols-2">
          <MultilingualInput
            label={t('countryName')}
            value={form.name}
            onChange={(v) => updateField('name', v)}
            required
            disabled={!canManageCountries}
          />
          <MultilingualInput
            label={t('officialName')}
            value={form.officialName}
            onChange={(v) => updateField('officialName', v)}
            disabled={!canManageCountries}
          />
          <MultilingualInput
            label={t('capital')}
            value={form.capital}
            onChange={(v) => updateField('capital', v)}
            disabled={!canManageCountries}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('flagEmoji')}</label>
            <input
              type="text"
              value={form.flag}
              onChange={(e) => updateField('flag', e.target.value)}
              disabled={!canManageCountries}
              className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-center text-2xl dark:border-gray-700 dark:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      </section>

      {/* Geography */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{t('geographyDemographics')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('population')}</label>
            <input
              type="number"
              value={form.population}
              onChange={(e) => updateField('population', e.target.value)}
              disabled={!canManageCountries}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('areaKm2')}</label>
            <input
              type="number"
              value={form.area}
              onChange={(e) => updateField('area', e.target.value)}
              disabled={!canManageCountries}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('timezone')}</label>
            <input
              type="text"
              value={form.timezone}
              onChange={(e) => updateField('timezone', e.target.value)}
              disabled={!canManageCountries}
              placeholder="Africa/Nairobi"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('currency')}</label>
            <input
              type="text"
              value={form.currency}
              onChange={(e) => updateField('currency', e.target.value)}
              disabled={!canManageCountries}
              placeholder="KES"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('phoneCode')}</label>
            <input
              type="text"
              value={form.phoneCode}
              onChange={(e) => updateField('phoneCode', e.target.value)}
              disabled={!canManageCountries}
              placeholder="+254"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('languages')}</label>
            <input
              type="text"
              value={Array.isArray(form.languages) ? form.languages.join(', ') : ''}
              onChange={(e) => updateField('languages', e.target.value.split(',').map((l: string) => l.trim()).filter(Boolean))}
              disabled={!canManageCountries}
              placeholder="en, sw"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      </section>

      {/* Status toggles */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{t('status')}</h2>
        <div className="flex gap-6">
          <ToggleField
            label={t('active')}
            description={t('visibleOnPlatform')}
            checked={form.isActive}
            onChange={(v) => updateField('isActive', v)}
            disabled={!canManageCountries}
          />
          <ToggleField
            label={t('operational')}
            description={t('fullyConfigured')}
            checked={form.isOperational}
            onChange={(v) => updateField('isOperational', v)}
            disabled={!canManageCountries}
          />
        </div>
      </section>

      {/* REC memberships */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{t('recMemberships')}</h2>
        <div className="flex flex-wrap gap-2">
          {allRecs.map((rec: any) => {
            const isMember = data?.data?.recs?.some((cr: any) => cr.rec?.id === rec.id || cr.recId === rec.id);
            return (
              <span
                key={rec.id}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
                style={{
                  borderColor: isMember ? rec.accentColor : '#e5e7eb',
                  backgroundColor: isMember ? `${rec.accentColor}10` : 'transparent',
                  color: isMember ? rec.accentColor : '#9ca3af',
                }}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: isMember ? rec.accentColor : '#d1d5db' }}
                />
                {rec.name?.en ?? rec.code}
              </span>
            );
          })}
        </div>
      </section>

      {/* Admin Levels */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('administrativeLevels')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {canEditAdminLevels && adminLevels.length < 5 && (
              <button
                type="button"
                onClick={addAdminLevel}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('addLevel')}
              </button>
            )}
            {canEditAdminLevels && adminLevelsDirty && (
              <button
                type="button"
                onClick={handleSaveAdminLevels}
                disabled={upsertAdminLevelsMutation.isPending}
                className="flex items-center gap-1 rounded-lg bg-aris-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-aris-primary-700 disabled:opacity-50"
              >
                {upsertAdminLevelsMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {t('saveLevels')}
              </button>
            )}
          </div>
        </div>

        {adminLevelsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : adminLevels.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
            {t('noAdminLevels')}
            {canEditAdminLevels && ` ${t('noAdminLevelsHint')}`}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-16">{t('level')}</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">{t('code')}</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">{t('english')}</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">{t('french')}</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">{t('portuguese')}</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">{t('arabic')}</th>
                  {canEditAdminLevels && (
                    <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-16"></th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {adminLevels.map((al, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-aris-primary-50 text-xs font-bold text-aris-primary-600 dark:bg-aris-primary-900/30 dark:text-aris-primary-400">
                        {al.level}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={al.code}
                        onChange={(e) => updateAdminLevel(idx, 'code', e.target.value)}
                        disabled={!canEditAdminLevels}
                        placeholder="county"
                        className="w-full rounded border border-gray-200 px-2 py-1 text-xs font-mono dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </td>
                    {(['en', 'fr', 'pt', 'ar'] as const).map((lang) => (
                      <td key={lang} className="px-3 py-2">
                        <input
                          type="text"
                          value={al.name?.[lang] ?? ''}
                          onChange={(e) => updateAdminLevelName(idx, lang, e.target.value)}
                          disabled={!canEditAdminLevels}
                          placeholder={lang.toUpperCase()}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        />
                      </td>
                    ))}
                    {canEditAdminLevels && (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeAdminLevel(idx)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                          title={t('removeLevel')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Manage Divisions link */}
        {adminLevels.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
            <Link
              href={`/settings/countries/${id}/divisions`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <MapPin className="h-3.5 w-3.5" />
              {t('manageDivisions')}
            </Link>
          </div>
        )}
      </section>

      {/* Welcome Message (shown when country is not active) */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-500" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Welcome Message</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Displayed on the public country page when the country is not yet active on ARIS. Supports rich text with images (paste from Word).
            </p>
          </div>
        </div>
        <RichTextEditor
          value={form.welcomeMessage}
          onChange={(html) => updateField('welcomeMessage', html)}
          disabled={!canManageCountries}
          height={350}
        />
      </section>

      {/* Statistics Configuration */}
      <CountryStatisticsSection countryId={id} />

      {/* KPI Scores */}
      <CountryKpiScoresSection countryId={id} />

      <SaveBar
        show={dirty}
        saving={updateMutation.isPending}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/50">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-aris-primary-600' : 'bg-gray-200 dark:bg-gray-700'} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

/* ─── Country Statistics Configuration ──────────────────────── */
function CountryStatisticsSection({ countryId }: { countryId: string }) {
  const { isSuperAdmin, isContinentalAdmin, isNationalAdmin } = useSettingsAccess();
  const canEdit = isSuperAdmin || isContinentalAdmin || isNationalAdmin;
  const { data: defsData } = useStatisticDefinitions({ isActive: true });
  const { data: countryData } = useCountryStatistics(countryId);
  const upsertMutation = useUpsertCountryStatistics();

  const definitions: any[] = defsData?.data ?? [];
  const countryStats: any[] = countryData?.data ?? [];

  const [localStats, setLocalStats] = useState<Record<string, { isVisible: boolean; displayPeriod: string; overrideValue: string; sortOrder: number }>>({});
  const [statsDirty, setStatsDirty] = useState(false);

  useEffect(() => {
    const map: typeof localStats = {};
    for (const def of definitions) {
      const existing = countryStats.find((cs: any) => cs.statisticId === def.id);
      map[def.id] = {
        isVisible: existing?.isVisible ?? false,
        displayPeriod: existing?.displayPeriod ?? 'current_year',
        overrideValue: existing?.overrideValue != null ? String(existing.overrideValue) : '',
        sortOrder: existing?.sortOrder ?? 0,
      };
    }
    setLocalStats(map);
    setStatsDirty(false);
  }, [definitions, countryStats]);

  const updateStat = (defId: string, field: string, value: unknown) => {
    setLocalStats((prev) => ({
      ...prev,
      [defId]: { ...prev[defId], [field]: value },
    }));
    setStatsDirty(true);
  };

  const handleSaveStats = async () => {
    const items = Object.entries(localStats)
      .filter(([, v]) => v.isVisible)
      .map(([statisticId, v]) => ({
        statisticId,
        isVisible: v.isVisible,
        displayPeriod: v.displayPeriod,
        overrideValue: v.overrideValue ? Number(v.overrideValue) : null,
        sortOrder: v.sortOrder,
      }));
    await upsertMutation.mutateAsync({ countryId, items });
    setStatsDirty(false);
  };

  if (definitions.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Statistics Configuration</h2>
        </div>
        {canEdit && statsDirty && (
          <button
            type="button"
            onClick={handleSaveStats}
            disabled={upsertMutation.isPending}
            className="flex items-center gap-1 rounded-lg bg-aris-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-aris-primary-700 disabled:opacity-50"
          >
            {upsertMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-10">Show</th>
              <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Statistic</th>
              <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Domain</th>
              <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Period</th>
              <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Override Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {definitions.map((def: any) => {
              const local = localStats[def.id];
              if (!local) return null;
              return (
                <tr key={def.id} className={local.isVisible ? '' : 'opacity-50'}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={local.isVisible}
                      onChange={(e) => updateStat(def.id, 'isVisible', e.target.checked)}
                      disabled={!canEdit}
                      className="h-4 w-4 rounded border-gray-300 text-aris-primary-600"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                    {def.name?.en ?? def.code}
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                    {def.domainCode ?? '-'}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={local.displayPeriod}
                      onChange={(e) => updateStat(def.id, 'displayPeriod', e.target.value)}
                      disabled={!canEdit}
                      className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="current_year">Current Year</option>
                      <option value="last_year">Last Year</option>
                      <option value="last_12_months">Last 12 Months</option>
                      <option value="all_time">All Time</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={local.overrideValue}
                      onChange={(e) => updateStat(def.id, 'overrideValue', e.target.value)}
                      disabled={!canEdit}
                      placeholder="Auto"
                      className="w-24 rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ─── Country KPI Scores ───────────────────────────────────── */
function CountryKpiScoresSection({ countryId }: { countryId: string }) {
  const { isSuperAdmin, isContinentalAdmin, isNationalAdmin } = useSettingsAccess();
  const canEdit = isSuperAdmin || isContinentalAdmin || isNationalAdmin;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: defsData } = useKpiDefinitions({ isActive: true });
  const { data: scoresData } = useCountryKpiScores(countryId, year);
  const upsertMutation = useUpsertCountryKpiScores();

  const definitions: any[] = defsData?.data ?? [];
  const scores: any[] = scoresData?.data ?? [];

  const [localScores, setLocalScores] = useState<Record<string, { score: string; notes: string }>>({});
  const [scoresDirty, setScoresDirty] = useState(false);

  useEffect(() => {
    const map: typeof localScores = {};
    for (const def of definitions) {
      const existing = scores.find((s: any) => s.kpiId === def.id);
      map[def.id] = {
        score: existing?.score != null ? String(existing.score) : '',
        notes: existing?.notes ?? '',
      };
    }
    setLocalScores(map);
    setScoresDirty(false);
  }, [definitions, scores]);

  const updateScore = (defId: string, field: string, value: string) => {
    setLocalScores((prev) => ({
      ...prev,
      [defId]: { ...prev[defId], [field]: value },
    }));
    setScoresDirty(true);
  };

  const handleSaveScores = async () => {
    const items = Object.entries(localScores)
      .filter(([, v]) => v.score !== '')
      .map(([kpiId, v]) => ({
        kpiId,
        score: Number(v.score),
        year,
        notes: v.notes || null,
      }));
    await upsertMutation.mutateAsync({ countryId, items });
    setScoresDirty(false);
  };

  if (definitions.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">KPI Scores</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {canEdit && scoresDirty && (
            <button
              type="button"
              onClick={handleSaveScores}
              disabled={upsertMutation.isPending}
              className="flex items-center gap-1 rounded-lg bg-aris-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-aris-primary-700 disabled:opacity-50"
            >
              {upsertMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </button>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {definitions.map((def: any) => {
          const local = localScores[def.id];
          if (!local) return null;
          const score = local.score ? Number(local.score) : 0;
          const good = def.thresholdGood ?? 75;
          const warn = def.thresholdWarn ?? 50;
          const barColor = score >= good ? '#22c55e' : score >= warn ? '#f59e0b' : '#ef4444';
          return (
            <div key={def.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {def.name?.en ?? def.code}
                    {def.isPreset && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Preset
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{def.domainCode ?? 'General'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={local.score}
                    onChange={(e) => updateScore(def.id, 'score', e.target.value)}
                    disabled={!canEdit}
                    placeholder="0-100"
                    className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-xs font-mono dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              </div>
              {/* Preview bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(score, 100)}%`, backgroundColor: barColor }}
                />
              </div>
              <input
                type="text"
                value={local.notes}
                onChange={(e) => updateScore(def.id, 'notes', e.target.value)}
                disabled={!canEdit}
                placeholder="Notes (optional)"
                className="mt-2 w-full rounded border border-gray-100 px-2 py-1 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
