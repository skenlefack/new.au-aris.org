'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSettingsRec, useUpdateRec, useSettingsRecs } from '@/lib/api/settings-hooks';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { MultilingualTextarea } from '@/components/settings/MultilingualTextarea';
import { ColorPicker } from '@/components/settings/ColorPicker';
import { StatsEditor } from '@/components/settings/StatsEditor';
import { SaveBar } from '@/components/settings/SaveBar';
import { useTranslations } from '@/lib/i18n/translations';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

const emptyML = { en: '', fr: '', pt: '', ar: '', es: '', sw: '' };

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — US Dollar ($)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'XOF', label: 'XOF — CFA Franc BCEAO (CFA)' },
  { value: 'XAF', label: 'XAF — CFA Franc BEAC (FCFA)' },
  { value: 'ZAR', label: 'ZAR — South African Rand (R)' },
  { value: 'KES', label: 'KES — Kenyan Shilling (KSh)' },
  { value: 'NGN', label: 'NGN — Nigerian Naira (₦)' },
  { value: 'EGP', label: 'EGP — Egyptian Pound (E£)' },
  { value: 'GHS', label: 'GHS — Ghanaian Cedi (GH₵)' },
  { value: 'ETB', label: 'ETB — Ethiopian Birr (Br)' },
  { value: 'TZS', label: 'TZS — Tanzanian Shilling (TSh)' },
  { value: 'UGX', label: 'UGX — Ugandan Shilling (USh)' },
  { value: 'MAD', label: 'MAD — Moroccan Dirham' },
  { value: 'TND', label: 'TND — Tunisian Dinar (DT)' },
  { value: 'DZD', label: 'DZD — Algerian Dinar (DA)' },
  { value: 'BWP', label: 'BWP — Botswana Pula (P)' },
  { value: 'MUR', label: 'MUR — Mauritian Rupee (₨)' },
  { value: 'RWF', label: 'RWF — Rwandan Franc (RF)' },
  { value: 'SZL', label: 'SZL — Swazi Lilangeni (E)' },
  { value: 'MZN', label: 'MZN — Mozambican Metical (MT)' },
];

export default function RecDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { canManageRecs } = useSettingsAccess();
  const t = useTranslations('settings');
  const { data, isLoading } = useSettingsRec(id);
  const updateMutation = useUpdateRec();

  const [form, setForm] = useState<Record<string, any>>({
    name: { ...emptyML },
    fullName: { ...emptyML },
    description: { ...emptyML },
    region: { ...emptyML },
    headquarters: '',
    established: null as number | null,
    accentColor: '#003399',
    logoUrl: '',
    website: '',
    currency: '',
    isActive: true,
    sortOrder: 0,
    stats: {} as Record<string, number>,
  });

  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.data) {
      const rec = data.data;
      setForm({
        name: rec.name ?? { ...emptyML },
        fullName: rec.fullName ?? { ...emptyML },
        description: rec.description ?? { ...emptyML },
        region: rec.region ?? { ...emptyML },
        headquarters: rec.headquarters ?? '',
        established: rec.established ?? null,
        accentColor: rec.accentColor ?? '#003399',
        logoUrl: rec.logoUrl ?? '',
        website: rec.website ?? '',
        currency: rec.currency ?? '',
        isActive: rec.isActive ?? true,
        sortOrder: rec.sortOrder ?? 0,
        stats: rec.stats ?? {},
      });
      setDirty(false);
    }
  }, [data]);

  const updateField = (key: string, value: unknown) => {
    setForm((prev: Record<string, any>) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    await updateMutation.mutateAsync({ id, ...form });
    setDirty(false);
  };

  const handleDiscard = () => {
    if (data?.data) {
      const rec = data.data;
      setForm({
        name: rec.name ?? { ...emptyML },
        fullName: rec.fullName ?? { ...emptyML },
        description: rec.description ?? { ...emptyML },
        region: rec.region ?? { ...emptyML },
        headquarters: rec.headquarters ?? '',
        established: rec.established ?? null,
        accentColor: rec.accentColor ?? '#003399',
        logoUrl: rec.logoUrl ?? '',
        website: rec.website ?? '',
        currency: rec.currency ?? '',
        isActive: rec.isActive ?? true,
        sortOrder: rec.sortOrder ?? 0,
        stats: rec.stats ?? {},
      });
    }
    setDirty(false);
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
          href="/settings/recs"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {form.name?.en || t('editRec')}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {form.fullName?.en}
          </p>
        </div>
        {/* Color dot */}
        <div
          className="h-4 w-4 rounded-full border border-gray-200 dark:border-gray-700"
          style={{ backgroundColor: form.accentColor }}
        />
      </div>

      {/* Preview card */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">{t('landingPagePreview')}</p>
        <div
          className="rounded-lg px-4 py-3 text-white"
          style={{ background: `linear-gradient(135deg, ${form.accentColor}, ${form.accentColor}cc)` }}
        >
          <p className="text-lg font-bold">{form.name?.en || 'REC Name'}</p>
          <p className="text-xs opacity-80">{form.fullName?.en || 'Full name...'}</p>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <MultilingualInput
            label={t('recName')}
            value={form.name}
            onChange={(v) => updateField('name', v)}
            required
            disabled={!canManageRecs}
          />
          <MultilingualInput
            label={t('fullName')}
            value={form.fullName}
            onChange={(v) => updateField('fullName', v)}
            required
            disabled={!canManageRecs}
          />
          <MultilingualInput
            label={t('region')}
            value={form.region}
            onChange={(v) => updateField('region', v)}
            disabled={!canManageRecs}
          />
          <MultilingualTextarea
            label={t('description')}
            value={form.description}
            onChange={(v) => updateField('description', v)}
            disabled={!canManageRecs}
          />
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('headquarters')}
            </label>
            <input
              type="text"
              value={form.headquarters}
              onChange={(e) => updateField('headquarters', e.target.value)}
              disabled={!canManageRecs}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('establishedYear')}
            </label>
            <input
              type="number"
              value={form.established ?? ''}
              onChange={(e) => updateField('established', e.target.value ? Number(e.target.value) : null)}
              disabled={!canManageRecs}
              className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <ColorPicker
            label={t('accentColor')}
            value={form.accentColor}
            onChange={(v) => updateField('accentColor', v)}
            disabled={!canManageRecs}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('website')}
            </label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => updateField('website', e.target.value)}
              disabled={!canManageRecs}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('recCurrency')}
            </label>
            <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t('recCurrencyDesc')}
            </p>
            <SearchableSelect
              value={form.currency ?? ''}
              onChange={(v) => updateField('currency', v || null)}
              options={CURRENCY_OPTIONS}
              disabled={!canManageRecs}
              placeholder="—"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/50">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t('active')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('showOnLanding')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.isActive}
              onClick={() => canManageRecs && updateField('isActive', !form.isActive)}
              disabled={!canManageRecs}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.isActive ? 'bg-aris-primary-600' : 'bg-gray-200 dark:bg-gray-700'} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <StatsEditor
          label={t('recStatistics')}
          value={form.stats ?? {}}
          onChange={(v) => updateField('stats', v)}
          disabled={!canManageRecs}
          suggestions={['activeCampaigns', 'reportsSubmitted', 'outbreaksReported', 'dataQualityScore', 'tradeAgreements']}
        />
      </div>

      <SaveBar
        show={dirty}
        saving={updateMutation.isPending}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  );
}
