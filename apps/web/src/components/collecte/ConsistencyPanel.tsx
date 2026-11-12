'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Pencil, Wand2, Send, History, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  useSubmissionConsistency,
  useReviewHistory,
  useCorrectSubmission,
  useRequestCorrection,
  type ConsistencyIssue,
  type IssueFieldMeta,
  type IssueSeverity,
  type ReviewHistoryEntry,
} from '@/lib/api/consistency-hooks';

const REVIEWER_ROLES = ['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN', 'DATA_STEWARD', 'WAHIS_FOCAL_POINT'];
const EDITABLE_TYPES = new Set(['number', 'integer', 'decimal', 'date', 'text', 'textarea', 'select', 'radio', 'dropdown', 'multi-select', 'multiselect', 'checkbox-group', 'geo-point', 'geo-selector', 'gps', 'geo-location']);
const GEO_TYPES = new Set(['geo-point', 'geo-selector', 'gps', 'geo-location']);
const MULTI_TYPES = new Set(['multi-select', 'multiselect', 'checkbox-group']);
const SELECT_TYPES = new Set(['select', 'radio', 'dropdown']);

const SEVERITY_STYLE: Record<IssueSeverity, { box: string; text: string; icon: React.ReactNode }> = {
  error: { box: 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', icon: <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" /> },
  warning: { box: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30', text: 'text-amber-800 dark:text-amber-300', icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> },
  info: { box: 'border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/30', text: 'text-sky-800 dark:text-sky-300', icon: <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" /> },
};

function localized(label: unknown, locale: string, fallback: string): string {
  if (!label) return fallback;
  if (typeof label === 'string') return label;
  const l = label as Record<string, string | undefined>;
  return l[locale] || l.en || l.fr || Object.values(l).find(Boolean) || fallback;
}

function formatValue(v: unknown, meta: IssueFieldMeta | undefined, locale: string, emptyText: string): string {
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return emptyText;
  const optLabel = (x: unknown) => {
    const o = meta?.options?.find((op) => op.value === String(x));
    return o ? localized(o.label, locale, String(x)) : String(x);
  };
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : optLabel(x))).join(', ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (o.lat !== undefined && o.lng !== undefined) return `${Number(o.lat).toFixed(5)}, ${Number(o.lng).toFixed(5)}`;
    return JSON.stringify(v);
  }
  return optLabel(v);
}

/** Localized message of an issue, using the form labels in the user's language. */
export function useIssueMessage() {
  const t = useTranslations('consistency');
  const locale = useLocaleStore((s) => s.locale);
  return (issue: ConsistencyIssue, fields: Record<string, IssueFieldMeta>) => {
    const p: Record<string, string | number> = { ...(issue.params ?? {}) };
    const lab = (code: string | undefined) => (code ? localized(fields[code]?.label, locale, String(p.field ?? code)) : '');
    if ('field' in p && issue.fields[0]) p.field = lab(issue.fields[0]);
    if ('fieldA' in p && issue.fields[0]) p.fieldA = lab(issue.fields[0]);
    if ('fieldB' in p && issue.fields[1]) p.fieldB = lab(issue.fields[1]);
    if ('gate' in p && issue.fields[0]) p.gate = lab(issue.fields[0]);
    let key = issue.code;
    if (issue.code === 'UNKNOWN_ADMIN_AREA' && p.area) key = 'UNKNOWN_ADMIN_AREA_SUGGEST';
    if (issue.code === 'GPS_OUTSIDE_COUNTRY' && Number(p.swapped) === 1) key = 'GPS_OUTSIDE_COUNTRY_SWAPPED';
    if (issue.code === 'FORM_RULE' && p.custom) return String(p.custom);
    const text = t(`codes.${key}`, p);
    return text === `codes.${key}` ? issue.message : text;
  };
}

// ── Field editor ──

function FieldEditor({ meta, value, onChange, locale }: { meta: IssueFieldMeta | undefined; value: unknown; onChange: (v: unknown) => void; locale: string }) {
  const type = meta?.type ?? 'text';
  const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white';
  if (['number', 'integer', 'decimal'].includes(type)) {
    return <input type="number" className={input} min={meta?.min} max={meta?.max} value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
  }
  if (type === 'date') {
    return <input type="date" className={input} value={typeof value === 'string' ? value.slice(0, 10) : ''} onChange={(e) => onChange(e.target.value || null)} />;
  }
  if (SELECT_TYPES.has(type) && meta?.options) {
    return (
      <select className={input} value={value === null || value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">—</option>
        {meta.options.map((o) => <option key={o.value} value={o.value}>{localized(o.label, locale, o.value)}</option>)}
      </select>
    );
  }
  if (MULTI_TYPES.has(type) && meta?.options) {
    const cur = Array.isArray(value) ? value.map(String) : [];
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {meta.options.map((o) => (
          <label key={o.value} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={cur.includes(o.value)}
              onChange={(e) => onChange(e.target.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value))} />
            {localized(o.label, locale, o.value)}
          </label>
        ))}
      </div>
    );
  }
  if (GEO_TYPES.has(type)) {
    const o = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const set = (k: 'lat' | 'lng', v: string) => onChange({ ...o, [k]: v === '' ? null : Number(v) });
    return (
      <div className="grid grid-cols-2 gap-2">
        <input type="number" step="any" placeholder="Latitude" className={input} value={o.lat === undefined || o.lat === null ? '' : String(o.lat)} onChange={(e) => set('lat', e.target.value)} />
        <input type="number" step="any" placeholder="Longitude" className={input} value={o.lng === undefined || o.lng === null ? '' : String(o.lng)} onChange={(e) => set('lng', e.target.value)} />
      </div>
    );
  }
  return <input type="text" className={input} value={value === null || value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value || null)} />;
}

