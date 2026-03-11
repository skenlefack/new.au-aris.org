'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSettingsCountry, useUpdateCountry, useSettingsRecs, useAdminLevels, useUpsertAdminLevels, type AdminLevel } from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { StatsEditor } from '@/components/settings/StatsEditor';
import { SectorPerformanceEditor } from '@/components/settings/SectorPerformanceEditor';
import { SaveBar } from '@/components/settings/SaveBar';
import { ArrowLeft, Loader2, Layers, Plus, Trash2, Save, MapPin } from 'lucide-react';
import Link from 'next/link';

const emptyML = { en: '', fr: '', pt: '', ar: '' };

export default function CountryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { canManageCountries, canEditCountryStats, canEditCountrySectors, isSuperAdmin, isContinentalAdmin, isNationalAdmin } = useSettingsAccess();
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
    isActive: true,
    isOperational: false,
    stats: {} as Record<string, number>,
    sectorPerformance: { vaccination: 0, fisheries: 0, wildlife: 0, governance: 0, dataQuality: 0, analytics: 0 },
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
        isActive: c.isActive ?? true,
        isOperational: c.isOperational ?? false,
        stats: c.stats ?? {},
        sectorPerformance: c.sectorPerformance ?? { vaccination: 0, fisheries: 0, wildlife: 0, governance: 0, dataQuality: 0, analytics: 0 },
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
        isActive: c.isActive ?? true,
        isOperational: c.isOperational ?? false,
        stats: c.stats ?? {},
        sectorPerformance: c.sectorPerformance ?? {},
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
            {form.name?.en || 'Edit Country'}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {form.officialName?.en}
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Basic Information</h2>
        <div className="grid gap-5 lg:grid-cols-2">
          <MultilingualInput
            label="Country Name"
            value={form.name}
            onChange={(v) => updateField('name', v)}
            required
            disabled={!canManageCountries}
          />
          <MultilingualInput
            label="Official Name"
            value={form.officialName}
            onChange={(v) => updateField('officialName', v)}
            disabled={!canManageCountries}
          />
          <MultilingualInput
            label="Capital"
            value={form.capital}
            onChange={(v) => updateField('capital', v)}
            disabled={!canManageCountries}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Flag Emoji</label>
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
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Geography & Demographics</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Population</label>
            <input
              type="number"
              value={form.population}
              onChange={(e) => updateField('population', e.target.value)}
              disabled={!canManageCountries}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Area (km²)</label>
            <input
              type="number"
              value={form.area}
              onChange={(e) => updateField('area', e.target.value)}
              disabled={!canManageCountries}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Timezone</label>
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Code</label>
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Languages</label>
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
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Status</h2>
        <div className="flex gap-6">
          <ToggleField
            label="Active"
            description="Visible on the ARIS platform"
            checked={form.isActive}
            onChange={(v) => updateField('isActive', v)}
            disabled={!canManageCountries}
          />
          <ToggleField
            label="Operational"
            description="Fully configured and collecting data"
            checked={form.isOperational}
            onChange={(v) => updateField('isOperational', v)}
            disabled={!canManageCountries}
          />
        </div>
      </section>

      {/* REC memberships */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">REC Memberships</h2>
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
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Administrative Levels</h2>
          </div>
          <div className="flex items-center gap-2">
            {canEditAdminLevels && adminLevels.length < 5 && (
              <button
                type="button"
                onClick={addAdminLevel}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Level
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
                Save Levels
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
            No administrative levels configured for this country.
            {canEditAdminLevels && ' Click "Add Level" to define the hierarchy.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-16">Level</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Code</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">English</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">French</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Portuguese</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Arabic</th>
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
                          title="Remove level"
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
              Manage Divisions
            </Link>
          </div>
        )}
      </section>

      {/* Stats */}
      {canEditCountryStats && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <StatsEditor
            label="Country Statistics"
            value={form.stats ?? {}}
            onChange={(v) => updateField('stats', v)}
            suggestions={['activeOutbreaks', 'vaccinationCoverage', 'livestockCensus', 'tradeVolume', 'fishCatch', 'wildlifeSpecies']}
          />
        </section>
      )}

      {/* Sector Performance */}
      {canEditCountrySectors && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <SectorPerformanceEditor
            value={form.sectorPerformance ?? {}}
            onChange={(v) => updateField('sectorPerformance', v)}
          />
        </section>
      )}

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
