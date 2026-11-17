'use client';

/**
 * Duplicate review of a campaign. Read-only analysis computed by the collecte service:
 * exact copies (same collector, same answers) and probable duplicates under the form rule.
 * Reviewers can open a fiche, confirm it is a different herd/entity, or reject a copy.
 * Nothing is deleted from here; a rejected fiche keeps its history and can be edited back.
 */
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, ExternalLink, Loader2, RefreshCw, ShieldAlert, ShieldCheck, Info, Check, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useLocaleStore } from '@/lib/stores/locale-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  useCampaignDataset, useCampaignDuplicates, useMarkNotDuplicate, useRejectDuplicate,
  type CampaignDataset, type CampaignDatasetRow, type CampaignDuplicates,
} from '@/lib/api/workflow-hooks';

const REVIEWER_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN', 'DATA_STEWARD', 'WAHIS_FOCAL_POINT']);
const PAGE = 15;

type View = 'exact' | 'probable' | 'marked';

function adminLeafId(v: unknown): string | null {
  if (!v || typeof v !== 'object') return typeof v === 'string' ? v : null;
  for (let i = 9; i >= 0; i--) {
    const x = (v as Record<string, unknown>)[`level_${i}`];
    if (typeof x === 'string' && x) return x;
  }
  return null;
}

function useFormatter(ds: CampaignDataset | undefined, locale: string) {
  return useMemo(() => {
    const lang = locale === 'fr' ? 'fr' : 'en';
    const label = (code: string) => {
      const l = ds?.fields[code]?.label;
      return l?.[locale] || l?.en || l?.fr || code;
    };
    const option = (code: string, v: unknown) => {
      const o = ds?.fields[code]?.options?.[String(v)];
      return o?.[locale] || o?.en || String(v);
    };
    const value = (code: string, v: unknown): string => {
      if (v === null || v === undefined || v === '') return '—';
      const type = ds?.fields[code]?.type;
      if (type === 'admin-location' || (typeof v === 'object' && v && 'level_0' in (v as object))) {
        const id = adminLeafId(v);
        const g = id ? ds?.geo[id] : undefined;
        return g ? g[lang] || g.en : id ?? '—';
      }
      if (Array.isArray(v)) return v.map((x) => option(code, x)).join(', ') || '—';
      if (typeof v === 'object') return JSON.stringify(v);
      return option(code, v);
    };
    return { label, value };
  }, [ds, locale]);
}

