'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import {
  useIndicator,
  useIndicatorTypes,
  useUpdateIndicator,
  useIndicatorValues,
} from '@/lib/api/indicator-hooks';
import type {
  Indicator,
  IndicatorMeasurementMode,
  IndicatorScope,
  IndicatorValue,
} from '@/lib/api/indicator-hooks';
import { useSettingsDomains } from '@/lib/api/settings-hooks';
import { useAdminSubDomains } from '@/lib/api/sub-domain-hooks';
import { Pagination } from '@/components/ui/Pagination';
import { ForbiddenPage } from '@/components/ui/ForbiddenPage';
import { useTranslations } from '@/lib/i18n/translations';
import {
  Loader2,
  ArrowLeft,
  Check,
  Pencil,
  Activity,
} from 'lucide-react';
import { useAutoTranslateOnBlur } from '@/components/settings/AutoTranslateGroup';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN']);

export default function IndicatorDetailPage() {
  const user = useAuthStore((s) => s.user);
  if (!user || !ADMIN_ROLES.has(user.role)) return <ForbiddenPage />;
  return <IndicatorDetail />;
}

function IndicatorDetail() {
  const t = useTranslations('settings');
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const addToast = useRealtimeStore((s) => s.addToast);
  const id = params.id as string;
  const initialTab = searchParams.get('tab') === 'values' ? 'values' : 'edit';

  const { data: indicatorData, isLoading } = useIndicator(id);
  const { data: typesData } = useIndicatorTypes();
  const { data: domainsData } = useSettingsDomains();
  const updateMutation = useUpdateIndicator();

  const indicator = indicatorData?.data;
  const types = (typesData?.data ?? []).filter((tp) => tp.active);
  const domains = (domainsData as any)?.data ?? [];

  const [tab, setTab] = useState(initialTab);
  const [editing, setEditing] = useState(false);

  // Form state
  const [typeCode, setTypeCode] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [namePt, setNamePt] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [nameSw, setNameSw] = useState('');
  const [domainId, setDomainId] = useState('');
  const [selectedDomainCode, setSelectedDomainCode] = useState('');
  const [subDomainId, setSubDomainId] = useState('');
  const [scope, setScope] = useState<IndicatorScope>('NATIONAL');
  const [measurementMode, setMeasurementMode] = useState<IndicatorMeasurementMode>('MANUAL_ENTRY');
  const [unit, setUnit] = useState('count');
  const [decimalPlaces, setDecimalPlaces] = useState(0);
  const [targetValue, setTargetValue] = useState('');
  const [betterIsHigher, setBetterIsHigher] = useState(true);
  const [descriptionFr, setDescriptionFr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { handleBlur: handleNameBlur } = useAutoTranslateOnBlur(
    { en: nameEn, fr: nameFr, pt: namePt, ar: nameAr, es: nameEs, sw: nameSw },
    { en: (v) => setNameEn(v), fr: (v) => setNameFr(v), pt: (v) => setNamePt(v), ar: (v) => setNameAr(v) },
  );

  const { handleBlur: handleDescBlur } = useAutoTranslateOnBlur(
    { en: descriptionEn, fr: descriptionFr },
    { en: (v) => setDescriptionEn(v), fr: (v) => setDescriptionFr(v) },
  );

  const { data: subDomainsData } = useAdminSubDomains({
    domainCode: selectedDomainCode || undefined,
    limit: 200,
  });
  const subDomains = subDomainsData?.data ?? [];

  // Values tab state
  const [valuesPage, setValuesPage] = useState(1);
  const { data: valuesData, isLoading: valuesLoading } = useIndicatorValues(id, {
    page: valuesPage,
    limit: 20,
  });
  const values = valuesData?.data ?? [];
  const valuesMeta = valuesData?.meta ?? { total: 0, page: 1, limit: 20 };

  // Populate form when indicator loads
  useEffect(() => {
    if (!indicator) return;
    setTypeCode(indicator.typeCode);
    setNameFr(indicator.nameFr);
    setNameEn(indicator.nameEn);
    setNameAr(indicator.nameAr ?? '');
    setNamePt(indicator.namePt ?? '');
    setDomainId(indicator.domainId ?? '');
    setSubDomainId(indicator.subDomainId ?? '');
    setScope(indicator.scope ?? 'NATIONAL');
    setMeasurementMode(indicator.measurementMode ?? 'MANUAL_ENTRY');
    setUnit(indicator.unit ?? 'count');
    setDecimalPlaces(indicator.decimalPlaces ?? 0);
    setTargetValue(indicator.targetValue != null ? String(indicator.targetValue) : '');
    setBetterIsHigher(indicator.betterIsHigher ?? true);
    setDescriptionFr(indicator.descriptionFr ?? '');
    setDescriptionEn(indicator.descriptionEn ?? '');
    if (indicator.domainId) {
      const dom = domains.find((d: any) => d.id === indicator.domainId);
      if (dom) setSelectedDomainCode(dom.code);
    }
  }, [indicator, domains]);

  const scopeOptions: { value: IndicatorScope; label: string }[] = [
    { value: 'CONTINENTAL',  label: t('scopeContinental') },
    { value: 'REGIONAL',     label: t('scopeRegional') },
    { value: 'NATIONAL',     label: t('scopeNational') },
    { value: 'SUB_NATIONAL', label: t('scopeSubNational') },
    { value: 'CROSS_CUTTING',label: t('scopeCrossCutting') },
  ];

  const modeOptions: { value: IndicatorMeasurementMode; label: string; desc: string }[] = [
    { value: 'MANUAL_ENTRY',         label: t('modeManualEntryLabel'), desc: t('modeManualEntryDesc') },
    { value: 'AUTO_FROM_FORM',        label: t('modeAutoFormLabel'),    desc: t('modeAutoFormDesc') },
    { value: 'AUTO_FROM_KPI_SOURCE',  label: t('modeAutoKpiLabel'),     desc: t('modeAutoKpiDesc') },
    { value: 'COMPOSITE_FORMULA',     label: t('modeFormulaLabel'),     desc: t('modeFormulaDesc') },
  ];

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!typeCode) e.typeCode = t('typeRequired');
    if (!nameFr.trim()) e.nameFr = t('nameFrRequired');
    if (!nameEn.trim()) e.nameEn = t('nameEnRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    try {
      await updateMutation.mutateAsync({
        id,
        typeCode,
        nameFr: nameFr.trim(),
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim() || undefined,
        namePt: namePt.trim() || undefined,
        descriptionFr: descriptionFr.trim() || undefined,
        descriptionEn: descriptionEn.trim() || undefined,
        domainId: domainId || undefined,
        subDomainId: subDomainId || undefined,
        scope,
        measurementMode,
        unit: unit.trim() || 'count',
        decimalPlaces,
        targetValue: targetValue ? parseFloat(targetValue) : undefined,
        betterIsHigher,
      });
      addToast({ type: 'success', title: t('indicatorUpdated'), message: t('indicatorUpdatedMsg') });
      setEditing(false);
    } catch (err: any) {
      addToast({ type: 'error', title: t('error'), message: err?.message || t('indicatorUpdateError') });
    }
  };

  const handleDomainChange = (val: string) => {
    setDomainId(val);
    setSubDomainId('');
    const dom = domains.find((d: any) => d.id === val);
    setSelectedDomainCode(dom?.code ?? '');
  };

  const inputCls = (field: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-900 dark:text-white ${
      errors[field]
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
        : 'border-gray-200 focus:border-[#1F4E79] focus:ring-[#1F4E79] dark:border-gray-700'
    }`;

  const selectCls = (field: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-900 dark:text-white ${
      errors[field]
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
        : 'border-gray-200 focus:border-[#1F4E79] focus:ring-[#1F4E79] dark:border-gray-700'
    }`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!indicator) {
    return (
      <div className="py-24 text-center text-gray-400">{t('indicatorNotFound')}</div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings/indicators"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{indicator.nameEn}</h1>
            <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{indicator.code}</p>
          </div>
        </div>
        {tab === 'edit' && !editing && (
          <button onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1F4E79]/90">
            <Pencil className="h-4 w-4" />
            {t('btnEdit')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setTab('edit')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'edit'
              ? 'border-b-2 border-[#1F4E79] text-[#1F4E79]'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}>
          {t('tabDetails')}
        </button>
        <button onClick={() => setTab('values')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'values'
              ? 'border-b-2 border-[#1F4E79] text-[#1F4E79]'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}>
          {t('tabValues').replace('{count}', String(valuesMeta.total))}
        </button>
      </div>

      {/* Edit tab */}
      {tab === 'edit' && (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          {/* Row: Code (readonly) + Type */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('indicatorCode')}</label>
              <input type="text" value={indicator.code} disabled
                className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('indicatorType')} <span className="text-red-500">*</span>
              </label>
              <select value={typeCode} onChange={(e) => setTypeCode(e.target.value)} disabled={!editing} className={selectCls('typeCode')}>
                <option value="">{t('selectType')}</option>
                {types.map((tp) => <option key={tp.code} value={tp.code}>{tp.labelEn} ({tp.code})</option>)}
              </select>
              {errors.typeCode && <p className="text-xs text-red-600">{errors.typeCode}</p>}
            </div>
          </div>

          {/* Names FR / EN */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('nameFr')} <span className="text-red-500">*</span>
              </label>
              <input type="text" value={nameFr} onChange={(e) => setNameFr(e.target.value)} onBlur={handleNameBlur} disabled={!editing}
                className={inputCls('nameFr')} />
              {errors.nameFr && <p className="text-xs text-red-600">{errors.nameFr}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('nameEn')} <span className="text-red-500">*</span>
              </label>
              <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} onBlur={handleNameBlur} disabled={!editing}
                className={inputCls('nameEn')} />
              {errors.nameEn && <p className="text-xs text-red-600">{errors.nameEn}</p>}
            </div>
          </div>

          {/* Names AR / PT */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('nameAr')}</label>
              <input type="text" value={nameAr} onChange={(e) => setNameAr(e.target.value)} onBlur={handleNameBlur} disabled={!editing}
                dir="rtl" className={inputCls('nameAr')} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('namePt')}</label>
              <input type="text" value={namePt} onChange={(e) => setNamePt(e.target.value)} onBlur={handleNameBlur} disabled={!editing}
                className={inputCls('namePt')} />
            </div>
          </div>

          {/* Domain / Sub-domain */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('domain')}</label>
              <select value={domainId} onChange={(e) => handleDomainChange(e.target.value)} disabled={!editing} className={selectCls('domainId')}>
                <option value="">{t('noSpecificDomain')}</option>
                {domains.map((d: any) => <option key={d.id} value={d.id}>{d.name?.en ?? d.code}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelSubDomain')}</label>
              <select value={subDomainId} onChange={(e) => setSubDomainId(e.target.value)}
                disabled={!editing || !domainId}
                className={`${selectCls('subDomainId')} ${!domainId ? 'cursor-not-allowed opacity-50' : ''}`}>
                <option value="">{t('noSubDomain2')}</option>
                {subDomains.map((sd: any) => <option key={sd.id} value={sd.id}>{sd.labelEn || sd.labelFr} ({sd.code})</option>)}
              </select>
            </div>
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelScope')}</label>
            <div className="flex flex-wrap gap-3">
              {scopeOptions.map((opt) => (
                <label key={opt.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    scope === opt.value
                      ? 'border-[#1F4E79] bg-[#1F4E79]/5 font-medium text-[#1F4E79] dark:border-[#1F4E79] dark:bg-[#1F4E79]/10'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/40'
                  } ${!editing ? 'pointer-events-none opacity-60' : ''}`}>
                  <input type="radio" name="scope" value={opt.value} checked={scope === opt.value}
                    onChange={() => setScope(opt.value)} disabled={!editing} className="accent-[#1F4E79]" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Measurement mode */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelMeasurementMode')}</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {modeOptions.map((opt) => (
                <label key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    measurementMode === opt.value
                      ? 'border-[#1F4E79] bg-[#1F4E79]/5 dark:border-[#1F4E79] dark:bg-[#1F4E79]/10'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40'
                  } ${!editing ? 'pointer-events-none opacity-60' : ''}`}>
                  <input type="radio" name="measurementMode" value={opt.value} checked={measurementMode === opt.value}
                    onChange={() => setMeasurementMode(opt.value)} disabled={!editing} className="mt-0.5 accent-[#1F4E79]" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Unit + Decimals + Target + Direction */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelUnit')}</label>
              <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!editing}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelDecimalPlaces')}</label>
              <input type="number" min={0} max={6} value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(parseInt(e.target.value, 10) || 0)} disabled={!editing}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelTargetValue')}</label>
              <input type="number" step="any" value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)} disabled={!editing}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </div>
            <div className="flex items-end gap-3 pb-1">
              <button type="button" onClick={() => editing && setBetterIsHigher(!betterIsHigher)} disabled={!editing}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  editing ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                } ${betterIsHigher ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${betterIsHigher ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {betterIsHigher ? t('labelBetterIsHigher') : t('labelBetterIsLower')}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelDescriptionFr')}</label>
              <textarea value={descriptionFr} onChange={(e) => setDescriptionFr(e.target.value)} onBlur={handleDescBlur} disabled={!editing} rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelDescriptionEn')}</label>
              <textarea value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} onBlur={handleDescBlur} disabled={!editing} rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </div>
          </div>

          {/* Save / Cancel */}
          {editing && (
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
              <button type="button" onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                {t('cancel')}
              </button>
              <button type="submit" disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F4E79]/90 disabled:opacity-50">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t('btnSaveChanges')}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Values tab */}
      {tab === 'values' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {valuesLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('colYear')}</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('colCountry')}</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('colRec')}</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('colValue')}</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('colSource')}</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{t('colDate')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {values.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                          {t('noValuesForIndicator')}
                        </td>
                      </tr>
                    ) : (
                      values.map((v) => (
                        <tr key={v.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{v.year}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {v.countryCode || <span className="text-gray-300 dark:text-gray-600">&mdash;</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {v.recCode || (v.isContinental ? t('continental') : <span className="text-gray-300 dark:text-gray-600">&mdash;</span>)}
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">
                            {v.value.toLocaleString(undefined, { maximumFractionDigits: indicator.decimalPlaces ?? 2 })}
                            {indicator.unit ? <span className="ml-1 text-xs text-gray-400">{indicator.unit}</span> : null}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{v.source ?? ''}</td>
                          <td className="px-4 py-3 text-gray-400 dark:text-gray-500">
                            {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {valuesMeta.total > 0 && (
                <Pagination
                  page={valuesPage}
                  total={valuesMeta.total}
                  limit={20}
                  onPageChange={setValuesPage}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