// ── Panel ──

export function ConsistencyPanel({ submissionId, data, submittedBy, onChanged }: {
  submissionId: string;
  /** Current answers, to show the value of each field. Falls back to nothing if absent. */
  data?: Record<string, unknown> | null;
  submittedBy?: string | null;
  onChanged?: () => void;
}) {
  const t = useTranslations('consistency');
  const locale = useLocaleStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const message = useIssueMessage();
  const { data: result, isLoading, isError, error } = useSubmissionConsistency(submissionId);
  const { data: history } = useReviewHistory(submissionId);
  const correct = useCorrectSubmission();
  const request = useRequestCorrection();

  const [values, setValues] = useState<Record<string, unknown>>(data ?? {});
  useEffect(() => { setValues(data ?? {}); }, [data, submissionId]);

  const [editing, setEditing] = useState<{ key: string; field: string; value: unknown; reason: string } | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [requestText, setRequestText] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const issues = result?.issues ?? [];
  const fields = result?.fields ?? {};
  const isReviewer = !!user && REVIEWER_ROLES.includes(String(user.role));
  const owner = submittedBy ?? result?.submittedBy;
  const isMine = !!user && !!owner && owner === user.id;
  const issueKey = (i: ConsistencyIssue, idx: number) => `${i.code}:${i.fields.join(',')}:${idx}`;

  // Default selection for the correction request: errors and warnings
  useEffect(() => {
    const init: Record<string, boolean> = {};
    issues.forEach((i, idx) => { init[issueKey(i, idx)] = i.severity !== 'info'; });
    setSelected(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.checkedAt]);

  const chosen = useMemo(() => issues.filter((i, idx) => selected[issueKey(i, idx)]), [issues, selected]);

  if (isLoading) {
    return <div className="flex items-center gap-2 px-6 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />{t('loading')}</div>;
  }
  if (isError || !result) {
    return <div className="px-6 py-6 text-sm text-red-600">{t('error')}{error instanceof Error ? ` : ${error.message}` : ''}</div>;
  }

  const startEdit = (issue: ConsistencyIssue, idx: number, useSuggestion: boolean) => {
    const field = useSuggestion && issue.suggestion ? issue.suggestion.field : issue.fields.find((f) => EDITABLE_TYPES.has(fields[f]?.type ?? '')) ?? issue.fields[0];
    if (!field) return;
    const value = useSuggestion && issue.suggestion ? issue.suggestion.value : values[field];
    setNotice(null);
    setEditing({ key: issueKey(issue, idx), field, value, reason: message(issue, fields) });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.reason.trim()) { setNotice({ ok: false, text: t('reasonRequired') }); return; }
    try {
      const r = await correct.mutateAsync({ id: submissionId, changes: { [editing.field]: editing.value ?? null }, reason: editing.reason.trim() });
      const next = (r as any)?.data?.data;
      if (next && typeof next === 'object') setValues(next);
      setEditing(null);
      setNotice({ ok: true, text: t('corrected') });
      onChanged?.();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const sendRequest = async () => {
    try {
      await request.mutateAsync({
        id: submissionId,
        message: requestText.trim(),
        items: chosen.map((i) => ({ field: i.fields[0], code: i.code, message: message(i, fields) })),
      });
      setRequestText('');
      setNotice({ ok: true, text: t('requestSent') });
      onChanged?.();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const s = result.summary;

  return (
    <div className="space-y-4 px-6 py-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('title')}</h3>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-900/40 dark:text-red-300">{t('summaryErrors', { n: s.error })}</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{t('summaryWarnings', { n: s.warning })}</span>
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">{t('summaryInfos', { n: s.info })}</span>
        </div>
      </div>

      {notice && (
        <div className={cn('flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm', notice.ok ? 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300')}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="close"><X className="h-4 w-4" /></button>
        </div>
      )}

      {issues.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4" />{t('none')}
        </div>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue, idx) => {
            const key = issueKey(issue, idx);
            const st = SEVERITY_STYLE[issue.severity];
            const editableField = issue.fields.find((f) => EDITABLE_TYPES.has(fields[f]?.type ?? ''));
            const isEditing = editing?.key === key;
            return (
              <li key={key} className={cn('rounded-lg border p-3', st.box)}>
                <div className="flex items-start gap-2">
                  {isReviewer && !isMine && (
                    <input type="checkbox" className="mt-1" title={t('includeInRequest')} checked={!!selected[key]}
                      onChange={(e) => setSelected((p) => ({ ...p, [key]: e.target.checked }))} />
                  )}
                  <span className="mt-0.5 shrink-0">{st.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', st.text)}>
                      <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">{t(`severity.${issue.severity}`)}</span>
                      {message(issue, fields)}
                    </p>
                    {issue.fields.length > 0 && (
                      <div className="mt-1 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                        {issue.fields.filter((f) => fields[f]).slice(0, 4).map((f) => (
                          <div key={f}>
                            <span className="font-medium">{localized(fields[f]?.label, locale, f)}</span> : {formatValue(values[f], fields[f], locale, t('empty'))}
                          </div>
                        ))}
                      </div>
                    )}
                    {issue.suggestion && (
                      <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">{t('suggestion')} :</span>{' '}
                        {issue.suggestion.value === null ? t('clearValue') : issue.suggestion.label ?? formatValue(issue.suggestion.value, fields[issue.suggestion.field], locale, t('empty'))}
                        {issue.suggestion.approximate && <span className="ml-1 italic text-gray-500">({t('approximate')})</span>}
                      </p>
                    )}
                    {isReviewer && !isEditing && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {issue.suggestion && (
                          <button onClick={() => startEdit(issue, idx, true)} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-50 dark:bg-gray-800 dark:text-indigo-300 dark:ring-indigo-800">
                            <Wand2 className="h-3.5 w-3.5" />{t('applySuggestion')}
                          </button>
                        )}
                        {editableField ? (
                          <button onClick={() => startEdit(issue, idx, false)} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700">
                            <Pencil className="h-3.5 w-3.5" />{t('edit')}
                          </button>
                        ) : !issue.suggestion && issue.fields.length > 0 ? (
                          <span className="text-[11px] italic text-gray-500">{t('editInForm')}</span>
                        ) : null}
                      </div>
                    )}
                    {isEditing && editing && (
                      <div className="mt-2 space-y-2 rounded-md bg-white p-2 ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
                        {issue.fields.length > 1 && !(issue.suggestion && editing.field === issue.suggestion.field && editing.value === issue.suggestion.value) && (
                          <select className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            value={editing.field} onChange={(e) => setEditing({ ...editing, field: e.target.value, value: values[e.target.value] })}>
                            {issue.fields.filter((f) => EDITABLE_TYPES.has(fields[f]?.type ?? '')).map((f) => (
                              <option key={f} value={f}>{localized(fields[f]?.label, locale, f)}</option>
                            ))}
                          </select>
                        )}
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{localized(fields[editing.field]?.label, locale, editing.field)}</p>
                        {EDITABLE_TYPES.has(fields[editing.field]?.type ?? '') ? (
                          <FieldEditor meta={fields[editing.field]} value={editing.value} locale={locale} onChange={(v) => setEditing({ ...editing, value: v })} />
                        ) : (
                          <p className="text-xs text-gray-600 dark:text-gray-400">{editing.value === null ? t('clearValue') : issue.suggestion?.label ?? formatValue(editing.value, fields[editing.field], locale, t('empty'))}</p>
                        )}
                        <label className="block text-xs text-gray-600 dark:text-gray-400">{t('reason')}</label>
                        <textarea rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                          value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditing(null)} className="rounded-md px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">{t('cancel')}</button>
                          <button onClick={saveEdit} disabled={correct.isPending} className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                            {correct.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t('save')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isReviewer && (
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t('requestTitle')}</h4>
          {isMine ? (
            <p className="mt-1 text-xs text-gray-500">{t('ownSubmission')}</p>
          ) : (
            <>
              <textarea rows={2} placeholder={t('requestMessage')} value={requestText} onChange={(e) => setRequestText(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              <div className="mt-2 flex justify-end">
                <button onClick={sendRequest} disabled={request.isPending || (chosen.length === 0 && !requestText.trim())}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">
                  {request.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t('requestButton', { n: chosen.length })}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <ReviewHistoryList entries={history ?? []} />
    </div>
  );
}

export function ReviewHistoryList({ entries }: { entries: ReviewHistoryEntry[] }) {
  const t = useTranslations('consistency');
  return (
    <div>
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white"><History className="h-4 w-4" />{t('history')}</h4>
      {entries.length === 0 ? (
        <p className="mt-1 text-xs text-gray-500">{t('historyEmpty')}</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {entries.map((e) => {
            const items = Array.isArray((e.next as any)?.items) ? ((e.next as any).items as { message: string }[]) : [];
            const changed = e.action === 'CORRECT' || e.action === 'RESUBMIT'
              ? Object.keys(e.next ?? {}).filter((k) => !['status', 'version', 'items'].includes(k))
              : [];
            return (
              <li key={e.id} className="rounded-md bg-gray-50 px-3 py-2 text-xs dark:bg-gray-800/60">
                <div className="flex flex-wrap items-center gap-x-2 text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">{t(`action.${e.action}`)}</span>
                  {e.actor?.name && <span>{t('by')} {e.actor.name}</span>}
                  <span className="text-gray-400">{new Date(e.at).toLocaleString()}</span>
                </div>
                {e.reason && <p className="mt-0.5 text-gray-600 dark:text-gray-400">{e.reason}</p>}
                {items.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-gray-600 dark:text-gray-400">
                    {items.map((it, i) => <li key={i}>{it.message}</li>)}
                  </ul>
                )}
                {changed.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-gray-600 dark:text-gray-400">
                    {changed.slice(0, 8).map((k) => (
                      <li key={k}><span className="font-mono">{k}</span> : {short((e.previous as any)?.[k])} → {short((e.next as any)?.[k])}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function short(v: unknown): string {
  if (v === null || v === undefined || v === '') return '∅';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

/** Small badge for lists: number of errors / warnings. */
export function ConsistencyBadge({ summary }: { summary?: { error: number; warning: number; info: number } }) {
  const t = useTranslations('consistency');
  if (!summary || (summary.error === 0 && summary.warning === 0)) return null;
  return (
    <span title={t('badgeTitle', { e: summary.error, w: summary.warning })} className="inline-flex items-center gap-1">
      {summary.error > 0 && <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300"><AlertCircle className="h-3 w-3" />{summary.error}</span>}
      {summary.warning > 0 && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"><AlertTriangle className="h-3 w-3" />{summary.warning}</span>}
    </span>
  );
}
