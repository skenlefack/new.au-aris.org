'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Info,
  Eye,
  XCircle,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Zap,
  Settings2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useFlashAlerts,
  useDismissFlashAlert,
  useFlashStrategies,
  useCreateFlashStrategy,
  useUpdateFlashStrategy,
  useDeleteFlashStrategy,
  type FlashAlert,
  type FlashStrategy,
} from '@/lib/api/report-hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SEVERITY_BADGE: Record<string, { color: string; icon: React.ReactNode }> = {
  CRITICAL: { color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="h-3 w-3" /> },
  WARNING: { color: 'bg-amber-100 text-amber-700', icon: <AlertCircle className="h-3 w-3" /> },
  INFO: { color: 'bg-blue-100 text-blue-700', icon: <Info className="h-3 w-3" /> },
};

const CONDITION_LABELS: Record<string, string> = {
  THRESHOLD_ABOVE: 'Above threshold',
  THRESHOLD_BELOW: 'Below threshold',
  PERCENT_CHANGE: '% change',
  ANOMALY: 'Anomaly detected',
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function FlashConsolePage() {
  const t = useTranslations('reports');
  const locale = useLocaleStore((s) => s.locale);

  const [activeTab, setActiveTab] = useState<'alerts' | 'strategies'>('alerts');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToReports')}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <Zap className="h-6 w-6 text-[#C9A227]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('flashConsole')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('flashConsoleDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-1">
          <button
            onClick={() => setActiveTab('alerts')}
            className={cn(
              'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === 'alerts'
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
            )}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {t('flashAlerts')}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('strategies')}
            className={cn(
              'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === 'strategies'
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
            )}
          >
            <span className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t('flashStrategies')}
            </span>
          </button>
        </nav>
      </div>

      {activeTab === 'alerts' ? <AlertsTab t={t} locale={locale} /> : <StrategiesTab t={t} locale={locale} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Alerts tab                                                         */
/* ------------------------------------------------------------------ */

function AlertsTab({ t, locale }: { t: (k: string, p?: Record<string, string | number>) => string; locale: string }) {
  const { data, isLoading } = useFlashAlerts();
  const dismissMutation = useDismissFlashAlert();

  const alerts: FlashAlert[] = (data as any)?.data ?? [];

  if (isLoading) return <TableSkeleton rows={5} cols={7} />;

  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-300" />
        <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
          {t('noAlerts')}
        </p>
        <p className="mt-1 text-sm text-gray-500">{t('noAlertsDesc')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700 dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
              <th className="px-4 py-3 text-left font-medium text-gray-500">{t('colSeverity')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">{t('colCode')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">{t('colSource')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">{t('colCountry')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">{t('colTimestamp')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">{t('colStatus')}</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {alerts.map((alert) => {
              const sevCfg = SEVERITY_BADGE[alert.severity] ?? SEVERITY_BADGE.INFO;
              return (
                <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', sevCfg.color)}>
                      {sevCfg.icon}
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                    {alert.code}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {alert.source}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {alert.countryCode ?? '--'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(alert.createdAt).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB')}
                  </td>
                  <td className="px-4 py-3">
                    {alert.dismissed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        {t('dismissed')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600 font-medium">
                        {t('active')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {alert.reportId && (
                        <Link
                          href={`/reports/${alert.reportId}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
                        >
                          <Eye className="h-3 w-3" />
                          {t('viewReport')}
                        </Link>
                      )}
                      {!alert.dismissed && (
                        <button
                          onClick={() => dismissMutation.mutate(alert.id)}
                          disabled={dismissMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400"
                        >
                          <XCircle className="h-3 w-3" />
                          {t('dismiss')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Strategies tab                                                     */
/* ------------------------------------------------------------------ */

function StrategiesTab({ t, locale }: { t: (k: string, p?: Record<string, string | number>) => string; locale: string }) {
  const { data, isLoading } = useFlashStrategies();
  const deleteMutation = useDeleteFlashStrategy();
  const createMutation = useCreateFlashStrategy();
  const updateMutation = useUpdateFlashStrategy();

  const [showModal, setShowModal] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<FlashStrategy | null>(null);

  const strategies: FlashStrategy[] = (data as any)?.data ?? [];

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formNameFr, setFormNameFr] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formIndicator, setFormIndicator] = useState('');
  const [formCondition, setFormCondition] = useState<string>('THRESHOLD_ABOVE');
  const [formValue, setFormValue] = useState('');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formCooldown, setFormCooldown] = useState('60');
  const [formActive, setFormActive] = useState(true);

  function openCreate() {
    setEditingStrategy(null);
    setFormCode('');
    setFormNameFr('');
    setFormNameEn('');
    setFormIndicator('');
    setFormCondition('THRESHOLD_ABOVE');
    setFormValue('');
    setFormTemplateId('');
    setFormCooldown('60');
    setFormActive(true);
    setShowModal(true);
  }

  function openEdit(s: FlashStrategy) {
    setEditingStrategy(s);
    setFormCode(s.code);
    setFormNameFr(s.nameFr);
    setFormNameEn(s.nameEn);
    setFormIndicator(s.indicatorCode);
    setFormCondition(s.conditionType);
    setFormValue(String(s.conditionValue));
    setFormTemplateId(s.templateId);
    setFormCooldown(String(s.cooldownMinutes));
    setFormActive(s.active);
    setShowModal(true);
  }

  function handleSubmit() {
    const body: Record<string, unknown> = {
      code: formCode,
      nameFr: formNameFr,
      nameEn: formNameEn,
      indicatorCode: formIndicator,
      conditionType: formCondition,
      conditionValue: Number(formValue),
      templateId: formTemplateId,
      cooldownMinutes: Number(formCooldown),
      active: formActive,
    };

    if (editingStrategy) {
      updateMutation.mutate(
        { id: editingStrategy.id, ...body },
        { onSuccess: () => setShowModal(false) },
      );
    } else {
      createMutation.mutate(body, { onSuccess: () => setShowModal(false) });
    }
  }

  if (isLoading) return <TableSkeleton rows={4} cols={6} />;

  return (
    <div>
      {/* Add button */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a4268]"
        >
          <Plus className="h-4 w-4" />
          {t('addStrategy')}
        </button>
      </div>

      {strategies.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <Settings2 className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
            {t('noStrategies')}
          </p>
          <p className="mt-1 text-sm text-gray-500">{t('noStrategiesDesc')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('colCode')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('colName')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('colIndicator')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('colCondition')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('colStatus')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {strategies.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {s.code}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {locale === 'fr' ? s.nameFr : s.nameEn}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {s.indicatorCode}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                      {CONDITION_LABELS[s.conditionType] ?? s.conditionType} ({s.conditionValue})
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
                      )}>
                        {s.active ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(s)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(t('confirmDeleteStrategy'))) {
                              deleteMutation.mutate(s.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
              {editingStrategy ? t('editStrategy') : t('addStrategy')}
            </h3>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {!editingStrategy && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Code *</label>
                  <input type="text" value={formCode} onChange={(e) => setFormCode(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F4E79] focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('titleFr')} *</label>
                  <input type="text" value={formNameFr} onChange={(e) => setFormNameFr(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F4E79] focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('titleEn')} *</label>
                  <input type="text" value={formNameEn} onChange={(e) => setFormNameEn(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F4E79] focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('colIndicator')} *</label>
                <input type="text" value={formIndicator} onChange={(e) => setFormIndicator(e.target.value)} placeholder="e.g. outbreak_count"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F4E79] focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('colCondition')} *</label>
                  <select value={formCondition} onChange={(e) => setFormCondition(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F4E79] focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option value="THRESHOLD_ABOVE">Above threshold</option>
                    <option value="THRESHOLD_BELOW">Below threshold</option>
                    <option value="PERCENT_CHANGE">% change</option>
                    <option value="ANOMALY">Anomaly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('conditionValue')} *</label>
                  <input type="number" value={formValue} onChange={(e) => setFormValue(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F4E79] focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Template ID *</label>
                <input type="text" value={formTemplateId} onChange={(e) => setFormTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F4E79] focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('cooldown')} (min)</label>
                  <input type="number" value={formCooldown} onChange={(e) => setFormCooldown(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F4E79] focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-[#1F4E79] focus:ring-[#1F4E79]" />
                    {t('active')}
                  </label>
                </div>
              </div>
            </div>

            {(createMutation.isError || updateMutation.isError) && (
              <p className="mt-3 text-sm text-red-600">
                {(createMutation.error ?? updateMutation.error) instanceof Error
                  ? ((createMutation.error ?? updateMutation.error) as Error).message
                  : t('strategyError')}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
              >
                {t('cancelEdit')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a4268] disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingStrategy ? t('save') : t('create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
