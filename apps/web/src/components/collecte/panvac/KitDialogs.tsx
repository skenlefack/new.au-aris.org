'use client';

/**
 * Action dialogs of the PANVAC kit circuit:
 * - DecisionDialog  (PANVAC): approve a quantity + availability period, or reject with a reason
 * - ShipmentDialog  (PANVAC): record a shipment of an approved request
 * - ReceptionDialog (country): confirm what arrived, when, and in which condition
 */
import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, Truck, PackageCheck } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import {
  useKitDecision, useKitShipment, useKitReception,
  type KitRequest, type KitShipment,
} from '@/lib/api/workflow-hooks';
import { today } from './kit-model';

const INPUT = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-blue-900';
const SAMPLES: Record<string, number> = { F10: 880, F20: 1760 };

function Modal({ title, subtitle, icon, onClose, children, footer }: {
  title: string; subtitle?: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">{icon}</span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800" aria-label="close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">{footer}</div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
    </label>
  );
}

function Buttons({ onClose, onSubmit, disabled, busy, label, tone = 'primary' }: {
  onClose: () => void; onSubmit: () => void; disabled: boolean; busy: boolean; label: string; tone?: 'primary' | 'danger';
}) {
  const t = useTranslations('panvacKits');
  return (
    <>
      <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
        {t('cancel')}
      </button>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onSubmit}
        className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {busy ? t('saving') : label}
      </button>
    </>
  );
}

function ErrorLine({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error instanceof Error ? error.message : String(error)}</p>;
}

/* ── PANVAC decision ── */

export function DecisionDialog({ campaignId, request, country, onClose }: {
  campaignId: string; request: KitRequest; country: string; onClose: () => void;
}) {
  const t = useTranslations('panvacKits');
  const m = useKitDecision(campaignId);
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>(request.status === 'REJECTED' ? 'REJECT' : 'APPROVE');
  const [qty, setQty] = useState<string>(String(request.quantityApproved ?? request.quantityRequested ?? ''));
  const [from, setFrom] = useState(request.availableFrom ?? today());
  const [to, setTo] = useState(request.availableTo ?? request.desiredDate ?? '');
  const [comment, setComment] = useState(request.decisionComment ?? '');

  const n = Number(qty);
  const approveOk = Number.isInteger(n) && n >= 1 && !!from && !!to && to >= from;
  const rejectOk = comment.trim().length >= 5;
  const gap = request.quantityRequested !== null && approveOk ? request.quantityRequested - n : null;

  const submit = () => m.mutate(
    decision === 'APPROVE'
      ? { id: request.id, decision, quantityApproved: n, availableFrom: from, availableTo: to, comment: comment.trim() || undefined }
      : { id: request.id, decision, comment: comment.trim() },
    { onSuccess: onClose },
  );

  return (
    <Modal
      title={t('decisionTitle')}
      subtitle={t('decisionSubtitle', { country, qty: request.quantityRequested ?? '?' })}
      icon={<CheckCircle2 className="h-5 w-5 text-blue-600" />}
      onClose={onClose}
      footer={<Buttons onClose={onClose} onSubmit={submit} busy={m.isPending} disabled={decision === 'APPROVE' ? !approveOk : !rejectOk}
        label={decision === 'APPROVE' ? t('approve') : t('reject')} tone={decision === 'APPROVE' ? 'primary' : 'danger'} />}
    >
      <div className="grid grid-cols-2 gap-2">
        {(['APPROVE', 'REJECT'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDecision(d)}
            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${decision === d
              ? d === 'APPROVE' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'}`}
          >
            {d === 'APPROVE' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {d === 'APPROVE' ? t('approve') : t('reject')}
          </button>
        ))}
      </div>

      {decision === 'APPROVE' && (
        <>
          <Field label={t('quantityApproved')} hint={gap !== null && gap > 0 ? t('partialHint', { gap }) : undefined}>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className={INPUT} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('availableFrom')}>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={INPUT} />
            </Field>
            <Field label={t('availableTo')}>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={INPUT} />
            </Field>
          </div>
          {request.desiredDate && <p className="text-xs text-gray-500 dark:text-gray-400">{t('desiredDateHint', { date: request.desiredDate })}</p>}
        </>
      )}

      <Field label={decision === 'APPROVE' ? t('commentOptional') : t('rejectReason')} hint={decision === 'REJECT' ? t('rejectHint') : undefined}>
        <textarea rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} className={INPUT} />
      </Field>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('decisionNotified')}</p>
      <ErrorLine error={m.error} />
    </Modal>
  );
}

/* ── PANVAC shipment ── */