export function CampaignDuplicatesTab({ campaignId }: { campaignId: string }) {
  const t = useTranslations('duplicates');
  const locale = useLocaleStore((s) => s.locale);
  const role = useAuthStore((s) => s.user?.role);
  const canReview = !!role && REVIEWER_ROLES.has(role);

  const dup = useCampaignDuplicates(campaignId);
  const ds = useCampaignDataset(campaignId);
  const [view, setView] = useState<View>('exact');
  const [shown, setShown] = useState(PAGE);

  const rowsById = useMemo(() => new Map((ds.data?.rows ?? []).map((r) => [r.id, r])), [ds.data]);
  const fmt = useFormatter(ds.data, locale);

  const d = dup.data;
  const marked = useMemo(() => Object.entries(d?.marks ?? {})
    .filter(([id]) => rowsById.has(id))
    .sort((a, b) => (rowsById.get(b[0])!.submittedAt).localeCompare(rowsById.get(a[0])!.submittedAt)), [d, rowsById]);
  const extraCopies = (d?.exact ?? []).reduce((s, g) => s + g.length - 1, 0);
  const probableFiches = (d?.probable ?? []).reduce((s, g) => s + g.length, 0);
  const toReview = marked.filter(([, m]) => m.status !== 'DISTINCT').length;

  if (dup.isLoading || ds.isLoading) {
    return <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;
  }
  if (dup.error || ds.error || !d || !ds.data) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{t('loadError')}</p>;
  }

  const groups = view === 'exact' ? d.exact : view === 'probable' ? d.probable : [];
  const keyCodes = d.rule?.fields.map((f) => f.code) ?? [];

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('statChecked')} value={d.checked} />
        <Stat label={t('statExact')} value={d.exact.length} sub={t('statExactSub', { count: extraCopies })} tone={d.exact.length ? 'warn' : 'ok'} />
        <Stat label={t('statProbable')} value={d.probable.length} sub={d.rule ? t('statProbableSub', { count: probableFiches }) : t('noRuleShort')} tone={d.probable.length ? 'warn' : 'ok'} />
        <Stat label={t('statMarked')} value={toReview} sub={t('statMarkedSub', { count: marked.length })} tone={toReview ? 'warn' : 'ok'} />
      </div>

      {/* Rule */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          {d.rule ? (
            <p>
              <span className="font-medium text-gray-900 dark:text-gray-100">{t('ruleIs')}</span>{' '}
              {d.rule.fields.map((f) => fmt.label(f.code) + (f.tolerance ? ` (±${f.tolerance})` : '')).join(' + ')}
              {d.rule.gpsMeters ? ` + GPS ≤ ${d.rule.gpsMeters} m` : ''}
              {' · '}{d.rule.action === 'block' ? t('actionBlock') : t('actionWarn')}
              {d.rule.sameCollectorOnly ? ` · ${t('sameCollectorOnly')}` : ''}
            </p>
          ) : <p>{t('noRule')}</p>}
        </div>
        <button
          type="button"
          onClick={() => { dup.refetch(); ds.refetch(); }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', (dup.isFetching || ds.isFetching) && 'animate-spin')} /> {t('refresh')}
        </button>
      </div>

      {/* View switch */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
        {([
          ['exact', t('viewExact'), d.exact.length],
          ['probable', t('viewProbable'), d.probable.length],
          ['marked', t('viewMarked'), marked.length],
        ] as const).map(([k, label, n]) => (
          <button
            key={k}
            type="button"
            onClick={() => { setView(k); setShown(PAGE); }}
            className={cn('rounded-md px-3 py-1.5 text-xs font-medium',
              view === k ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400')}
          >
            {label} <span className="ml-1 tabular-nums text-gray-400">{n}</span>
          </button>
        ))}
      </div>

      {view !== 'marked' && (
        groups.length === 0 ? (
          <Empty text={view === 'exact' ? t('emptyExact') : d.rule ? t('emptyProbable') : t('noRule')} />
        ) : (
          <div className="space-y-4">
            {groups.slice(0, shown).map((g, i) => (
              <GroupCard
                key={g.join(',')}
                index={i + 1}
                kind={view}
                ids={g}
                rowsById={rowsById}
                dataset={ds.data!}
                marks={d.marks}
                keyCodes={keyCodes}
                fmt={fmt}
                canReview={canReview}
                campaignId={campaignId}
              />
            ))}
            {groups.length > shown && (
              <button type="button" onClick={() => setShown(shown + PAGE)} className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                {t('showMore', { count: groups.length - shown })}
              </button>
            )}
          </div>
        )
      )}

      {view === 'marked' && (
        marked.length === 0 ? <Empty text={t('emptyMarked')} /> : (
          <GroupCard
            index={0}
            kind="marked"
            ids={marked.slice(0, shown * 4).map(([id]) => id)}
            rowsById={rowsById}
            dataset={ds.data!}
            marks={d.marks}
            keyCodes={keyCodes}
            fmt={fmt}
            canReview={canReview}
            campaignId={campaignId}
          />
        )
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone = 'ok' }: { label: string; value: number; sub?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">
        {value.toLocaleString()}
        <span className={cn('h-2 w-2 rounded-full', tone === 'warn' ? 'bg-amber-400' : 'bg-green-500')} aria-hidden />
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12 text-center dark:border-gray-700">
      <ShieldCheck className="mb-2 h-8 w-8 text-green-500" />
      <p className="text-sm text-gray-600 dark:text-gray-300">{text}</p>
    </div>
  );
}

function GroupCard({ index, kind, ids, rowsById, dataset, marks, keyCodes, fmt, canReview, campaignId }: {
  index: number;
  kind: View;
  ids: string[];
  rowsById: Map<string, CampaignDatasetRow>;
  dataset: CampaignDataset;
  marks: CampaignDuplicates['marks'];
  keyCodes: string[];
  fmt: ReturnType<typeof useFormatter>;
  canReview: boolean;
  campaignId: string;
}) {
  const t = useTranslations('duplicates');
  const locale = useLocaleStore((s) => s.locale);
  const rows = ids.map((id) => rowsById.get(id)).filter(Boolean)
    .sort((a, b) => a!.submittedAt.localeCompare(b!.submittedAt)) as CampaignDatasetRow[];
  const date = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
  const cols = kind === 'exact' ? keyCodes.slice(0, 3) : keyCodes;

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {kind !== 'marked' && (
        <header className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 text-xs font-medium text-gray-600 dark:border-gray-800 dark:text-gray-300">
          {kind === 'exact' ? <Copy className="h-3.5 w-3.5 text-amber-500" /> : <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />}
          {kind === 'exact' ? t('groupExact', { n: index, count: rows.length }) : t('groupProbable', { n: index, count: rows.length })}
        </header>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            <tr>
              <th className="px-3 py-2">{t('colDate')}</th>
              <th className="px-3 py-2">{t('colAgent')}</th>
              {cols.map((c) => <th key={c} className="px-3 py-2">{fmt.label(c)}</th>)}
              <th className="px-3 py-2">{t('colStatus')}</th>
              <th className="px-3 py-2">{t('colMark')}</th>
              <th className="px-3 py-2 text-right">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((r, i) => (
              <DuplicateRow
                key={r.id}
                row={r}
                first={kind === 'exact' && i === 0}
                agent={dataset.agents[r.submittedBy] ?? '—'}
                cells={cols.map((c) => fmt.value(c, r.data[c]))}
                mark={marks[r.id]}
                date={date(r.submittedAt)}
                canReview={canReview}
                campaignId={campaignId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DuplicateRow({ row, first, agent, cells, mark, date, canReview, campaignId }: {
  row: CampaignDatasetRow;
  first: boolean;
  agent: string;
  cells: string[];
  mark?: CampaignDuplicates['marks'][string];
  date: string;
  canReview: boolean;
  campaignId: string;
}) {
  const t = useTranslations('duplicates');
  const distinct = useMarkNotDuplicate(campaignId);
  const reject = useRejectDuplicate(campaignId);
  const [confirm, setConfirm] = useState<null | 'distinct' | 'reject'>(null);
  const [reason, setReason] = useState('');
  const busy = distinct.isPending || reject.isPending;
  const error = (distinct.error || reject.error) as Error | null;
  const markLabel = mark ? t(`mark_${mark.status}`) : first ? t('original') : '';

  return (
    <>
      <tr className={cn(first && 'bg-green-50/50 dark:bg-green-950/10')}>
        <td className="whitespace-nowrap px-3 py-2 text-gray-900 dark:text-gray-100">{date}</td>
        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{agent}</td>
        {cells.map((c, i) => <td key={i} className="max-w-[12rem] truncate px-3 py-2 text-gray-700 dark:text-gray-300" title={c}>{c}</td>)}
        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.status}</td>
        <td className="px-3 py-2">
          {markLabel && (
            <span title={mark?.reason || mark?.reviewReason || ''} className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
              mark?.status === 'DISTINCT' || (!mark && first) ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300')}>
              {markLabel}
            </span>
          )}
          {mark?.reason && <p className="mt-0.5 max-w-[14rem] truncate text-[10px] text-gray-500" title={mark.reason}>« {mark.reason} »</p>}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <div className="inline-flex items-center gap-1">
            <Link href={`/collecte/submissions/${row.id}`} target="_blank" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40">
              {t('open')} <ExternalLink className="h-3 w-3" />
            </Link>
            {canReview && mark?.status !== 'DISTINCT' && (
              <button type="button" onClick={() => setConfirm('distinct')} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40">
                <Check className="h-3 w-3" /> {t('notDuplicate')}
              </button>
            )}
            {canReview && !first && (
              <button type="button" onClick={() => setConfirm('reject')} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
                <Ban className="h-3 w-3" /> {t('reject')}
              </button>
            )}
          </div>
        </td>
      </tr>
      {confirm && (
        <tr className="bg-gray-50 dark:bg-gray-800/50">
          <td colSpan={cells.length + 5} className="px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder={confirm === 'reject' ? t('rejectReasonPlaceholder') : t('distinctReasonPlaceholder')}
                className="h-8 min-w-[16rem] flex-1 rounded-md border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <button
                type="button"
                disabled={busy || (confirm === 'reject' && reason.trim().length < 3)}
                onClick={() => {
                  const done = { onSuccess: () => { setConfirm(null); setReason(''); } };
                  if (confirm === 'reject') reject.mutate({ id: row.id, reason: reason.trim() }, done);
                  else distinct.mutate({ id: row.id, reason: reason.trim() || undefined }, done);
                }}
                className={cn('rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50',
                  confirm === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700')}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : confirm === 'reject' ? t('confirmReject') : t('confirmDistinct')}
              </button>
              <button type="button" onClick={() => { setConfirm(null); setReason(''); }} className="rounded-md px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                {t('cancel')}
              </button>
              {error && <span className="text-xs text-red-600">{error.message}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
