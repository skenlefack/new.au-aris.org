'use client';

/**
 * "Suivi des demandes" tab of the PANVAC kit campaign: every request with its stage, quantities at each
 * step, waiting time, and the action expected from the viewer (PANVAC decides and ships; the country
 * confirms reception). A row opens the detail: shipments and the full timeline.
 */
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown, ChevronRight, Download, ExternalLink, Plus, RefreshCw, Search, Trash2, Truck, CheckCircle2,
  PackageCheck, Clock, AlertTriangle, History, Ban,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import {
  useKitRequests, useKitDeleteShipment, useKitCancel,
  type KitRequest, type KitShipment, type KitStage,
} from '@/lib/api/workflow-hooks';
import { STAGES, STAGE_COLOR, countryName, fmtDate, toCsv, downloadCsv } from './kit-model';
import { DecisionDialog, ShipmentDialog, ReceptionDialog } from './KitDialogs';

type Dialog =
  | { kind: 'decide'; request: KitRequest }
  | { kind: 'ship'; request: KitRequest }
  | { kind: 'receive'; shipment: KitShipment };

export function StageBadge({ stage }: { stage: KitStage }) {
  const t = useTranslations('panvacKits');
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STAGE_COLOR[stage] }} aria-hidden />
      {t(`stage.${stage}`)}
    </span>
  );
}

const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString());