export function ShipmentDialog({ campaignId, request, country, onClose }: {
  campaignId: string; request: KitRequest; country: string; onClose: () => void;
}) {
  const t = useTranslations('panvacKits');
  const m = useKitShipment(campaignId);
  const remaining = Math.max(0, (request.quantityApproved ?? 0) - request.metrics.quantityShipped);
  const [shippedAt, setShippedAt] = useState(today());
  const [qty, setQty] = useState(String(remaining || ''));
  const [format, setFormat] = useState(request.kitFormat ?? (request.product === 'hppr_belisa' ? 'F20' : ''));
  const [lot, setLot] = useState('');
  const [expiry, setExpiry] = useState('');
  const [waybill, setWaybill] = useState('');
  const [carrier, setCarrier] = useState('');
  const [comment, setComment] = useState('');
  const n = Number(qty);
  const ok = Number.isInteger(n) && n >= 1 && !!shippedAt;
  const samples = SAMPLES[format] ? SAMPLES[format] * (ok ? n : 0) : null;

  const submit = () => m.mutate({
    requestId: request.id, shippedAt, quantity: n, kitFormat: format || undefined,
    lotNumber: lot || undefined, expiryDate: expiry || undefined, waybill: waybill || undefined,
    carrier: carrier || undefined, comment: comment || undefined,
  }, { onSuccess: onClose });

  return (
    <Modal
      title={t('shipmentTitle')}
      subtitle={t('shipmentSubtitle', { country, approved: request.quantityApproved ?? 0, shipped: request.metrics.quantityShipped })}
      icon={<Truck className="h-5 w-5 text-blue-600" />}
      onClose={onClose}
      footer={<Buttons onClose={onClose} onSubmit={submit} busy={m.isPending} disabled={!ok} label={t('recordShipment')} />}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('shippedAt')}>
          <input type="date" value={shippedAt} max={today()} onChange={(e) => setShippedAt(e.target.value)} className={INPUT} />
        </Field>
        <Field label={t('quantity')} hint={n > remaining && remaining > 0 ? t('moreThanApproved', { remaining }) : undefined}>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className={INPUT} />
        </Field>
        <Field label={t('kitFormat')} hint={samples ? t('samplesHint', { n: samples }) : undefined}>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className={INPUT}>
            <option value="">—</option>
            <option value="F10">F10 (880)</option>
            <option value="F20">F20 (1760)</option>
          </select>
        </Field>
        <Field label={t('waybill')}>
          <input value={waybill} maxLength={100} onChange={(e) => setWaybill(e.target.value)} className={INPUT} />
        </Field>
        <Field label={t('lotNumber')}>
          <input value={lot} maxLength={100} onChange={(e) => setLot(e.target.value)} className={INPUT} />
        </Field>
        <Field label={t('expiryDate')}>
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <Field label={t('carrier')}>
        <input value={carrier} maxLength={100} onChange={(e) => setCarrier(e.target.value)} className={INPUT} />
      </Field>
      <Field label={t('commentOptional')}>
        <textarea rows={2} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} className={INPUT} />
      </Field>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('shipmentNotified', { name: request.recipientName ?? request.requestedByName ?? '—' })}</p>
      <ErrorLine error={m.error} />
    </Modal>
  );
}

/* ── Country reception ── */

export function ReceptionDialog({ campaignId, shipment, onClose }: {
  campaignId: string; shipment: KitShipment; onClose: () => void;
}) {
  const t = useTranslations('panvacKits');
  const m = useKitReception(campaignId);
  const [receivedAt, setReceivedAt] = useState(today());
  const [qty, setQty] = useState(String(shipment.quantity));
  const [condition, setCondition] = useState<'GOOD' | 'DAMAGED' | 'INCOMPLETE'>('GOOD');
  const [comment, setComment] = useState('');
  const n = Number(qty);
  const ok = Number.isInteger(n) && n >= 0 && n <= shipment.quantity && !!receivedAt && receivedAt >= shipment.shippedAt
    && (condition === 'GOOD' || comment.trim().length >= 5);

  const submit = () => m.mutate({ shipmentId: shipment.id, receivedAt, quantityReceived: n, condition, comment: comment.trim() || undefined }, { onSuccess: onClose });

  return (
    <Modal
      title={t('receptionTitle')}
      subtitle={t('receptionSubtitle', { qty: shipment.quantity, date: shipment.shippedAt })}
      icon={<PackageCheck className="h-5 w-5 text-green-600" />}
      onClose={onClose}
      footer={<Buttons onClose={onClose} onSubmit={submit} busy={m.isPending} disabled={!ok} label={t('confirmReception')} />}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('receivedAt')}>
          <input type="date" value={receivedAt} min={shipment.shippedAt} max={today()} onChange={(e) => setReceivedAt(e.target.value)} className={INPUT} />
        </Field>
        <Field label={t('quantityReceived')}>
          <input type="number" min={0} max={shipment.quantity} value={qty} onChange={(e) => setQty(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <Field label={t('condition')}>
        <select value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)} className={INPUT}>
          <option value="GOOD">{t('conditionGOOD')}</option>
          <option value="DAMAGED">{t('conditionDAMAGED')}</option>
          <option value="INCOMPLETE">{t('conditionINCOMPLETE')}</option>
        </select>
      </Field>
      <Field label={condition === 'GOOD' ? t('commentOptional') : t('receptionProblem')}>
        <textarea rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} className={INPUT} />
      </Field>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('receptionNotified')}</p>
      <ErrorLine error={m.error} />
    </Modal>
  );
}
