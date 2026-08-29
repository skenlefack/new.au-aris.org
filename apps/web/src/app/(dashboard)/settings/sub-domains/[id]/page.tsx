'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';
import {
  useAdminSubDomain,
  useUpdateSubDomain,
  useDeleteSubDomain,
  useAllDomains,
  useAllValueChainCodes,
} from '@/lib/api/sub-domain-hooks';
import type { SubDomainType } from '@/lib/stores/domain-store';
import { ForbiddenPage } from '@/components/ui/ForbiddenPage';
import { IconPicker, ICON_MAP } from '@/components/ui/IconPicker';
import { useTranslations } from '@/lib/i18n/translations';
import {
  Loader2,
  ArrowLeft,
  Check,
  Pencil,
  Trash2,
  AlertTriangle,
  Power,
  PowerOff,
  Info,
  Circle,
} from 'lucide-react';
import { useAutoTranslateOnBlur } from '@/components/settings/AutoTranslateGroup';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN']);

export default function SubDomainDetailPage() {
  const user = useAuthStore((s) => s.user);
  if (!user || !ADMIN_ROLES.has(user.role)) return <ForbiddenPage />;
  return <SubDomainDetail />;
}

function SubDomainDetail() {
  const t = useTranslations('settings');
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const addToast = useRealtimeStore((s) => s.addToast);

  const { data, isLoading, error } = useAdminSubDomain(id);
  const { data: domainsData } = useAllDomains();
  const { data: vcData } = useAllValueChainCodes();
  const updateMutation = useUpdateSubDomain();
  const deleteMutation = useDeleteSubDomain();

  const domains = domainsData?.data ?? [];
  const valueChainCodes = vcData?.data ?? [];
  const sd = data?.data;

  const [editing, setEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form state
  const [labelFr, setLabelFr] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [labelPt, setLabelPt] = useState('');
  const [labelEs, setLabelEs] = useState('');
  const [labelSw, setLabelSw] = useState('');
  const [typeEnum, setTypeEnum] = useState<SubDomainType>('VALUE_CHAIN');
  const [valueChainCode, setValueChainCode] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Circle');
  const [color, setColor] = useState('#1F4E79');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { handleBlur } = useAutoTranslateOnBlur(
    { en: labelEn, fr: labelFr, pt: labelPt, ar: labelAr, es: labelEs, sw: labelSw },
    { en: (v) => setLabelEn(v), fr: (v) => setLabelFr(v), pt: (v) => setLabelPt(v), ar: (v) => setLabelAr(v) },
  );

  const typeOptions: { value: SubDomainType; label: string; desc: string }[] = [
    { value: 'VALUE_CHAIN',    label: t('typeValueChain'),    desc: t('typeValueChainDesc') },
    { value: 'ORGANIZATIONAL', label: t('typeOrganizational'), desc: t('typeOrganizationalDesc') },
    { value: 'PATHOLOGY',      label: t('typePathology'),      desc: t('typePathologyDesc') },
    { value: 'OTHER',          label: t('typeOther'),          desc: t('typeOtherDesc') },
  ];

  const typeBadges: Record<SubDomainType, { bg: string; text: string; label: string }> = {
    VALUE_CHAIN:    { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: t('typeValueChain') },
    ORGANIZATIONAL: { bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-400',       label: t('typeOrganizational') },
    PATHOLOGY:      { bg: 'bg-red-100 dark:bg-red-900/30',        text: 'text-red-700 dark:text-red-400',         label: t('typePathology') },
    OTHER:          { bg: 'bg-gray-100 dark:bg-gray-700',         text: 'text-gray-600 dark:text-gray-400',       label: t('typeOther') },
  };

  useEffect(() => {
    if (sd) {
      setLabelFr(sd.labelFr);
      setLabelEn(sd.labelEn);
      setLabelAr(sd.labelAr ?? '');
      setLabelPt(sd.labelPt ?? '');
      setTypeEnum(sd.typeEnum);
      setValueChainCode(sd.valueChainCode ?? '');
      setDisplayOrder(sd.displayOrder);
      setDescription(sd.description ?? '');
      setIcon(sd.icon ?? 'Circle');
      setColor(sd.color ?? '#1F4E79');
    }
  }, [sd]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!labelFr.trim()) e.labelFr = t('subDomainLabelFrRequired');
    if (!labelEn.trim()) e.labelEn = t('subDomainLabelEnRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      await updateMutation.mutateAsync({
        id, labelFr: labelFr.trim(), labelEn: labelEn.trim(),
        labelAr: labelAr.trim() || null, labelPt: labelPt.trim() || null,
        labelEs: labelEs.trim() || null,
        labelSw: labelSw.trim() || null,
        typeEnum, valueChainCode: typeEnum === 'VALUE_CHAIN' && valueChainCode ? valueChainCode : null,
        displayOrder, description: description.trim() || null,
        icon: icon || null, color: color || null,
      });
      addToast({ type: 'success', title: t('subDomainUpdated'), message: t('subDomainUpdatedMsg').replace('{code}', sd?.code ?? '') });
      setEditing(false);
    } catch (err: any) {
      addToast({ type: 'error', title: t('error'), message: err?.message || t('subDomainUpdateError') });
    }
  };

  const handleToggleActive = async () => {
    if (!sd) return;
    try {
      await updateMutation.mutateAsync({ id, active: !sd.active });
      addToast({
        type: 'success',
        title: sd.active ? t('subDomainDeactivated') : t('subDomainActivated'),
        message: sd.active
          ? t('deactivatedMsg').replace('{code}', sd.code)
          : t('activatedMsg').replace('{code}', sd.code),
      });
    } catch {
      addToast({ type: 'error', title: t('error'), message: t('subDomainStatusError') });
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(id);
      addToast({ type: 'success', title: t('subDomainDeleted'), message: t('subDomainDeletedMsg') });
      router.push('/settings/sub-domains');
    } catch (err: any) {
      if (err?.statusCode === 409) {
        setDeleteError(err.message || t('subDomainUsedByEntities'));
      } else {
        addToast({ type: 'error', title: t('error'), message: t('subDomainDeleteError') });
        setShowDeleteModal(false);
      }
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  if (error || !sd) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">{t('subDomainNotFound')}</p>
        <Link href="/settings/sub-domains" className="mt-4 inline-block text-sm text-[#1F4E79] hover:underline">
          {t('backToList')}
        </Link>
      </div>
    );
  }

  const badge = typeBadges[sd.typeEnum] ?? typeBadges.OTHER;
  const parentDomain = domains.find((d) => d.code === sd.domainCode);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings/sub-domains"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{sd.code}</h1>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.bg} ${badge.text}`}>{badge.label}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                sd.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>{sd.active ? t('statusActive') : t('statusInactive')}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{sd.labelFr} &mdash; {parentDomain?.name?.en ?? sd.domainCode}</p>
          </div>
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
              <Pencil className="h-3.5 w-3.5" /> {t('btnEdit')}
            </button>
            <button type="button" onClick={handleToggleActive} disabled={updateMutation.isPending}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                sd.active ? 'border border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400' : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400'
              }`}>
              {sd.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
              {sd.active ? t('deactivateAction') : t('activateAction')}
            </button>
            <button type="button" onClick={() => { setShowDeleteModal(true); setDeleteError(null); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400">
              <Trash2 className="h-3.5 w-3.5" /> {t('delete')}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {editing ? (
          <div className="space-y-6 p-6">
            {/* Info banner */}
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
              <Info className="h-4 w-4 shrink-0" />
              {t('codeAndDomainReadOnly').replace('{code}', sd.code)}
            </div>

            {/* Type + Value Chain + Order (3 cols) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelTypeEnum')}</label>
                <select value={typeEnum} onChange={(e) => { setTypeEnum(e.target.value as SubDomainType); if (e.target.value !== 'VALUE_CHAIN') setValueChainCode(''); }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                  {typeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelValueChainCode')}</label>
                <select value={valueChainCode} onChange={(e) => setValueChainCode(e.target.value)} disabled={typeEnum !== 'VALUE_CHAIN'}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                  <option value="">{t('noValueChain')}</option>
                  {valueChainCodes.map((vc) => <option key={vc.code} value={vc.code}>{vc.labelFr || vc.labelEn} ({vc.code})</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelDisplayOrderField')}</label>
                <input type="number" min={0} value={displayOrder} onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              </div>
            </div>

            {/* Labels (4 cols) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelLabelFr')} *</label>
                <input type="text" value={labelFr} onChange={(e) => setLabelFr(e.target.value)} onBlur={handleBlur}
                  className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-900 dark:text-white ${errors.labelFr ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-[#1F4E79] focus:ring-[#1F4E79] dark:border-gray-700'}`} />
                {errors.labelFr && <p className="text-xs text-red-600">{errors.labelFr}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelLabelEn')} *</label>
                <input type="text" value={labelEn} onChange={(e) => setLabelEn(e.target.value)} onBlur={handleBlur}
                  className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-900 dark:text-white ${errors.labelEn ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-[#1F4E79] focus:ring-[#1F4E79] dark:border-gray-700'}`} />
                {errors.labelEn && <p className="text-xs text-red-600">{errors.labelEn}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelLabelAr')}</label>
                <input type="text" value={labelAr} onChange={(e) => setLabelAr(e.target.value)} onBlur={handleBlur} dir="rtl"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelLabelPt')}</label>
                <input type="text" value={labelPt} onChange={(e) => setLabelPt(e.target.value)} onBlur={handleBlur}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelDescription')}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </div>

            {/* Icon + Color */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelIcon')}</label>
                <button type="button" onClick={() => setIconPickerOpen(true)}
                  className="inline-flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700">
                  {React.createElement(ICON_MAP[icon] ?? Circle, { className: 'h-5 w-5', style: { color } })}
                  <span className="text-gray-700 dark:text-gray-300">{icon}</span>
                  <span className="text-xs text-[#1F4E79]">{t('btnChangeIcon')}</span>
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labelColorField')}</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900" />
                  <input type="text" value={color} onChange={(e) => setColor(e.target.value)}
                    placeholder="#1F4E79" maxLength={20}
                    className="w-32 rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
              <button type="button" onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                {t('cancel')}
              </button>
              <button type="button" onClick={handleSave} disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F4E79]/90 disabled:opacity-50">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t('btnSave')}
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            <DetailRow label={t('detailCode')} value={sd.code} mono />
            <DetailRow label={t('detailParentDomain')} value={parentDomain?.name?.en ?? sd.domainCode} />
            <DetailRow label={t('detailType')}>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.bg} ${badge.text}`}>{badge.label}</span>
            </DetailRow>
            {sd.valueChainCode && (
              <DetailRow label={t('detailValueChain')}>
                <span className="inline-flex rounded-full bg-[#C9A227]/10 px-2 py-0.5 text-[11px] font-semibold text-[#C9A227]">{sd.valueChainCode}</span>
              </DetailRow>
            )}
            <DetailRow label={t('detailLabelFr')} value={sd.labelFr} />
            <DetailRow label={t('detailLabelEn')} value={sd.labelEn} />
            {sd.labelAr && <DetailRow label={t('detailLabelAr')} value={sd.labelAr} dir="rtl" />}
            {sd.labelPt && <DetailRow label={t('detailLabelPt')} value={sd.labelPt} />}
            <DetailRow label={t('detailDisplayOrder')} value={String(sd.displayOrder)} />
            <DetailRow label={t('detailStatus')}>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                sd.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>{sd.active ? t('statusActive') : t('statusInactive')}</span>
            </DetailRow>
            {sd.icon && (
              <DetailRow label={t('detailIcon')}>
                <div className="flex items-center gap-2">
                  {React.createElement(ICON_MAP[sd.icon] ?? Circle, { className: 'h-5 w-5', style: { color: sd.color ?? '#1F4E79' } })}
                  <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm text-gray-900 dark:bg-gray-700 dark:text-white">{sd.icon}</span>
                </div>
              </DetailRow>
            )}
            {sd.color && (
              <DetailRow label={t('detailColor')}>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-5 w-5 rounded-full border border-gray-200 dark:border-gray-600" style={{ backgroundColor: sd.color }} />
                  <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm text-gray-900 dark:bg-gray-700 dark:text-white">{sd.color}</span>
                </div>
              </DetailRow>
            )}
            {sd.description && <DetailRow label={t('detailDescription')} value={sd.description} />}
          </div>
        )}
      </div>

      <IconPicker open={iconPickerOpen} value={icon} onSelect={setIcon} onClose={() => setIconPickerOpen(false)} />

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('deleteSubDomain')}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('deleteSubDomainConfirm')
                    .replace('{code}', sd.code)
                    .replace('{label}', sd.labelFr)}
                </p>
                {deleteError && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{deleteError}</div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowDeleteModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                {t('cancel')}
              </button>
              <button type="button" onClick={handleDelete} disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono, dir, children }: {
  label: string; value?: string; mono?: boolean; dir?: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 px-6 py-3">
      <span className="w-40 shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex-1">
        {children ?? (
          <span className={`text-sm text-gray-900 dark:text-white ${mono ? 'rounded bg-gray-100 px-2 py-0.5 font-mono dark:bg-gray-700' : ''}`} dir={dir}>{value}</span>
        )}
      </div>
    </div>
  );
}