export default function KitRequestsTab({ campaignId, requestTemplateId, focusRequestId }: {
  campaignId: string; requestTemplateId?: string | null; focusRequestId?: string | null;
}) {
  const t = useTranslations('panvacKits');
  const locale = useLocaleStore((s) => s.locale);
  const q = useKitRequests(campaignId);
  const data = q.data;
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [open, setOpen] = useState<string | null>(focusRequestId ?? null);
  const [stage, setStage] = useState<KitStage | ''>('');
  const [search, setSearch] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const delShip = useKitDeleteShipment(campaignId);
  const cancel = useKitCancel(campaignId);

  useEffect(() => {
    if (!focusRequestId || !data) return;
    const r = data.requests.find((x) => x.id === focusRequestId);
    if (r?.isHistorical) setShowHistory(true);
    setOpen(focusRequestId);
    setTimeout(() => document.getElementById(`kit-${focusRequestId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
  }, [focusRequestId, data]);

  const cname = (code: string) => countryName(code, locale);
  const all = data?.requests ?? [];
  const sla = data?.viewer.slaDays ?? 15;
  const isPanvac = !!data?.viewer.isPanvac;

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((r) =>
      (showHistory || !r.isHistorical || r.metrics.stage === stage)
      && (!stage || r.metrics.stage === stage)
      && (!s || cname(r.countryCode).toLowerCase().includes(s) || r.countryCode.toLowerCase() === s
        || (r.requestedByName ?? '').toLowerCase().includes(s)));
  }, [all, stage, search, showHistory, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Partial<Record<KitStage, number>> = {};
    for (const r of all) c[r.metrics.stage] = (c[r.metrics.stage] ?? 0) + 1;
    return c;
  }, [all]);

  const myActions = useMemo(() => all.filter((r) =>
    (r.can.decide && r.status === 'SUBMITTED')
    || (r.can.ship && (r.metrics.stage === 'AWAITING_SHIPMENT' || r.metrics.stage === 'PARTIALLY_SHIPPED'))
    || (r.can.confirm && !isPanvac && r.shipments.some((s) => !s.receivedAt))).length, [all, isPanvac]);

  const exportCsv = () => {
    const rows: (string | number | null)[][] = [[
      t('col.country'), t('col.requestedAt'), t('col.product'), t('col.requested'), t('col.approved'), t('col.shipped'),
      t('col.received'), t('col.stage'), t('decisionDays'), t('availableFrom'), t('availableTo'), t('requester'), t('recipient'),
    ]];
    for (const r of visible) {
      rows.push([
        cname(r.countryCode), r.requestedAt.slice(0, 10), r.product ? t(`product.${r.product}`) : '', r.quantityRequested,
        r.quantityApproved, r.metrics.quantityShipped, r.metrics.quantityReceived, t(`stage.${r.metrics.stage}`),
        r.metrics.decisionDays, r.availableFrom, r.availableTo, r.requestedByName, r.recipientName,
      ]);
    }
    downloadCsv(`panvac-kit-requests-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  if (q.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (q.error) {
    return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{(q.error as Error).message}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Who am I and what is expected from me */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="text-sm text-gray-800 dark:text-gray-100">
          <p className="font-semibold">{isPanvac ? t('viewerPanvac') : t('viewerCountry')}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {myActions > 0 ? t('actionsWaiting', { n: myActions }) : t('noActionWaiting')} · {t('slaReminder', { days: sla })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {requestTemplateId && (
            <Link href={`/collecte/campaigns/${campaignId}/submit/${requestTemplateId}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> {t('newRequest')}
            </Link>
          )}
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button type="button" onClick={() => q.refetch()} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200" aria-label={t('refresh')}>
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stage chips */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setStage('')}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${stage === '' ? 'border-gray-800 bg-gray-800 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300'}`}>
          {t('allStages')} ({all.filter((r) => showHistory || !r.isHistorical).length})
        </button>
        {STAGES.filter((s) => counts[s]).map((s) => (
          <button key={s} type="button" onClick={() => setStage(stage === s ? '' : s)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${stage === s ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300'}`}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STAGE_COLOR[s] }} aria-hidden />
            {t(`stage.${s}`)} ({counts[s]})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPlaceholder')}
            className="h-9 w-full rounded-lg border border-gray-200 pl-8 pr-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          {t('showHistory')} ({counts.HISTORICAL ?? 0})
        </label>
      </div>

      {/* Requests */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2">{t('col.country')}</th>
              <th className="px-3 py-2">{t('col.requestedAt')}</th>
              <th className="px-3 py-2 text-right">{t('col.requested')}</th>
              <th className="px-3 py-2 text-right">{t('col.approved')}</th>
              <th className="px-3 py-2 text-right">{t('col.shipped')}</th>
              <th className="px-3 py-2 text-right">{t('col.received')}</th>
              <th className="px-3 py-2">{t('col.stage')}</th>
              <th className="px-3 py-2">{t('col.waiting')}</th>
              <th className="px-3 py-2">{t('col.availability')}</th>
              <th className="px-3 py-2 text-right">{t('col.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {visible.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-10 text-center text-sm italic text-gray-400">{t('noRequests')}</td></tr>
            )}
            {visible.map((r) => {
              const isOpen = open === r.id;
              const m = r.metrics;
              const overdue = m.stage === 'PENDING_DECISION' && (m.waitingDays ?? 0) > sla;
              const openShipment = r.shipments.find((s) => !s.receivedAt);
              return (
                <React.Fragment key={r.id}>
                  <tr id={`kit-${r.id}`} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 ${isOpen ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`} onClick={() => setOpen(isOpen ? null : r.id)}>
                    <td className="px-2 py-2 text-gray-400">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{cname(r.countryCode)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{r.product ? t(`product.${r.product}`) : '—'}{r.kitFormat ? ` · ${r.kitFormat}` : ''}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-300">{fmtDate(r.requestedAt, locale)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(r.quantityRequested)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.isHistorical ? '—' : num(r.quantityApproved)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(m.quantityShipped)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.isHistorical ? '—' : num(m.quantityReceived)}</td>
                    <td className="px-3 py-2"><StageBadge stage={m.stage} /></td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {m.waitingDays !== null ? (
                        <span className={`inline-flex items-center gap-1 text-xs ${overdue ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>
                          {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          {t('days', { n: m.waitingDays })}
                        </span>
                      ) : m.decisionDays !== null ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{t('decidedIn', { n: m.decisionDays })}</span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                      {r.availableFrom ? `${fmtDate(r.availableFrom, locale)} → ${fmtDate(r.availableTo, locale)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        {r.can.decide && (
                          <button type="button" onClick={() => setDialog({ kind: 'decide', request: r })}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${r.status === 'SUBMITTED' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200'}`}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> {r.status === 'SUBMITTED' ? t('decide') : t('reviseDecision')}
                          </button>
                        )}
                        {r.can.ship && (
                          <button type="button" onClick={() => setDialog({ kind: 'ship', request: r })}
                            className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-700">
                            <Truck className="h-3.5 w-3.5" /> {t('ship')}
                          </button>
                        )}
                        {r.can.confirm && openShipment && (
                          <button type="button" onClick={() => setDialog({ kind: 'receive', shipment: openShipment })}
                            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700">
                            <PackageCheck className="h-3.5 w-3.5" /> {t('confirmReception')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-gray-50/60 dark:bg-gray-900/60">
                      <td colSpan={11} className="px-6 py-4">
                        <RequestDetail
                          request={r}
                          locale={locale}
                          onReceive={(s) => setDialog({ kind: 'receive', shipment: s })}
                          onDeleteShipment={(s) => { if (window.confirm(t('deleteShipmentConfirm'))) delShip.mutate(s.id); }}
                          onCancel={() => { if (window.confirm(t('cancelConfirm'))) cancel.mutate({ id: r.id }); }}
                          isPanvac={isPanvac}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {showHistory && (data?.orphanShipments.length ?? 0) > 0 && (
        <OrphanShipments shipments={data!.orphanShipments} locale={locale} />
      )}

      {dialog?.kind === 'decide' && <DecisionDialog campaignId={campaignId} request={dialog.request} country={cname(dialog.request.countryCode)} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'ship' && <ShipmentDialog campaignId={campaignId} request={dialog.request} country={cname(dialog.request.countryCode)} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'receive' && <ReceptionDialog campaignId={campaignId} shipment={dialog.shipment} onClose={() => setDialog(null)} />}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">{value ?? '—'}</dd>
    </div>
  );
}

function RequestDetail({ request: r, locale, onReceive, onDeleteShipment, onCancel, isPanvac }: {
  request: KitRequest; locale: string; isPanvac: boolean;
  onReceive: (s: KitShipment) => void; onDeleteShipment: (s: KitShipment) => void; onCancel: () => void;
}) {
  const t = useTranslations('panvacKits');
  const m = r.metrics;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Info label={t('requester')} value={r.requestedByName} />
          <Info label={t('recipient')} value={r.recipientName} />
          <Info label={t('desiredDate')} value={fmtDate(r.desiredDate, locale)} />
          <Info label={t('decidedBy')} value={r.decidedByName ? `${r.decidedByName} · ${fmtDate(r.decidedAt, locale)}` : null} />
          <Info label={t('gapRequestedApproved')} value={m.gapRequestedApproved ?? '—'} />
          <Info label={t('gapApprovedShipped')} value={m.gapApprovedShipped ?? '—'} />
          <Info label={t('shipmentDays')} value={m.shipmentDays !== null ? t('days', { n: m.shipmentDays }) : '—'} />
          <Info label={t('totalDays')} value={m.totalDays !== null ? t('days', { n: m.totalDays }) : '—'} />
        </dl>
        {r.decisionComment && (
          <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <span className="font-medium">{t('panvacComment')} : </span>{r.decisionComment}
          </p>
        )}

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('shipments')} ({r.shipments.length})</h4>
          {r.shipments.length === 0 ? <p className="text-sm italic text-gray-400">{t('noShipment')}</p> : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
              {r.shipments.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-gray-100">
                      <Truck className="mr-1 inline h-3.5 w-3.5 text-gray-400" />
                      {fmtDate(s.shippedAt, locale)} · {s.quantity} {t('kits')}{s.kitFormat ? ` ${s.kitFormat}` : ''}
                      {s.numSamples ? ` · ${s.numSamples.toLocaleString()} ${t('samples')}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {[s.waybill && `${t('waybill')} ${s.waybill}`, s.carrier, s.lotNumber && `${t('lotNumber')} ${s.lotNumber}`, s.expiryDate && `${t('expiryDate')} ${fmtDate(s.expiryDate, locale)}`].filter(Boolean).join(' · ') || (s.isHistorical ? t('historyRecord') : '')}
                    </p>
                    {s.receivedAt ? (
                      <p className="text-xs text-green-700 dark:text-green-400">
                        <PackageCheck className="mr-1 inline h-3.5 w-3.5" />
                        {t('receivedOn', { date: fmtDate(s.receivedAt, locale), qty: s.quantityReceived ?? s.quantity })} · {t(`condition${s.condition ?? 'GOOD'}`)}
                        {s.receivedByName ? ` · ${s.receivedByName}` : ''}{s.receptionComment ? ` — ${s.receptionComment}` : ''}
                      </p>
                    ) : !s.isHistorical && <p className="text-xs text-amber-600 dark:text-amber-400">{t('awaitingReception')}</p>}
                  </div>
                  {!s.receivedAt && !s.isHistorical && (
                    <div className="flex gap-1.5">
                      {r.can.confirm && (
                        <button type="button" onClick={() => onReceive(s)} className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700">
                          <PackageCheck className="h-3.5 w-3.5" /> {t('confirmReception')}
                        </button>
                      )}
                      {isPanvac && (
                        <button type="button" onClick={() => onDeleteShipment(s)} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title={t('deleteShipment')}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {r.submissionId && (
            <Link href={`/collecte/submissions/${r.submissionId}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
              {t('openForm')} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
          {r.can.cancel && (
            <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700">
              <Ban className="h-3.5 w-3.5" /> {t('withdraw')}
            </button>
          )}
        </div>
      </div>

      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <History className="h-3.5 w-3.5" /> {t('timeline')}
        </h4>
        {r.events.length === 0 ? <p className="text-sm italic text-gray-400">{r.isHistorical ? t('historyRecord') : '—'}</p> : (
          <ol className="relative space-y-3 border-l border-gray-200 pl-4 dark:border-gray-700">
            {r.events.map((e, i) => (
              <li key={i} className="text-sm">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-500 dark:border-gray-900" aria-hidden />
                <p className="font-medium text-gray-900 dark:text-gray-100">{t(`event.${e.action}`)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(e.at, locale)}{e.actorName ? ` · ${e.actorName}` : ''}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function OrphanShipments({ shipments, locale }: { shipments: KitShipment[]; locale: string }) {
  const t = useTranslations('panvacKits');
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('orphanTitle', { n: shipments.length })}</h4>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{t('orphanHint')}</p>
      <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {shipments.map((s) => (
          <li key={s.id} className="text-gray-700 dark:text-gray-300">
            {countryName(s.countryCode, locale)} — {fmtDate(s.shippedAt, locale)} · {s.quantity} {t('kits')}{s.kitFormat ? ` ${s.kitFormat}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
