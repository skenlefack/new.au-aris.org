'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import {
  useIndicatorTypes,
  useCreateIndicator,
} from '@/lib/api/indicator-hooks';
import type {
  IndicatorMeasurementMode,
  IndicatorScope,
} from '@/lib/api/indicator-hooks';
import { useSettingsDomains } from '@/lib/api/settings-hooks';
import { useAdminSubDomains } from '@/lib/api/sub-domain-hooks';
import { ForbiddenPage } from '@/components/ui/ForbiddenPage';
import { useTranslations } from '@/lib/i18n/translations';
import { Loader2, ArrowLeft, Check, Sparkles } from 'lucide-react';
import { AiSuggestionDialog } from '@/components/ai/AiSuggestionDialog';
import { useAutoTranslateOnBlur } from '@/components/settings/AutoTranslateGroup';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN']);

function slugify(text: string): string {
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export default function NewIndicatorPage() {
  const user = useAuthStore((s) => s.user);
  if (!user || !ADMIN_ROLES.has(user.role)) return <ForbiddenPage />;
  return <IndicatorForm />;
}

function IndicatorForm() {
  const t = useTranslations('settings');
  const router = useRouter();
  const addToast = useRealtimeStore((s) => s.addToast);
  const createMutation = useCreateIndicator();

  const { data: typesData } = useIndicatorTypes();
  const { data: domainsData } = useSettingsDomains();
  const types = (typesData?.data ?? []).filter((tp) => tp.active);
  const domains = (domainsData as any)?.data ?? [];

  const [selectedDomainCode, setSelectedDomainCode] = useState('');
  const { data: subDomainsData } = useAdminSubDomains({
    domainCode: selectedDomainCode || undefined,
    limit: 200,
  });
  const subDomains = subDomainsData?.data ?? [];

  // Form state
  const [code, setCode] = useState('');
  const [codeManual, setCodeManual] = useState(false);
  const [typeCode, setTypeCode] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [namePt, setNamePt] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [nameSw, setNameSw] = useState('');
  const [domainId, setDomainId] = useState('');
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

  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const handleAiAccept = (draft: any) => {
    if (draft.code) { setCode(draft.code); setCodeManual(true); }
    if (draft.nameEn) handleNameEnChange(draft.nameEn);
    if (draft.nameFr) setNameFr(draft.nameFr);
    if (draft.nameAr) setNameAr(draft.nameAr);
    if (draft.namePt) setNamePt(draft.namePt);
    if (draft.descriptionEn) setDescriptionEn(draft.descriptionEn);
    if (draft.descriptionFr) setDescriptionFr(draft.descriptionFr);
    if (draft.scope) setScope(draft.scope);
    if (draft.measurementMode) setMeasurementMode(draft.measurementMode);
    if (draft.unit) setUnit(draft.unit);
    if (draft.targetValue !== undefined) setTargetValue(String(draft.targetValue));
    if (draft.betterIsHigher !== undefined) setBetterIsHigher(draft.betterIsHigher);
  };

  const handleNameEnChange = (val: string) => {
    setNameEn(val);
    if (!codeManual && val.trim()) {
      setCode(slugify(val).substring(0, 80));
    }
  };

  const handleDomainChange = (val: string) => {
    setDomainId(val);
    setSubDomainId('');
    const dom = domains.find((d: any) => d.id === val);
    setSelectedDomainCode(dom?.code ?? '');
  };

  const scopeOptions: { value: IndicatorScope; label: string }[] = [
    { value: 'CONTINENTAL',   label: t('scopeContinental') },
    { value: 'REGIONAL',      label: t('scopeRegional') },
    { value: 'NATIONAL',      label: t('scopeNational') },
    { value: 'SUB_NATIONAL',  label: t('scopeSubNational') },
    { value: 'CROSS_CUTTING', label: t('scopeCrossCutting') },
  ];

  const modeOptions: { value: IndicatorMeasurementMode; label: string; desc: string }[] = [
    { value: 'MANUAL_ENTRY',        label: t('modeManualEntryLabel'), desc: t('modeManualEntryDescLong') },
    { value: 'AUTO_FROM_FORM',       label: t('modeAutoFormLabel'),   desc: t('modeAutoFormDescLong') },
    { value: 'AUTO_FROM_KPI_SOURCE', label: t('modeAutoKpiLabel'),    desc: t('modeAutoKpiDescLong') },
    { value: 'COMPOSITE_FORMULA',    label: t('modeFormulaLabel'),    desc: t('modeFormulaDescLong') },
  ];

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = t('codeRequired2');
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
      await createMutation.mutateAsync({
        code: code.trim(),
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
      addToast({ type: 'success', title: t('indicatorCreated'), message: t('indicatorCreatedMsg').replace('{code}', code) });
      router.push('/settings/indicators');
    } catch (err: any) {
      if (err?.errors?.length) {
        const fieldErrors: Record<string, string> = {};
        for (const fe of err.errors) fieldErrors[fe.field] = fe.message;
        setErrors(fieldErrors);
      }
      addToast({ type: 'error', title: t('error'), message: err?.message || t('indicatorCreateError') });
    }
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('newIndicatorTitle')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('newIndicatorDesc')}</p>
          </div>
        </div>
        <button
          onClick={() => setAiDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-[#C9A227]/30 bg-gradient-to-r from-[#1F4E79]/5 to-[#C9A227]/5 px-4 py-2 text-sm font-medium text-[#1F4E79] hover:from-[#1F4E79]/10 hover:to-[#C9A227]/10 transition-all dark:text-[#C9A227] dark:border-[#C9A227]/20"
        >
          <Sparkles className="h-4 w-4" style={{ color: '#C9A227' }} />
          {t('suggestWithAi')}
        </button>
      </div>

      <AiSuggestionDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        type="indicator"
        onAccept={handleAiAccept}
        context={{ domainId: selectedDomainCode }}
      />

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        {/* Row 1: Code + Type */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('indicatorCode')} <span className="text-red-500">*</span>
            </label>
            <input type="text" value={code}
              onChange={(e) => { setCodeManual(true); setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '')); }}
              placeholder="AUTO_GENERATED_FROM_NAME"
              className={`${inputCls('code')} font-mono`} />
            {errors.code && <p className="text-xs text-red-600">{errors.code}</p>}
            {!codeManual && (
              <p className="text-xs text-gray-400">{t('codeAutoGenerated')}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('indicatorType')} <span className="text-red-500">*</span>
            </label>
            <select value={typeCode} onChange={(e) => setTypeCode(e.target.value)} className={selectCls('typeCode')}>
              <option value="">{t('selectType')}</option>
              {types.map((tp) => <option key={tp.code} value={tp.code}>{tp.labelEn} ({tp.code})</option>)}
            </select>
            {errors.typeCode && <p className="text-xs text-red-600">{errors.typeCode}</p>}
          </div>
        </div>

        {/* Row 2: Names FR / EN */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('nameFr')} <span className="text-red-500">*</span>
            </label>
            <input type="text" value={nameFr} onChange={(e) => setNameFr(e.target.value)} onBlur={handleNameBlur}
              placeholder="Taux de vaccination bovine" className={inputCls('nameFr')} />
            {errors.nameFr && <p className="text-xs text-red-600">{errors.nameFr}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('nameEn')} <span className="text-red-500">*</span>
            </label>
            <input type="text" value={nameEn} onChange={(e) => handleNameEnChange(e.target.value)} onBlur={handleNameBlur}
              placeholder="Cattle vaccination rate" className={inputCls('nameEn')} />
            {errors.nameEn && <p className="text-xs text-red-600">{errors.nameEn}</p>}
          </div>
        </div>

        {/* Row 3: Names AR / PT */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('nameAr')} <span className="text-xs text-gray-400">{t('optional')}</span>
            </label>
            <input type="text" value={nameAr} onChange={(e) => setNameAr(e.target.value)} onBlur={handleNameBlur}
              dir="rtl" className={inputCls('nameAr')} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('namePt')} <span className="text-xs text-gray-400">{t('optional')}</span>
            </label>
            <input type="text" value={namePt} onChange={(e) => setNamePt(e.target.value)} onBlur={handleNameBlur}
              className={inputCls('namePt')} />
          </div>
        </div>

        {/* Row 4: Domain + Sub-domain */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('domain')} <span className="text-xs text-gray-400">{t('optional')}</span>
            </label>
            <select value={domainId} onChange={(e) => handleDomainChange(e.target.value)} className={selectCls('domainId')}>
              <option value="">{t('noSpecificDomain')}</option>
              {domains.map((d: any) => <option key={d.id} value={d.id}>{d.name?.en ?? d.code}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('labelSubDomain')} <span className="text-xs text-gray-400">{t('optional')}</span>
            </label>
            <select value={subDomainId} onChange={(e) => setSubDomainId(e.target.value)}
              disabled={!domainId}
              className={`${selectCls('subDomainId')} ${!domainId ? 'cursor-not-allowed opacity-50' : ''}`}>
              <option value="">{t('noSubDomain2')}</option>
              {subDomains.map((sd: any) => <option key={sd.id} value={sd.id}>{sd.labelEn || sd.labelFr} ({sd.code})</option>)}
            </select>
          </div>
        </div>

        {/* Row 5: Scope (radio) */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelScope')}</label>
          <div className="flex flex-wrap gap-3">
            {scopeOptions.map((opt) => (
              <label key={opt.value}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  scope === opt.value
                    ? 'border-[#1F4E79] bg-[#1F4E79]/5 font-medium text-[#1F4E79] dark:border-[#1F4E79] dark:bg-[#1F4E79]/10'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/40'
                }`}>
                <input type="radio" name="scope" value={opt.value} checked={scope === opt.value}
                  onChange={() => setScope(opt.value)} className="accent-[#1F4E79]" />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Row 6: Measurement mode (radio cards) */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelMeasurementMode')}</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {modeOptions.map((opt) => (
              <label key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  measurementMode === opt.value
                    ? 'border-[#1F4E79] bg-[#1F4E79]/5 dark:border-[#1F4E79] dark:bg-[#1F4E79]/10'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40'
                }`}>
                <input type="radio" name="measurementMode" value={opt.value} checked={measurementMode === opt.value}
                  onChange={() => setMeasurementMode(opt.value)} className="mt-0.5 accent-[#1F4E79]" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Row 7: Unit + Decimals + Target + Direction */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelUnit')}</label>
            <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
              placeholder="count, %, heads..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelDecimalPlaces')}</label>
            <input type="number" min={0} max={6} value={decimalPlaces}
              onChange={(e) => setDecimalPlaces(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelTargetValue')}</label>
            <input type="number" step="any" value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="e.g. 80"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          <div className="flex items-end gap-3 pb-1">
            <button type="button" onClick={() => setBetterIsHigher(!betterIsHigher)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${betterIsHigher ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${betterIsHigher ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {betterIsHigher ? t('labelBetterIsHigher') : t('labelBetterIsLower')}
            </span>
          </div>
        </div>

        {/* Row 8: Description FR / EN */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('labelDescriptionFr')} <span className="text-xs text-gray-400">{t('optional')}</span>
            </label>
            <textarea value={descriptionFr} onChange={(e) => setDescriptionFr(e.target.value)} onBlur={handleDescBlur} rows={3}
              placeholder="Description en francais..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('labelDescriptionEn')} <span className="text-xs text-gray-400">{t('optional')}</span>
            </label>
            <textarea value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} onBlur={handleDescBlur} rows={3}
              placeholder="English description..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
          <Link href="/settings/indicators"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            {t('cancel')}
          </Link>
          <button type="submit" disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F4E79]/90 disabled:opacity-50">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t('btnCreate')}
          </button>
        </div>
      </form>
    </div>
  );
}
